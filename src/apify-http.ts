#!/usr/bin/env node
/**
 * Apify Standby entry point — Streamable HTTP transport.
 *
 * Why Streamable HTTP: the legacy HTTP+SSE transport is deprecated and was
 * withdrawn from Apify in 2026-04. The current MCP standard is Streamable HTTP.
 *
 * Endpoints:
 *   POST /mcp     MCP protocol endpoint (stateless: fresh server per request)
 *   GET  /health  health check
 *   GET  /        Apify container readiness probe (MUST respond, otherwise the
 *                 standby run is never marked ready)
 *
 * Billing: tools/call on POST /mcp triggers pay-per-event charging
 * (see src/billing.ts). Locally (outside Apify) charging is skipped.
 *
 * Port: ACTOR_WEB_SERVER_PORT > APIFY_CONTAINER_PORT > PORT > 3000
 *
 * NOTE: authentication is intentionally NOT enforced here. The Apify gateway
 * injects and validates `Authorization: Bearer <APIFY_TOKEN>` in front of this
 * container. Adding our own host/origin whitelist here would reject Apify's
 * own hostname (the classic "Forbidden host" trap), so DNS-rebinding
 * protection is left off and the gateway is trusted.
 */

import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { Actor, log } from 'apify';
import { buildServer } from './server.js';
import { chargeToolCall, SPENDING_LIMIT_MESSAGE } from './billing.js';

const PORT = Number(
  process.env.ACTOR_WEB_SERVER_PORT ?? process.env.APIFY_CONTAINER_PORT ?? process.env.PORT ?? 3000
);
const HOST = process.env.HOST ?? '0.0.0.0';
const MCP_PATH = '/mcp';

// Inside Apify we must init for charging/storage to work. Outside, stay inert.
const AT_HOME = Actor.isAtHome();
if (AT_HOME) {
  await Actor.init();
  log.info('[email-verifier-mcp] Apify Actor initialized — pay-per-event billing is ON');
}

function sendJson(
  res: ServerResponse,
  status: number,
  payload: unknown,
  headers: Record<string, string> = {}
): void {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    ...headers,
  });
  res.end(body);
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? Buffer.from(chunk) : Buffer.from(chunk));
  }
  if (!chunks.length) return undefined;
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return undefined;
  return JSON.parse(raw);
}

/**
 * Charge every tools/call in this request.
 * Returns true when the spending cap was hit (an error response was written
 * and the caller should abort).
 */
async function billToolCalls(res: ServerResponse, body: unknown): Promise<boolean> {
  const messages = Array.isArray(body) ? body : [body];

  for (const message of messages) {
    const msg = message as { method?: string; id?: unknown; params?: { name?: string } } | null;
    if (!msg || msg.method !== 'tools/call') continue;

    const outcome = await chargeToolCall(msg.params?.name ?? '');
    if (outcome.limitReached) {
      sendJson(res, 200, {
        jsonrpc: '2.0',
        id: msg.id ?? null,
        error: { code: -32001, message: SPENDING_LIMIT_MESSAGE },
      });
      return true;
    }
  }

  return false;
}

const httpServer = createHttpServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const path = url.pathname.replace(/\/+$/, '') || '/';

  // --- Apify container readiness probe (required for standby readiness) ---
  if (path === '/') {
    if (req.headers['x-apify-container-server-readiness-probe']) {
      sendJson(res, 200, { status: 'ready' });
      return;
    }
    sendJson(res, 200, {
      name: 'email-verifier-mcp',
      version: '1.0.0',
      transport: 'streamable-http',
      mcpEndpoint: MCP_PATH,
      health: '/health',
      tools: ['check_email', 'verify_bulk', 'check_mx', 'is_disposable'],
      pricing: { 'tool-call': '$0.005', 'initialize / tools/list': 'free' },
    });
    return;
  }

  if (path === '/health') {
    sendJson(res, 200, { status: 'ok', uptime: Math.round(process.uptime()), billing: AT_HOME });
    return;
  }

  // --- MCP protocol endpoint ---
  if (path === MCP_PATH) {
    if (req.method !== 'POST') {
      // Stateless mode cannot serve server-push streams (GET) or terminate
      // sessions (DELETE).
      sendJson(
        res,
        405,
        {
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Method Not Allowed: stateless server accepts POST only on /mcp',
          },
          id: null,
        },
        { Allow: 'POST' }
      );
      return;
    }

    try {
      const body = await readJsonBody(req);

      // Charge tools/call (discovery stays free); abort on spending cap.
      if (await billToolCalls(res, body)) return;

      // Stateless: a fresh server + transport per request, so concurrent
      // requests and cold starts are handled cleanly.
      const server = buildServer();
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      res.on('close', () => {
        void transport.close();
        void server.close();
      });
      await server.connect(transport);
      await transport.handleRequest(req, res, body);
    } catch (error: any) {
      console.error('[email-verifier-mcp] request error:', error);
      if (!res.headersSent) {
        sendJson(res, 500, {
          jsonrpc: '2.0',
          error: { code: -32603, message: `Internal server error: ${error?.message ?? error}` },
          id: null,
        });
      }
    }
    return;
  }

  sendJson(res, 404, { error: 'Not found', mcpEndpoint: MCP_PATH });
});

httpServer.listen(PORT, HOST, () => {
  console.log(`[email-verifier-mcp] Streamable HTTP server listening on http://${HOST}:${PORT}${MCP_PATH}`);
  console.log(`[email-verifier-mcp] standby=${process.env.APIFY_META_ORIGIN ?? 'local'} billing=${AT_HOME}`);
});

function shutdown(signal: string) {
  console.log(`[email-verifier-mcp] received ${signal}, shutting down`);
  httpServer.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
