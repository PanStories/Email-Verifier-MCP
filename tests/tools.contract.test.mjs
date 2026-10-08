/**
 * MCP tool contract test — network-free.
 *
 * Satisfies M8ven's "0/N tools referenced in tests" finding and enforces that every
 * tool declares the four MCP hints (OpenAI's MCP directory hard-rejects tools missing
 * any hint). Only calls tools/list over an in-memory transport — no network.
 *
 * Run: node --test tests/tools.contract.test.mjs   (after `npm run build`)
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { buildServer } from '../dist/server.js';

const EXPECTED_TOOLS = ['check_email', 'verify_bulk', 'check_mx', 'is_disposable'];
const HINTS = ['readOnlyHint', 'destructiveHint', 'idempotentHint', 'openWorldHint'];
// DNS-backed tools touch the open world; is_disposable is a pure local lookup.
const OPEN_WORLD = new Set(['check_email', 'verify_bulk', 'check_mx']);

async function connectPair() {
  const [clientT, serverT] = InMemoryTransport.createLinkedPair();
  const server = buildServer();
  await server.connect(serverT);
  const client = new Client({ name: 'contract-test', version: '0.0.0' });
  await client.connect(clientT);
  return client;
}

test('exposes all expected tools', async () => {
  const client = await connectPair();
  const { tools } = await client.listTools();
  const names = tools.map((t) => t.name);
  for (const expected of EXPECTED_TOOLS) {
    assert.ok(names.includes(expected), `expected tool ${expected} to be listed`);
  }
  assert.equal(names.length, EXPECTED_TOOLS.length, 'tool count matches');
  await client.close();
});

test('every tool declares all four boolean hints with honest values', async () => {
  const client = await connectPair();
  const { tools } = await client.listTools();
  for (const tool of tools) {
    const annotations = tool.annotations;
    assert.ok(annotations, `${tool.name} must declare annotations`);
    for (const hint of HINTS) {
      assert.equal(typeof annotations?.[hint], 'boolean', `${tool.name}.${hint} must be an explicit boolean`);
    }
    assert.equal(annotations?.readOnlyHint, true, `${tool.name} should be readOnlyHint: true`);
    assert.equal(annotations?.destructiveHint, false, `${tool.name} should be destructiveHint: false`);
    assert.equal(annotations?.idempotentHint, true, `${tool.name} should be idempotentHint: true`);
    assert.equal(
      annotations?.openWorldHint,
      OPEN_WORLD.has(tool.name),
      `${tool.name} openWorldHint should be ${OPEN_WORLD.has(tool.name)}`,
    );
  }
  await client.close();
});

test('unknown tool call is rejected (protocol resilience)', async () => {
  const client = await connectPair();
  // MCP may either reject the call or return an isError result — both are fine.
  const res = await client.callTool({ name: 'definitely_not_a_tool', arguments: {} }).catch(() => null);
  assert.ok(res === null || res?.isError === true, 'unknown tool must error, not succeed silently');
  await client.close();
});
