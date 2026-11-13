import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { generate, listModels } from '../src/client.js';
const original = globalThis.fetch;
afterEach(() => { globalThis.fetch = original; });
function stream(parts) { return new Response(new ReadableStream({ start(c) { for (const part of parts) c.enqueue(new TextEncoder().encode(part)); c.close(); } }), { headers: { 'Content-Type': 'application/x-ndjson' } }); }
test('handles arbitrary stream boundaries and unicode', async () => {
  const bytes = new TextEncoder().encode('{"type":"delta","text":"héllo"}\n{"type":"done"}\n');
  globalThis.fetch = async () => new Response(new ReadableStream({ start(c) { for (const byte of bytes) c.enqueue(Uint8Array.of(byte)); c.close(); } }), { headers: { 'Content-Type': 'application/x-ndjson' } });
  let result = ''; await generate('secret', {}, s => result += s); assert.equal(result, 'héllo');
});
test('rejects malformed, missing terminal and trailing frames', async () => {
  for (const wire of ['bad\n', '{"type":"delta","text":"x"}\n', '{"type":"done"}\n{"type":"done"}\n']) {
    globalThis.fetch = async () => stream([wire]);
    await assert.rejects(generate('secret', {}, () => {}), { code: 'invalid_response' });
  }
});
test('exposes structured errors without inventing success', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ error: { code: 'unauthorized', message: 'Access denied' } }), { status: 401 });
  await assert.rejects(listModels('bad'), { code: 'unauthorized', message: 'Access denied' });
  globalThis.fetch = async () => stream(['{"type":"error","error":{"code":"offline","message":"Model offline"}}\n']);
  await assert.rejects(generate('x', {}, () => {}), { code: 'offline', message: 'Model offline' });
});
test('network failures and cancellation stay distinct', async () => {
  globalThis.fetch = async () => { throw new TypeError('network'); };
  await assert.rejects(listModels('x'), { code: 'unreachable' });
  globalThis.fetch = async () => { throw new DOMException('aborted', 'AbortError'); };
  await assert.rejects(generate('x', {}, () => {}), { name: 'AbortError' });
});
