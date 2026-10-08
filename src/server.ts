/**
 * server.ts — MCP surface (tools / resources / prompts).
 *
 * The same server object is reused for both stdio (npx, default) and the
 * optional hosted Streamable-HTTP mode. All tools are stateless and
 * return both `content` (human text) and `structuredContent` (agent data).
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { checkEmail, verifyBulk, resolveMx, DEFAULT_CHECKS, type VerifyResult } from "./verify.js";
import { isDisposable, isRoleAccount, blacklistStats } from "./blacklist.js";

const SMTP_DEFAULT = process.env.SMTP_DEFAULT === "1";

function fmtResult(r: VerifyResult): string {
  const lines = [
    `Email: ${r.email}`,
    `Valid: ${r.valid ? "YES" : "NO"}  ·  Confidence: ${r.score}/100`,
    `Reason: ${r.reason}`,
    `Checks passed: ${r.checks_passed.join(", ") || "(none)"}`,
    `MX: ${r.mx_records.length ? r.mx_records.map((m) => `${m.exchange} (p${m.priority})`).join(", ") : "none"}`,
    `Disposable: ${r.disposable ? "YES" : "no"}  ·  Role account: ${r.role_account ? "YES" : "no"}`,
  ];
  if (r.smtp_reachable !== null) {
    lines.push(`SMTP: reachable=${r.smtp_reachable} code=${r.smtp_code ?? "-"} likelyValid=${r.smtp_likely_valid ?? "-"}`);
  }
  return lines.join("\n");
}

export function buildServer(): McpServer {
  const server = new McpServer({
    name: "email-verifier-mcp",
    version: "1.0.0",
  });

  server.registerTool(
    "check_email",
    {
      title: "Verify a single email address",
      description:
        "DNS-based email verification: RFC 5321 syntax, MX record lookup, disposable + role-account detection. " +
        "SMTP handshake is OPT-IN and off by default (compliance). Returns both a human summary and structured data.",
      inputSchema: {
        email: z.string().describe("Email address to verify, e.g. user@example.com"),
        smtp: z
          .boolean()
          .optional()
          .default(SMTP_DEFAULT)
          .describe("Opt-in SMTP handshake. OFF by default for compliance. Enable only from infrastructure you control."),
        checks: z
          .array(z.enum(["syntax", "mx", "blacklist", "role", "smtp"]))
          .optional()
          .describe("Override checks. Default: syntax, mx, blacklist, role (DNS-only)."),
      },
      // M8ven Trust Index: four explicit boolean hints per tool (OpenAI directory
      // hard gate). check_email performs outbound DNS lookups -> openWorld: true.
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ email, smtp, checks }) => {
      const result = await checkEmail(email, {
        smtp,
        checks: checks ?? DEFAULT_CHECKS,
      });
      return {
        content: [{ type: "text", text: fmtResult(result) }],
        // The SDK types structuredContent as an index-signature record; the
        // concrete result interfaces are stricter, so widen at the boundary.
        structuredContent: result as unknown as Record<string, unknown>,
      };
    },
  );

  server.registerTool(
    "verify_bulk",
    {
      title: "Verify up to 10 emails in bulk",
      description:
        "Batch verification of up to 10 emails. Same DNS-based checks as check_email. Returns a per-email array plus a summary.",
      inputSchema: {
        emails: z.array(z.string()).min(1).max(10).describe("1–10 email addresses"),
        smtp: z.boolean().optional().default(SMTP_DEFAULT).describe("Opt-in SMTP handshake for all emails."),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ emails, smtp }) => {
      const bulk = await verifyBulk(emails, { smtp });
      const summary =
        `Bulk result: ${bulk.valid}/${bulk.total} valid · ${bulk.disposable} disposable\n` +
        bulk.results.map((r) => `• ${r.email}: ${r.valid ? "OK" : "FAIL"} (${r.score}/100) — ${r.reason}`).join("\n");
      return {
        content: [{ type: "text", text: summary }],
        structuredContent: bulk as unknown as Record<string, unknown>,
      };
    },
  );

  server.registerTool(
    "check_mx",
    {
      title: "Look up MX records for a domain",
      description: "Standalone DNS MX-record lookup. Returns the mail-exchanger list sorted by priority.",
      inputSchema: {
        domain: z.string().describe("Domain to query, e.g. example.com"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ domain }) => {
      const mx = await resolveMx(domain.toLowerCase());
      return {
        content: [
          {
            type: "text",
            text: mx.length
              ? `MX for ${domain}: ${mx.map((m) => `${m.exchange} (p${m.priority})`).join(", ")}`
              : `No MX records found for ${domain}`,
          },
        ],
        structuredContent: { domain, has_mx: mx.length > 0, mx_records: mx },
      };
    },
  );

  server.registerTool(
    "is_disposable",
    {
      title: "Check if an email/domain is disposable",
      description:
        "Detects throwaway / temporary email providers using a ~160k-domain MIT blacklist (auto-refreshed weekly). " +
        "Accepts a full email or a bare domain.",
      inputSchema: {
        input: z.string().describe("Email or bare domain, e.g. someone@mailinator.com or mailinator.com"),
      },
      // Local blacklist/role lookup only — no outbound calls -> openWorld: false.
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ input }) => {
      const disposable = isDisposable(input);
      const role = isRoleAccount(input);
      return {
        content: [
          {
            type: "text",
            text: `"${input}" → disposable: ${disposable ? "YES" : "no"}, role account: ${role ? "YES" : "no"}`,
          },
        ],
        structuredContent: { input, disposable, role_account: role },
      };
    },
  );

  server.registerResource(
    "blacklist-stats",
    "blacklist://stats",
    {
      title: "Disposable blacklist statistics",
      description: "Size and source of the loaded disposable-domain blacklist.",
      mimeType: "application/json",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          text: JSON.stringify(blacklistStats(), null, 2),
          mimeType: "application/json",
        },
      ],
    }),
  );

  server.registerPrompt(
    "verify_signup_email",
    {
      title: "Verify a user-signup email",
      description:
        "Guide an agent to verify a signup email and make an accept / flag / reject decision.",
      argsSchema: { email: z.string().describe("The signup email to evaluate") },
    },
    async ({ email }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              `Verify the signup email "${email}" using the check_email tool (DNS-only by default). ` +
              `Then decide:\n` +
              `(a) ACCEPT if syntax + MX pass and it is not disposable;\n` +
              `(b) FLAG if it is a role/functional account (e.g. support@) or confidence < 70;\n` +
              `(c) REJECT if syntax fails, there is no MX record, or it is a disposable domain.\n` +
              `Report the confidence score and the reason. Do not enable the SMTP handshake unless explicitly asked.`,
          },
        },
      ],
    }),
  );

  return server;
}
