const GRANTS = 'relayGrants';
const clients = new Set();
const MAX_TOTAL = 8;
const MAX_SITE = 2;
const DEADLINE = 120000;
let grants = {};
let total = 0;
// Grants survive worker idleness, but browser session storage is cleared on restart.
// Ports and in-flight requests are never restored or replayed.
const initialized = chrome.storage.session.get(GRANTS).then(data => {
  const stored = data[GRANTS];
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return;
  for (const [tabId, grant] of Object.entries(stored)) {
    if (!/^(0|[1-9]\d*)$/.test(tabId) || !Number.isSafeInteger(Number(tabId)) || !grant || typeof grant.origin !== 'string' || typeof grant.documentId !== 'string' || !grant.documentId) continue;
    try {
      const url = new URL(grant.origin);
      if ((url.protocol === 'http:' || url.protocol === 'https:') && url.origin === grant.origin) grants[tabId] = { origin: grant.origin, documentId: grant.documentId };
    } catch { /* Invalid saved grants cannot authorize a document. */ }
  }
}).catch(() => { grants = {}; });
let saving = Promise.resolve();
const save = () => {
  const snapshot = structuredClone(grants);
  const result = saving.then(() => chrome.storage.session.set({ [GRANTS]: snapshot }));
  saving = result.catch(() => {});
  return result;
};
const fail = (code, message) => ({ code, message });

function closeClient(client, reason) {
  if (client.closed) return;
  client.closed = true;
  for (const [id, timer] of client.pending) {
    clearTimeout(timer);
    total--;
    try { client.native.postMessage({ v: 1, id: crypto.randomUUID(), op: 'cancel', target: id }); } catch { /* host already disconnected */ }
  }
  client.pending.clear();
  if (reason) { try { client.port.postMessage({ type: 'error', error: reason }); } catch { /* page gone */ } }
  try { client.native?.disconnect(); } catch { /* already closed */ }
  try { client.port.disconnect(); } catch { /* already closed */ }
  clients.delete(client);
}
function closeMatching(predicate, reason) {
  for (const client of clients) if (predicate(client)) closeClient(client, reason);
}
async function revoke(tabId) {
  delete grants[tabId];
  closeMatching(client => client.tabId === tabId, fail('permission_denied', 'Relay permission was revoked.'));
  await save();
}
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id || sender.url !== chrome.runtime.getURL('popup.html') || !message?.relayAction) return;
  (async () => {
    await initialized;
    const action = message.relayAction;
    if (action === 'stop') {
      closeMatching(() => true, fail('cancelled', 'Relay work stopped.'));
      return 'Relay work stopped.';
    }
    if (action === 'revoke-all') {
      grants = {};
      closeMatching(() => true, fail('permission_denied', 'Relay permissions were revoked.'));
      await save();
      return 'All relay grants revoked.';
    }
    if (!Number.isInteger(message.tabId)) throw new Error('No active tab.');
    if (action === 'revoke') { await revoke(message.tabId); return 'Relay permission revoked for this tab.'; }
    if (action !== 'enable') throw new Error('Unknown relay action.');
    const tab = await chrome.tabs.get(message.tabId);
    const origin = new URL(tab.url).origin;
    if (!tab.active || origin !== message.origin || !/^https?:/.test(tab.url) || origin === 'null') throw new Error('The active tab changed. Open an HTTP or HTTPS page and try again.');
    await revoke(tab.id);
    const results = await chrome.scripting.executeScript({ target: { tabId: tab.id, frameIds: [0] }, files: ['src/relay-content.js'] });
    const documentId = results[0]?.documentId;
    if (!documentId) throw new Error('Chrome did not identify this document; relay cannot be enabled safely.');
    const [identity] = await chrome.scripting.executeScript({ target: { tabId: tab.id, documentIds: [documentId] }, func: () => location.origin });
    if (identity?.result !== origin) throw new Error('The page changed while enabling relay. Try again.');
    grants[tab.id] = { origin, documentId };
    await save();
    return `Relay enabled for ${origin} in this document.`;
  })().then(message => respond({ ok: true, message }), error => respond({ ok: false, error: error.message }));
  return true;
});
chrome.tabs.onUpdated.addListener((tabId, change) => { if (change.status === 'loading') void initialized.then(() => grants[tabId] && revoke(tabId)).catch(() => {}); });
chrome.tabs.onRemoved.addListener(tabId => { void initialized.then(() => grants[tabId] && revoke(tabId)).catch(() => {}); });

chrome.runtime.onConnect.addListener(port => {
  if (port.name !== 'ownmode-relay-v1') return;
  let disconnected = false;
  port.onDisconnect.addListener(() => { disconnected = true; });
  void initialized.then(() => {
  if (disconnected) return;
  const sender = port.sender;
  const tabId = sender?.tab?.id;
  const grant = grants[tabId];
  let origin;
  try { origin = new URL(sender.url).origin; } catch { /* deny */ }
  if (!grant || sender.frameId !== 0 || !sender.documentId || sender.documentId !== grant.documentId || origin !== grant.origin || sender.origin !== grant.origin) {
    port.postMessage({ type: 'error', error: fail('permission_denied', 'Enable relay for this tab in OwnMode Browser first.') });
    port.disconnect();
    return;
  }
  let native;
  try { native = chrome.runtime.connectNative('com.ownmode.bridge'); } catch {
    port.postMessage({ type: 'error', error: fail('native_unavailable', 'Open OwnMode Browser Setup to install the native host, then start the bridge.') });
    port.disconnect();
    return;
  }
  const client = { port, native, tabId, origin, pending: new Map(), seen: new Set(), closed: false };
  clients.add(client);
  native.onDisconnect.addListener(() => closeClient(client, fail('native_unavailable', 'Native host disconnected. Open OwnMode Browser Setup to install the native host and start the bridge.')));
  native.onMessage.addListener(message => {
    if (message?.v !== 1 || !client.pending.has(message.id)) return;
    if (!['models', 'delta', 'done', 'error'].includes(message.event)) return;
    if (message.event !== 'delta') {
      clearTimeout(client.pending.get(message.id));
      client.pending.delete(message.id);
      total--;
    }
    try { port.postMessage(message); } catch { closeClient(client); }
  });
  port.onDisconnect.addListener(() => closeClient(client));
  port.onMessage.addListener(message => {
    if (client.closed || !message || typeof message.id !== 'string' || message.id.length < 1 || message.id.length > 128) return;
    if (message.op === 'cancel') {
      if (typeof message.target === 'string' && client.pending.has(message.target)) {
        try { native.postMessage({ v: 1, id: crypto.randomUUID(), op: 'cancel', target: message.target }); } catch { closeClient(client, fail('native_unavailable', 'Native host disconnected. See OwnMode Browser Setup.')); }
      }
      return;
    }
    if (!['models', 'generate'].includes(message.op)) return;
    if (client.seen.has(message.id) || client.seen.size >= 4096) {
      port.postMessage({ id: message.id, event: 'error', error: fail('invalid_request', 'Request IDs must be unique within a connection.') });
      return;
    }
    client.seen.add(message.id);
    const siteCount = [...clients].filter(other => other.origin === origin).reduce((sum, other) => sum + other.pending.size, 0);
    if (total >= MAX_TOTAL || siteCount >= MAX_SITE) {
      port.postMessage({ id: message.id, event: 'error', error: fail('busy', 'Relay concurrency limit reached.') });
      return;
    }
    if (message.op === 'generate' && (!message.input || typeof message.input !== 'object' || typeof message.input.model !== 'string' || message.input.model.length > 512 || typeof message.input.task !== 'string' || message.input.task.length > 32 || typeof message.input.text !== 'string' || message.input.text.length > 24000 || (message.input.instruction !== undefined && (typeof message.input.instruction !== 'string' || message.input.instruction.length > 2000)))) {
      port.postMessage({ id: message.id, event: 'error', error: fail('invalid_request', 'Invalid generation input or input exceeds relay limits.') });
      return;
    }
    const timer = setTimeout(() => {
      if (!client.pending.delete(message.id)) return;
      total--;
      try { native.postMessage({ v: 1, id: crypto.randomUUID(), op: 'cancel', target: message.id }); port.postMessage({ id: message.id, event: 'error', error: fail('timeout', 'Relay request exceeded its deadline.') }); } catch { closeClient(client); }
    }, DEADLINE);
    client.pending.set(message.id, timer);
    total++;
    const input = message.op === 'generate' ? { model: message.input.model, task: message.input.task, text: message.input.text, ...(message.input.instruction !== undefined ? { instruction: message.input.instruction } : {}) } : undefined;
    const wire = message.op === 'models' ? { v: 1, id: message.id, op: 'models' } : { v: 1, id: message.id, op: 'generate', input };
    if (new TextEncoder().encode(JSON.stringify(wire)).byteLength > 128 * 1024) {
      clearTimeout(timer); client.pending.delete(message.id); total--;
      port.postMessage({ id: message.id, event: 'error', error: fail('invalid_request', 'Generation input exceeds the native message limit.') });
      return;
    }
    try { native.postMessage(wire); }
    catch { closeClient(client, fail('native_unavailable', 'Native host disconnected. See OwnMode Browser Setup.')); }
  });
  port.postMessage({ type: 'ready' });
  });
});
