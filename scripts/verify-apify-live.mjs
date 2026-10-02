// Live verification of the deployed Apify Standby MCP actor.
//
// 1. Actor config (isPublic / standby / pricing / categories)
// 2. Real MCP calls over Streamable HTTP against the standby endpoint
//    (this is where real MX/DNS is exercised — sandboxes often block UDP/53)
// 3. Billing: reads chargedEventCounts from the run that served the call
//
// Token: APIFY_TOKEN env var, else ~/.apify/auth.json
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ACTOR_ID = process.env.ACTOR_ID ?? 'LhK9VskPkgkSWCPDy';
const BASE = `https://neeenja--email-verifier-mcp.apify.actor`;
const MCP = `${BASE}/mcp`;

function getToken() {
  if (process.env.APIFY_TOKEN) return process.env.APIFY_TOKEN;
  const p = path.join(os.homedir(), '.apify', 'auth.json');
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  return j.token ?? (j.tokens && j.tokens[0] && j.tokens[0].token);
}
const TOKEN = getToken();

let failures = 0;
const check = (label, ok, detail) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};

async function api(pathname, opts = {}) {
  const r = await fetch(`https://api.apify.com/v2${pathname}`, {
    ...opts,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', ...(opts.headers ?? {}) },
  });
  return r.json();
}

async function mcp(body, timeoutMs = 60000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(MCP, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        Authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const ct = res.headers.get('content-type') ?? '';
    const text = await res.text();
    let payload;
    if (ct.includes('text/event-stream')) {
      const line = text.split('\n').find((l) => l.startsWith('data:'));
      payload = line ? JSON.parse(line.slice(5).trim()) : { raw: text };
    } else {
      payload = text ? JSON.parse(text) : {};
    }
    return { status: res.status, payload };
  } finally {
    clearTimeout(timer);
  }
}

console.log('=== 1) Actor configuration ===');
const actor = (await api(`/acts/${ACTOR_ID}`)).data ?? {};
check('isPublic', actor.isPublic === true, String(actor.isPublic));
check('standby enabled', actor.actorStandby?.isEnabled === true);
check('standby idleTimeoutSecs=120', actor.actorStandby?.idleTimeoutSecs === 120, String(actor.actorStandby?.idleTimeoutSecs));
check('standby memoryMbytes=512', actor.actorStandby?.memoryMbytes === 512, String(actor.actorStandby?.memoryMbytes));
check('categories set', Array.isArray(actor.categories) && actor.categories.length > 0, JSON.stringify(actor.categories));
const pi = actor.pricingInfos?.[0];
check('pricingModel PAY_PER_EVENT', pi?.pricingModel === 'PAY_PER_EVENT', String(pi?.pricingModel));
const ev = pi?.pricingPerEvent?.actorChargeEvents ?? {};
check('tool-call priced $0.005', ev['tool-call']?.eventPriceUsd === 0.005, `$${ev['tool-call']?.eventPriceUsd}`);
check('endpoint (top-level standbyUrl)', !!actor.standbyUrl, actor.standbyUrl);

console.log('\n=== 2) Live MCP calls (cold start may take ~30s) ===');
let id = 1;
const init = await mcp({
  jsonrpc: '2.0', id: id++, method: 'initialize',
  params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'apify-live', version: '1.0' } },
});
const si = init.payload?.result?.serverInfo;
check('initialize', !!si, si ? `${si.name} v${si.version}` : JSON.stringify(init.payload).slice(0, 300));

await mcp({ jsonrpc: '2.0', method: 'notifications/initialized' });

const tools = await mcp({ jsonrpc: '2.0', id: id++, method: 'tools/list' });
const names = (tools.payload?.result?.tools ?? []).map((t) => t.name);
check('tools/list (4 tools)', names.length === 4, names.join(', '));

// Real MX/DNS — the check that cannot run in a UDP/53-blocked sandbox
const q = await mcp({
  jsonrpc: '2.0', id: id++, method: 'tools/call',
  params: { name: 'check_email', arguments: { email: 'someone@gmail.com' } },
});
const qs = q.payload?.result?.structuredContent;
check('check_email gmail.com valid', qs?.valid === true, `score=${qs?.score} reason=${qs?.reason}`);
check('check_email MX resolved (real DNS)', (qs?.mx_records?.length ?? 0) > 0,
  `${qs?.mx_records?.length ?? 0} records`);

const d = await mcp({
  jsonrpc: '2.0', id: id++, method: 'tools/call',
  params: { name: 'is_disposable', arguments: { input: 'mailinator.com' } },
});
check('is_disposable(mailinator.com)', d.payload?.result?.structuredContent?.disposable === true,
  d.payload?.result?.content?.[0]?.text ?? '');

console.log('\n=== 3) Billing ===');
await new Promise((r) => setTimeout(r, 8000)); // charge aggregation lags
const runs = (await api(`/acts/${ACTOR_ID}/runs?limit=3&desc=true`)).data?.items ?? [];
let charged = null;
for (const run of runs) {
  const detail = (await api(`/actor-runs/${run.id}`)).data ?? {};
  if (detail.chargedEventCounts && Object.keys(detail.chargedEventCounts).length) {
    charged = { runId: run.id, counts: detail.chargedEventCounts };
    break;
  }
}
check('tool-call actually charged', !!charged, charged ? JSON.stringify(charged.counts) : 'no charged events found yet');

console.log(failures === 0 ? '\nALL LIVE CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
