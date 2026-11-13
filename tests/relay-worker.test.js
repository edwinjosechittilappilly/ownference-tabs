import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { fileURLToPath } from 'node:url';

const workerPath = fileURLToPath(new URL('../src/relay-worker.js', import.meta.url));
const source = readFileSync(workerPath, 'utf8');
const grant = { origin: 'https://example.test', documentId: 'document-1' };
const sender = { tab: { id: 7 }, frameId: 0, documentId: grant.documentId, origin: grant.origin, url: `${grant.origin}/page` };
const popup = { id: 'extension', url: 'chrome-extension://extension/popup.html' };
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

function event() {
  const listeners = [];
  return { addListener: listener => listeners.push(listener), emit: (...args) => listeners.map(listener => listener(...args)) };
}
function port(senderInfo = sender, name = 'ownference-relay-v1') {
  return {
    name, sender: senderInfo, messages: [], disconnected: false,
    onMessage: event(), onDisconnect: event(),
    postMessage(message) { this.messages.push(structuredClone(message)); },
    disconnect() { if (!this.disconnected) { this.disconnected = true; this.onDisconnect.emit(); } }
  };
}
function harness({ stored = { 7: grant }, delayed = false, nativeFails = false } = {}) {
  const session = { relayGrants: structuredClone(stored) };
  let resolveRead;
  const read = delayed ? new Promise(resolve => { resolveRead = () => resolve(structuredClone(session)); }) : Promise.resolve(structuredClone(session));
  const nativePorts = [];
  const timers = new Map();
  let timerId = 0;
  const runtime = {
    id: 'extension', getURL: path => `chrome-extension://extension/${path}`,
    onMessage: event(), onConnect: event(),
    connectNative(name) {
      assert.equal(name, 'com.ownference.bridge');
      if (nativeFails) throw new Error('host missing');
      const native = port(); nativePorts.push(native); return native;
    }
  };
  const tabs = { onUpdated: event(), onRemoved: event(), get: async id => ({ id, active: true, url: `${grant.origin}/page` }) };
  const scripting = { executeScript: async options => options.files ? [{ documentId: grant.documentId }] : [{ result: grant.origin }] };
  const chrome = {
    runtime, tabs, scripting,
    storage: { session: {
      get: () => read,
      set: async values => Object.assign(session, structuredClone(values)),
      remove: async key => { delete session[key]; }
    } }
  };
  runInNewContext(source, { chrome, URL, TextEncoder, structuredClone, crypto: { randomUUID: () => 'cancel-id' }, setTimeout: fn => { timers.set(++timerId, fn); return timerId; }, clearTimeout: id => timers.delete(id) }, { filename: workerPath });
  const connect = (identity = sender, name) => { const p = port(identity, name); runtime.onConnect.emit(p); return p; };
  const action = message => new Promise(resolve => runtime.onMessage.emit(message, popup, resolve));
  return { chrome, session, nativePorts, timers, connect, action, resolveRead };
}

test('restored grant authorizes only the exact top-level document identity', async () => {
  const h = harness();
  await flush();
  const good = h.connect();
  await flush();
  assert.equal(good.messages[0]?.type, 'ready');
  assert.equal(h.nativePorts.length, 1);
  for (const identity of [
    { ...sender, tab: { id: 8 } }, { ...sender, frameId: 1 },
    { ...sender, documentId: 'other' }, { ...sender, documentId: undefined },
    { ...sender, origin: 'https://other.test' }, { ...sender, url: 'https://other.test/' },
    { ...sender, url: 'not a url' }
  ]) {
    const denied = h.connect(identity); await flush();
    assert.equal(denied.messages[0]?.error?.code, 'permission_denied');
    assert.equal(denied.disconnected, true);
  }
  assert.equal(h.nativePorts.length, 1);
  const ignored = h.connect(sender, 'unrelated'); await flush();
  assert.equal(ignored.messages.length, 0);
});

test('port authorization waits for asynchronous session restore', async () => {
  const h = harness({ delayed: true });
  const p = h.connect();
  await flush();
  assert.equal(p.messages.length, 0);
  assert.equal(h.nativePorts.length, 0);
  h.resolveRead(); await flush();
  assert.equal(p.messages[0]?.type, 'ready');
  assert.equal(h.nativePorts.length, 1);
});

test('navigation, tab removal and explicit revoke remove restored grants', async () => {
  for (const kind of ['navigation', 'removed', 'revoke', 'revoke-all']) {
    const h = harness(); await flush();
    const p = h.connect(); await flush();
    if (kind === 'navigation') h.chrome.tabs.onUpdated.emit(7, { status: 'loading' });
    if (kind === 'removed') h.chrome.tabs.onRemoved.emit(7);
    if (kind === 'revoke' || kind === 'revoke-all') assert.equal((await h.action({ relayAction: kind, tabId: 7 })).ok, true);
    await flush();
    assert.equal(p.disconnected, true, kind);
    assert.equal(p.messages.at(-1).error.code, 'permission_denied');
    assert.equal(h.session.relayGrants[7], undefined);
    const denied = h.connect(); await flush();
    assert.equal(denied.messages[0]?.error?.code, 'permission_denied');
  }
});

test('navigation during restore revokes the persisted document', async () => {
  const h = harness({ delayed: true });
  h.chrome.tabs.onUpdated.emit(7, { status: 'loading' });
  h.resolveRead(); await flush();
  const p = h.connect(); await flush();
  assert.equal(p.messages[0]?.error?.code, 'permission_denied');
  assert.equal(h.session.relayGrants[7], undefined);
});

test('malformed stored grants do not authorize a port', async () => {
  for (const stored of [{ 7: { origin: 'null', documentId: 'document-1' } }, { 7: { origin: grant.origin } }, { 7: null }]) {
    const h = harness({ stored }); await flush();
    const p = h.connect(); await flush();
    assert.equal(p.messages[0]?.error?.code, 'permission_denied');
    assert.equal(h.nativePorts.length, 0);
  }
});

test('restart restores session grant with a fresh native connection and never replays work', async () => {
  const first = harness(); await flush();
  const old = first.connect(); await flush();
  old.onMessage.emit({ id: 'old', op: 'models' });
  assert.equal(first.nativePorts[0].messages.length, 1);
  const restarted = harness({ stored: first.session.relayGrants }); await flush();
  const fresh = restarted.connect(); await flush();
  assert.equal(fresh.messages[0]?.type, 'ready');
  assert.equal(restarted.nativePorts.length, 1);
  assert.deepEqual(restarted.nativePorts[0].messages, []);
  fresh.onMessage.emit({ id: 'new', op: 'models' });
  assert.equal(restarted.nativePorts[0].messages[0].id, 'new');
});

test('relay forwards valid requests and terminal responses, enforcing IDs and limits', async () => {
  const h = harness(); await flush();
  const p = h.connect(); await flush();
  const native = h.nativePorts[0];
  p.onMessage.emit(null);
  p.onMessage.emit({ id: '', op: 'models' });
  p.onMessage.emit({ id: 'ignored', op: 'unknown' });
  p.onMessage.emit({ id: 'bad', op: 'generate', input: { model: 'm' } });
  assert.equal(p.messages.at(-1).error.code, 'invalid_request');
  p.onMessage.emit({ id: 'one', op: 'models' });
  p.onMessage.emit({ id: 'two', op: 'generate', input: { model: 'm', task: 'summarize', text: 'hello', instruction: 'brief', ignored: 'secret' } });
  assert.deepEqual(native.messages[1].input, { model: 'm', task: 'summarize', text: 'hello', instruction: 'brief' });
  p.onMessage.emit({ id: 'three', op: 'models' });
  assert.equal(p.messages.at(-1).error.code, 'busy');
  native.onMessage.emit({ v: 2, id: 'one', event: 'models' });
  native.onMessage.emit({ v: 1, id: 'missing', event: 'done' });
  native.onMessage.emit({ v: 1, id: 'one', event: 'unknown' });
  native.onMessage.emit({ v: 1, id: 'two', event: 'delta', text: 'hi' });
  assert.equal(p.messages.at(-1).event, 'delta');
  native.onMessage.emit({ v: 1, id: 'one', event: 'models', models: [] });
  p.onMessage.emit({ id: 'one', op: 'models' });
  assert.equal(p.messages.at(-1).error.code, 'invalid_request');
  p.onMessage.emit({ id: 'cancel', op: 'cancel', target: 'two' });
  assert.equal(native.messages.at(-1).op, 'cancel');
  assert.equal(native.messages.at(-1).target, 'two');
  native.onMessage.emit({ v: 1, id: 'two', event: 'done' });
  assert.equal(h.timers.size, 0);
});

test('timeouts, disconnects and stop cancel outstanding requests', async () => {
  const h = harness(); await flush();
  const p = h.connect(); await flush();
  const native = h.nativePorts[0];
  p.onMessage.emit({ id: 'timeout', op: 'models' });
  const timeout = [...h.timers.values()][0]; timeout();
  assert.equal(p.messages.at(-1).error.code, 'timeout');
  assert.equal(native.messages.at(-1).target, 'timeout');
  p.onMessage.emit({ id: 'pending', op: 'models' });
  assert.equal((await h.action({ relayAction: 'stop' })).ok, true);
  assert.equal(native.messages.at(-1).target, 'pending');
  assert.equal(p.messages.at(-1).error.code, 'cancelled');
  assert.equal(p.disconnected, true);
  const p2 = h.connect(); await flush();
  h.nativePorts[1].disconnect();
  assert.equal(p2.messages.at(-1).error.code, 'native_unavailable');
});

test('popup actions require extension identity and validate enable requests', async () => {
  const h = harness({ stored: {} }); await flush();
  let called = false;
  h.chrome.runtime.onMessage.emit({ relayAction: 'enable', tabId: 7, origin: grant.origin }, { ...popup, url: 'https://example.test' }, () => { called = true; });
  await flush(); assert.equal(called, false);
  assert.equal((await h.action({ relayAction: 'enable' })).ok, false);
  assert.equal((await h.action({ relayAction: 'unknown', tabId: 7 })).ok, false);
  assert.equal((await h.action({ relayAction: 'enable', tabId: 7, origin: 'https://other.test' })).ok, false);
  assert.equal((await h.action({ relayAction: 'enable', tabId: 7, origin: grant.origin })).ok, true);
  assert.equal(h.session.relayGrants[7].documentId, grant.documentId);
  const p = h.connect(); await flush(); assert.equal(p.messages[0]?.type, 'ready');
});

test('native connection failure is reported without authorizing a client', async () => {
  const h = harness({ nativeFails: true }); await flush();
  const p = h.connect(); await flush();
  assert.equal(p.messages[0]?.error?.code, 'native_unavailable');
  assert.equal(p.disconnected, true);
});
