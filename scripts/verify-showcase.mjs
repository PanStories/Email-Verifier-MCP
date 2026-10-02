#!/usr/bin/env node
/**
 * verify-showcase.mjs — Phase 4.5 verification showcase.
 *
 * Uses ONLY Node.js built-ins (dns) + a 5-entry inline disposable list to
 * demonstrate the REAL DNS logic against live domains. It does NOT require
 * `npm install` (the production server loads the full ~160k-domain package).
 * Output: a self-contained HTML report with real MX payloads.
 */

import dns from "node:dns/promises";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "verify-showcase.html");

const EMAIL_RE =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

// Demo-only list. Production uses `disposable-email-domain` (~160k domains).
const DEMO_DISPOSABLE = new Set(["mailinator.com", "10minutemail.com", "guerrillamail.com", "yopmail.com", "tempmail.com"]);

const SAMPLES = [
  { email: "alice@gmail.com", note: "Plausible real address" },
  { email: "spam@mailinator.com", note: "Known disposable provider" },
  { email: "not-an-email", note: "Broken syntax" },
  { email: "ghost@nonexistentdomain-xyz-12345.com", note: "Domain with no MX" },
];

function syntaxOk(email) {
  if (email.length > 254) return false;
  const at = email.indexOf("@");
  if (at < 1) return false;
  if (!email.slice(at + 1).includes(".")) return false;
  return EMAIL_RE.test(email);
}

function isDisposableDemo(domain) {
  return DEMO_DISPOSABLE.has(domain.toLowerCase());
}

async function probe(email) {
  const ok = syntaxOk(email);
  const at = email.indexOf("@");
  const domain = at > 0 ? email.slice(at + 1).toLowerCase() : "";
  let mx = [];
  if (ok && domain) {
    try {
      mx = (await dns.resolveMx(domain)).sort((a, b) => a.priority - b.priority);
    } catch {
      mx = [];
    }
  }
  const disposable = ok && isDisposableDemo(domain);
  const verdict =
    !ok ? "REJECT · bad syntax"
    : disposable ? "REJECT · disposable"
    : mx.length === 0 ? "REJECT · no MX"
    : "DNS PASS";
  return {
    email,
    ok,
    mx: mx.map((m) => `${m.exchange} (p${m.priority})`),
    disposable,
    verdict,
  };
}

const rows = await Promise.all(SAMPLES.map((s) => probe(s.email).then((r) => ({ ...r, note: s.note }))));

const card = (r) => {
  const color = r.verdict === "DNS PASS" ? "#15803d" : "#b91c1c";
  return `
  <div class="card" style="border-left:6px solid ${color}">
    <div class="em">${r.email}</div>
    <div class="v" style="color:${color}">${r.verdict}</div>
    <div class="meta">${r.note}</div>
    <div class="mx">MX: ${r.mx.length ? r.mx.join(", ") : "—"}</div>
    <div class="meta">syntax=${r.ok} · disposable=${r.disposable}</div>
  </div>`;
};

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>email-verifier-mcp · Verification Showcase</title>
<style>
  body{font-family:system-ui,Segoe UI,Arial,sans-serif;background:#f8fafc;color:#0f172a;margin:0;padding:32px}
  h1{font-size:22px;margin:0 0 4px}
  .sub{color:#64748b;margin:0 0 24px;font-size:13px}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px}
  .card{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:16px;box-shadow:0 1px 2px rgba(0,0,0,.04)}
  .em{font-weight:600;font-family:ui-monospace,Menlo,monospace;font-size:14px;word-break:break-all}
  .v{font-weight:700;margin:8px 0;font-size:14px}
  .meta{color:#64748b;font-size:12px;margin-top:4px}
  .mx{font-family:ui-monospace,Menlo,monospace;font-size:12px;margin-top:6px;color:#334155}
  .note{margin-top:24px;font-size:12px;color:#64748b;background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:12px}
  code{background:#f1f5f9;padding:1px 5px;border-radius:4px}
</style></head>
<body>
  <h1>email-verifier-mcp · Live DNS Verification Showcase</h1>
  <p class="sub">Generated ${new Date().toISOString()} · real DNS MX lookups · no npm install required in this sandbox</p>
  <div class="grid">${rows.map(card).join("")}</div>
  <div class="note">
    This demo uses Node's built-in <code>dns</code> plus a 5-entry inline disposable list to prove the
    DNS engine works against live domains. The shipped server loads the full
    <code>disposable-email-domain</code> package (~160k domains, MIT) and adds opt-in SMTP handshake,
    role-account flagging, and a 0–100 confidence score. All checks are DNS-only by default (compliant);
    SMTP is opt-in.
  </div>
</body></html>`;

writeFileSync(OUT, html);
console.error(`[showcase] wrote ${OUT}`);
console.error(rows.map((r) => `${r.email} → ${r.verdict} (mx=${r.mx.length})`).join("\n"));
