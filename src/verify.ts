/**
 * verify.ts — core verification orchestration.
 *
 * Pure DNS by default (RFC 5321 syntax + MX + disposable/role detection).
 * SMTP handshake is opt-in and only runs when explicitly requested.
 */

import { promises as dnsProm } from "node:dns";
import { isDisposable, isRoleAccount } from "./blacklist.js";
import { smtpHandshake, type SmtpResult } from "./smtp.js";

export type CheckName = "syntax" | "mx" | "blacklist" | "role" | "smtp";

/** Hard ceiling for a single MX lookup. Degrades to "no MX" rather than hanging. */
const MX_TIMEOUT_MS = 5000;

export const DEFAULT_CHECKS: CheckName[] = ["syntax", "mx", "blacklist", "role"];

export interface VerifyOptions {
  smtp?: boolean;
  checks?: CheckName[];
}

export interface MxRecord {
  priority: number;
  exchange: string;
}

export interface VerifyResult {
  email: string;
  valid: boolean;
  score: number;
  reason: string;
  checks_passed: CheckName[];
  mx_records: MxRecord[];
  smtp_reachable: boolean | null;
  smtp_code: number | null;
  smtp_message: string | null;
  smtp_likely_valid: boolean | null;
  disposable: boolean;
  role_account: boolean;
  confidence_breakdown: Record<string, number>;
}

// Pragmatic RFC 5321 / HTML5-flavoured email pattern. Catches the
// overwhelming majority of malformed inputs without the 6KB "perfect" regex.
const EMAIL_RE =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

export function validateSyntax(email: string): { ok: boolean; reason?: string } {
  if (typeof email !== "string") return { ok: false, reason: "Not a string" };
  if (email.length > 254) return { ok: false, reason: "Exceeds 254 characters" };
  const at = email.indexOf("@");
  if (at < 1) return { ok: false, reason: "Missing local part" };
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (!domain.includes(".")) return { ok: false, reason: "Domain missing dot" };
  if (local.length > 64) return { ok: false, reason: "Local part exceeds 64 characters" };
  if (!EMAIL_RE.test(email)) return { ok: false, reason: "Failed RFC 5321 syntax" };
  return { ok: true };
}

/**
 * Wrap a promise in a hard timeout.
 *
 * `dns.promises` honours neither a per-query timeout nor `server.destroy()` in
 * every environment: on hosts where outbound UDP/53 is blocked it can hang for
 * far longer than the caller is willing to wait, which stalls an MCP tool call
 * until the client gives up. Cap it and degrade instead.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  }) as Promise<T>;
}

export async function resolveMx(domain: string): Promise<MxRecord[]> {
  try {
    const records = await withTimeout(dnsProm.resolveMx(domain), MX_TIMEOUT_MS, []);
    return records.sort((a, b) => a.priority - b.priority);
  } catch {
    return [];
  }
}

export async function checkEmail(
  email: string,
  opts: VerifyOptions = {},
): Promise<VerifyResult> {
  const smtp = opts.smtp ?? false;
  const checks = opts.checks ?? DEFAULT_CHECKS;

  const breakdown: Record<string, number> = {};
  const passed: CheckName[] = [];
  const base: VerifyResult = {
    email,
    valid: false,
    score: 0,
    reason: "",
    checks_passed: passed,
    mx_records: [],
    smtp_reachable: null,
    smtp_code: null,
    smtp_message: null,
    smtp_likely_valid: null,
    disposable: false,
    role_account: false,
    confidence_breakdown: breakdown,
  };

  // 1) Syntax (always required for a meaningful result)
  const syn = validateSyntax(email);
  if (!syn.ok) {
    // SPEC AC-01: an invalid address must report a reason containing "syntax".
    // Keep the specific cause too ("Missing local part", "Domain missing dot").
    base.reason = `Syntax invalid: ${syn.reason ?? "malformed address"}`;
    return base;
  }
  if (checks.includes("syntax")) {
    passed.push("syntax");
    breakdown["syntax"] = 20;
  }

  const at = email.indexOf("@");
  const domain = email.slice(at + 1).toLowerCase();
  const local = email.slice(0, at).toLowerCase();

  // 2) MX
  if (checks.includes("mx")) {
    const mx = await resolveMx(domain);
    base.mx_records = mx;
    if (mx.length > 0) {
      passed.push("mx");
      breakdown["mx"] = 30;
    }
  }

  // 3) Disposable
  if (checks.includes("blacklist")) {
    const disp = isDisposable(email) || isDisposable(domain);
    base.disposable = disp;
    if (!disp) {
      passed.push("blacklist");
      breakdown["blacklist"] = 20;
    }
  }

  // 4) Role account (flag, not a hard fail)
  if (checks.includes("role")) {
    const role = isRoleAccount(email);
    base.role_account = role;
    if (!role) {
      passed.push("role");
      breakdown["role"] = 10;
    }
  }

  // 5) SMTP handshake (opt-in)
  if (smtp && checks.includes("smtp") === false) checks.push("smtp");
  if (smtp && base.mx_records.length > 0) {
    const r: SmtpResult = await smtpHandshake(
      base.mx_records[0].exchange,
      domain,
      local,
    );
    base.smtp_reachable = r.reachable;
    base.smtp_code = r.code;
    base.smtp_message = r.message;
    base.smtp_likely_valid = r.likelyValid;
    if (r.reachable) {
      passed.push("smtp");
      breakdown["smtp_reachable"] = 10;
      if (r.likelyValid === true) breakdown["smtp_exists"] = 10;
    }
  }

  base.score = Math.min(100, Object.values(breakdown).reduce((a, b) => a + b, 0));
  base.valid = passed.includes("syntax") && passed.includes("mx") && !base.disposable;
  base.reason = buildReason(base);
  return base;
}

function buildReason(r: VerifyResult): string {
  if (!r.checks_passed.includes("syntax")) return "Syntax invalid";
  if (r.disposable) return "Disposable / throwaway domain detected";
  if (!r.checks_passed.includes("mx")) return "No MX record — domain does not accept mail";
  if (r.role_account) return "Looks valid (DNS) but is a role/functional account";
  if (r.smtp_likely_valid === false) return "DNS valid but SMTP probe says mailbox absent (550)";
  if (r.smtp_likely_valid === true) return "DNS valid and SMTP probe confirms mailbox exists";
  return "DNS checks passed";
}

export interface BulkResult {
  total: number;
  valid: number;
  disposable: number;
  results: VerifyResult[];
}

export async function verifyBulk(
  emails: string[],
  opts: VerifyOptions = {},
): Promise<BulkResult> {
  const limited = emails.slice(0, 10);
  const results = await Promise.all(limited.map((e) => checkEmail(e, opts)));
  return {
    total: emails.length,
    valid: results.filter((r) => r.valid).length,
    disposable: results.filter((r) => r.disposable).length,
    results,
  };
}
