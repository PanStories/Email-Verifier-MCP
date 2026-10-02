/**
 * http.ts — optional hosted mode (the $19/mo "Hosted Convenience" tier).
 *
 * Exposes the same MCP tools over Streamable HTTP with:
 *   - Bearer-token auth (API keys you mint in Stripe-backed signup)
 *   - Per-key rate limiting (in-memory, MVP — swap for Redis in prod)
 *   - DNS-rebinding protection (mitigates CVE-2025-66414)
 *
 * The OSS `npx` build is free & unlimited locally. This hosted mode is what
 * the $19/mo subscribers pay for: warmed/rotating IPs for the SMTP handshake,
 * centrally-refreshed blacklist, and a simple HTTP endpoint for their agents.
 */

import http from "node:http";
import { randomUUID } from "node:crypto";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

export interface HostedOpts {
  port: number;
  apiKeys: string[];
  rateLimitPerHour: number;
  allowedHosts: string[];
  allowedOrigins: string[];
}

function corsHeaders(origin: string | undefined, allowedOrigins: string[]) {
  const headers: Record<string, string> = { "Access-Control-Allow-Methods": "POST, OPTIONS" };
  if (origin && (allowedOrigins.includes("*") || allowedOrigins.includes(origin))) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, mcp-session-id";
  return headers;
}

function readBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c as Buffer));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      try {
        resolve(raw ? JSON.parse(raw) : undefined);
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

export async function startHostedServer(server: McpServer, opts: HostedOpts): Promise<void> {
  const hits = new Map<string, { count: number; resetAt: number }>();

  const httpServer = http.createServer(async (req, res) => {
    const origin = req.headers.origin;

    // Preflight
    if (req.method === "OPTIONS") {
      res.writeHead(204, corsHeaders(origin, opts.allowedOrigins));
      res.end();
      return;
    }

    // Origin gate
    if (origin && opts.allowedOrigins.length && !opts.allowedOrigins.includes("*") && !opts.allowedOrigins.includes(origin)) {
      res.writeHead(403, { "content-type": "application/json" }).end(JSON.stringify({ error: "Forbidden origin" }));
      return;
    }

    // Auth
    const auth = (req.headers["authorization"] as string) || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!opts.apiKeys.includes(token)) {
      res.writeHead(401, { "content-type": "application/json" }).end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }

    // Rate limit (hourly sliding window per key)
    const now = Date.now();
    const bucket = hits.get(token) ?? { count: 0, resetAt: now + 3_600_000 };
    if (bucket.resetAt < now) {
      bucket.count = 0;
      bucket.resetAt = now + 3_600_000;
    }
    if (bucket.count >= opts.rateLimitPerHour) {
      res.writeHead(429, { "content-type": "application/json" }).end(JSON.stringify({ error: "Rate limit exceeded" }));
      return;
    }
    bucket.count++;
    hits.set(token, bucket);

    if (req.method !== "POST" || !req.url?.startsWith("/mcp")) {
      res.writeHead(404).end();
      return;
    }

    try {
      const body = await readBody(req);
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // stateless — every request is independent
        enableDnsRebindingProtection: true,
        allowedHosts: opts.allowedHosts,
        allowedOrigins: opts.allowedOrigins,
      });
      res.on("close", () => transport.close().catch(() => {}));
      await server.connect(transport);
      await transport.handleRequest(req, res, body);
    } catch (e: any) {
      if (!res.headersSent) {
        res.writeHead(500, { "content-type": "application/json" }).end(JSON.stringify({ error: e?.message ?? "Internal error" }));
      }
    }
  });

  await new Promise<void>((resolve) => httpServer.listen(opts.port, () => resolve()));
  // randomUUID referenced to keep import meaningful for future session ids
  void randomUUID;
  console.error(`[email-verifier-mcp] hosted mode listening on :${opts.port}`);
}
