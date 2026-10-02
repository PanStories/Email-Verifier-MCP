// HTTP (Streamable) end-to-end test: readiness probe + initialize
// + tools/list + tools/call + 405 on non-POST
//
// Mirrors e2e-test.mjs: MX-dependent assertions SKIP when outbound UDP/53 is
// blocked, everything else is asserted.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promises as dns } from 'node:dns';
import path from 'node:path';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const entry = path.join(__dirname, 'dist', 'apify-http.js');
const PORT = Number(process.env.E2E_PORT ?? 3100);
const BASE = `http://127.0.0.1:${PORT}`;

if (!fs.existsSync(entry)) {
  console.error('dist/apify-http.js not found — run "npm run build" first.');
  process.exit(1);
}

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

const child = spawn(process.execPath, [entry], {
  cwd: __dirname,
  env: { ...process.env, PORT: String(PORT) },
  stdio: ['ignore', 'pipe', 'pipe'],
});
child.stdout.on('data', (d) => process.stdout.write(`[server] ${d}`));
child.stderr.on('data', (d) => process.stderr.write(`[server] ${d}`));

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

async function waitReady() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${BASE}/health`);
      if (r.ok) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

/** Parse either application/json or text/event-stream responses. */
async function parse(res) {
  const ct = res.headers.get('content-type') ?? '';
  const text = await res.text();
  if (ct.includes('text/event-stream')) {
    const line = text.split('\n').find((l) => l.startsWith('data:'));
    return line ? JSON.parse(line.slice(5).trim()) : { raw: text };
  }
  return text ? JSON.parse(text) : {};
}

let nextId = 1;
async function mcp(method, params) {
  const id = method === 'notifications/initialized' ? undefined : nextId++;
  const res = await fetch(`${BASE}/mcp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
  });
  return { status: res.status, payload: await parse(res) };
}

try {
  const ready = await waitReady();
  check('1) server started', ready);
  if (!ready) throw new Error('server never became ready');

  // Apify container readiness probe — MUST be 200 or standby never goes ready
  const probe = await fetch(`${BASE}/`, {
    headers: { 'x-apify-container-server-readiness-probe': '1' },
  });
  const probeBody = await probe.text();
  check('2) Apify readiness probe -> 200', probe.status === 200, probeBody.trim());

  // initialize
  const init = await mcp('initialize', {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'http-e2e', version: '1.0' },
  });
  const si = init.payload?.result?.serverInfo;
  check('3) initialize', !!si, si ? `${si.name} v${si.version}` : JSON.stringify(init.payload));

  await mcp('notifications/initialized');

  // tools/list
  const tools = await mcp('tools/list');
  const names = (tools.payload?.result?.tools ?? []).map((t) => t.name);
  check('4) tools/list has 4 tools', names.length === 4, names.join(', '));

  // tools/call -> check_email
  const q = await mcp('tools/call', {
    name: 'check_email',
    arguments: { email: 'someone@gmail.com' },
  });
  const qs = q.payload?.result?.structuredContent;
  check('5) check_email returns structured result',
    !!qs && typeof qs.score === 'number' && qs.checks_passed?.includes('syntax'),
    `score=${qs?.score} reason=${qs?.reason}`);
  checkDns('   gmail.com valid', qs?.valid === true, `valid=${qs?.valid}`);

  // tools/call -> is_disposable (network independent)
  const d = await mcp('tools/call', {
    name: 'is_disposable',
    arguments: { input: 'mailinator.com' },
  });
  check('6) is_disposable(mailinator.com)', d.payload?.result?.structuredContent?.disposable === true,
    d.payload?.result?.content?.[0]?.text ?? '');

  // tools/call -> check_mx (must not hang)
  const mx = await mcp('tools/call', {
    name: 'check_mx',
    arguments: { domain: 'gmail.com' },
  });
  const ms = mx.payload?.result?.structuredContent;
  check('7) check_mx returns array (no hang)', Array.isArray(ms?.mx_records),
    `has_mx=${ms?.has_mx} n=${ms?.mx_records?.length ?? 0}`);
  checkDns('   gmail.com has_mx', ms?.has_mx === true, `has_mx=${ms?.has_mx}`);

  // tools/call -> verify_bulk
  const bulk = await mcp('tools/call', {
    name: 'verify_bulk',
    arguments: { emails: ['a@gmail.com', 'b@mailinator.com'] },
  });
  check('8) verify_bulk', bulk.payload?.result?.structuredContent?.total === 2,
    bulk.payload?.result?.content?.[0]?.text?.split('\n')[0] ?? '');

  // non-POST on /mcp must be 405
  const bad = await fetch(`${BASE}/mcp`, { method: 'GET' });
  check('9) GET /mcp -> 405', bad.status === 405, `got ${bad.status}`);

  // unknown path -> 404
  const nf = await fetch(`${BASE}/nope`);
  check('10) unknown path -> 404', nf.status === 404, `got ${nf.status}`);
} catch (err) {
  console.error('FATAL:', err.message);
  failures++;
} finally {
  child.kill();
}

console.log(
  failures === 0
    ? `\nALL HTTP E2E CHECKS PASSED${skipped ? ` (${skipped} skipped, DNS blocked)` : ''}`
    : `\n${failures} CHECK(S) FAILED`
);
process.exit(failures === 0 ? 0 : 1);
