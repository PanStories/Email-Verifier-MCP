// stdio end-to-end MCP test: initialize -> tools/list -> tools/call
//
// MX lookups need outbound UDP/53. Some sandboxes block it, so DNS-dependent
// assertions are reported as SKIP instead of FAIL there. Everything else
// (syntax, 160k disposable blacklist, role accounts, bulk, protocol framing)
// is network-independent and always asserted.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promises as dns } from 'node:dns';
import path from 'node:path';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const entry = path.join(__dirname, 'dist', 'index.js');

if (!fs.existsSync(entry)) {
  console.error('dist/index.js not found — run "npm run build" first.');
  process.exit(1);
}

/** Is outbound MX resolution actually reachable from here? */
async function dnsAvailable() {
  try {
    const r = await Promise.race([
      dns.resolveMx('gmail.com'),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 3000)),
    ]);
    return Array.isArray(r) && r.length > 0;
  } catch {
    return false;
  }
}

const DNS_OK = await dnsAvailable();
console.log(`DNS(MX) resolution: ${DNS_OK ? 'available' : 'BLOCKED — MX assertions will SKIP'}\n`);

const proc = spawn(process.execPath, [entry], {
  cwd: __dirname,
  stdio: ['pipe', 'pipe', 'pipe'],
});

let buffer = '';
const pending = new Map();
proc.stdout.on('data', (chunk) => {
  buffer += chunk.toString();
  let idx;
  while ((idx = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + 1);
    if (!line) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      continue;
    }
    if (msg && msg.id != null && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  }
});
proc.stderr.on('data', (d) => process.stderr.write(`[server] ${d}`));

let nextId = 1;
const send = (method, params) => {
  const id = nextId++;
  const p = new Promise((resolve, reject) => {
    pending.set(id, resolve);
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error(`timeout waiting for id ${id} (${method})`));
      }
    }, 30000);
  });
  proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  return p;
};
const notify = (method, params) => {
  proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n');
};

let failures = 0;
let skipped = 0;
const check = (label, ok, detail) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};
const checkDns = (label, ok, detail) => {
  if (!DNS_OK) {
    console.log(`SKIP  ${label} (DNS blocked)`);
    skipped++;
    return;
  }
  check(label, ok, detail);
};

try {
  // 1. initialize
  const init = await send('initialize', {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'e2e-stdio', version: '1.0' },
  });
  const si = init?.result?.serverInfo;
  check('1) initialize', !!si, si ? `${si.name} v${si.version}` : JSON.stringify(init));
  notify('notifications/initialized');

  // 2. tools/list
  const tools = await send('tools/list');
  const names = (tools?.result?.tools ?? []).map((t) => t.name);
  check('2) tools/list has 4 tools', names.length === 4, names.join(', '));

  // 3. check_email — well-formed result regardless of DNS
  const q = await send('tools/call', {
    name: 'check_email',
    arguments: { email: 'someone@gmail.com' },
  });
  const qs = q?.result?.structuredContent;
  check(
    '3) check_email returns structured result',
    !!qs && typeof qs.score === 'number' && typeof qs.reason === 'string' && qs.checks_passed.includes('syntax'),
    `score=${qs?.score} reason=${qs?.reason}`
  );
  checkDns('   gmail.com valid + MX present', qs?.valid === true && (qs?.mx_records?.length ?? 0) > 0,
    `valid=${qs?.valid} mx=${qs?.mx_records?.length ?? 0}`);

  // 4. disposable must be rejected (blacklist only — no network needed)
  const d = await send('tools/call', {
    name: 'check_email',
    arguments: { email: 'someone@mailinator.com' },
  });
  const ds = d?.result?.structuredContent;
  check('4) check_email mailinator.com flagged disposable', ds?.disposable === true && ds?.valid === false,
    ds?.reason ?? '');

  // 5. syntax failure (SPEC AC-01: reason must mention syntax)
  const bad = await send('tools/call', {
    name: 'check_email',
    arguments: { email: 'not-an-email' },
  });
  const bs = bad?.result?.structuredContent;
  check('5) bad syntax rejected + reason mentions syntax',
    bs?.valid === false && /syntax/i.test(bs?.reason ?? ''), bs?.reason ?? '');

  // 6. is_disposable on a bare domain
  const disp = await send('tools/call', {
    name: 'is_disposable',
    arguments: { input: 'mailinator.com' },
  });
  check('6) is_disposable(mailinator.com)', disp?.result?.structuredContent?.disposable === true,
    disp?.result?.content?.[0]?.text ?? '');

  // 7. check_mx — degrade-to-empty, never hang
  const mx = await send('tools/call', {
    name: 'check_mx',
    arguments: { domain: 'gmail.com' },
  });
  const ms = mx?.result?.structuredContent;
  check('7) check_mx returns array (no hang)', Array.isArray(ms?.mx_records),
    `has_mx=${ms?.has_mx} n=${ms?.mx_records?.length ?? 0}`);
  checkDns('   gmail.com has_mx', ms?.has_mx === true, `has_mx=${ms?.has_mx}`);

  // 8. verify_bulk
  const bulk = await send('tools/call', {
    name: 'verify_bulk',
    arguments: { emails: ['a@gmail.com', 'b@mailinator.com', 'bad@@'] },
  });
  const br = bulk?.result?.structuredContent;
  check('8) verify_bulk', br?.total === 3 && br?.results?.length === 3,
    `total=${br?.total} valid=${br?.valid} disposable=${br?.disposable}`);

  // 9. blacklist resource
  const res = await send('resources/read', { uri: 'blacklist://stats' });
  const statsText = res?.result?.contents?.[0]?.text ?? '';
  const stats = JSON.parse(statsText || '{}');
  check('9) blacklist://stats >1000 domains', (stats.disposable_domains ?? 0) > 1000,
    `${stats.disposable_domains} domains`);
} catch (err) {
  console.error('FATAL:', err.message);
  failures++;
} finally {
  proc.kill();
}

console.log(
  failures === 0
    ? `\nALL STDIO E2E CHECKS PASSED${skipped ? ` (${skipped} skipped, DNS blocked)` : ''}`
    : `\n${failures} CHECK(S) FAILED`
);
process.exit(failures === 0 ? 0 : 1);
