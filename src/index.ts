#!/usr/bin/env node
/**
 * index.ts — entry point.
 *
 * Default: stdio transport for `npx email-verifier-mcp` (one-click,
 * zero-config, runs inside the agent's own process).
 *
 * Hosted mode: set HOSTED_MODE=1 to serve Streamable HTTP for the
 * $19/mo "Hosted Convenience" tier (Bearer auth + rate limiting).
 */

import { buildServer } from "./server.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

async function main(): Promise<void> {
  const server = buildServer();

  if (process.env.HOSTED_MODE === "1") {
    const { startHostedServer } = await import("./http.js");
    await startHostedServer(server, {
      port: parseInt(process.env.HOSTED_PORT ?? "3000", 10),
      apiKeys: (process.env.API_KEYS ?? "").split(",").map((s) => s.trim()).filter(Boolean),
      rateLimitPerHour: parseInt(process.env.RATE_LIMIT_PER_HOUR ?? "1000", 10),
      allowedHosts: (process.env.HOSTED_ALLOWED_HOSTS ?? "localhost,127.0.0.1")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      allowedOrigins: (process.env.HOSTED_ALLOWED_ORIGINS ?? "*")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    });
    return;
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[email-verifier-mcp] stdio transport connected");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
