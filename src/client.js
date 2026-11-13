export const BRIDGE = 'http://127.0.0.1:3210';

export class BridgeError extends Error {
  constructor(code, message) { super(message); this.name = 'BridgeError'; this.code = code; }
}

async function request(path, token, options = {}) {
  let response;
  try {
    response = await fetch(`${BRIDGE}${path}`, { ...options, headers: { Authorization: `Bearer ${token}`, ...options.headers } });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new BridgeError('unreachable', 'Cannot reach Ownference at 127.0.0.1:3210. Start the bridge and check Chrome’s local network access.');
  }
  if (!response.ok) {
    let data;
    try { data = await response.json(); } catch { /* A proxy or server may return non-JSON. */ }
    throw new BridgeError(typeof data?.error?.code === 'string' ? data.error.code : 'http_error', typeof data?.error?.message === 'string' ? data.error.message : `Bridge request failed (${response.status}).`);
  }
  return response;
}

export async function listModels(token) {
  const response = await request('/v1/models', token);
  const data = await response.json();
  if (!Array.isArray(data.models)) throw new BridgeError('invalid_response', 'The bridge returned an invalid model list.');
  return data.models.filter(model => typeof model.id === 'string' && typeof model.name === 'string');
}

export async function generate(token, input, onDelta, signal) {
  const response = await request('/v1/generate', token, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal });
  if (!response.body || !response.headers.get('content-type')?.toLowerCase().startsWith('application/x-ndjson')) throw new BridgeError('invalid_response', 'The bridge did not return a generation stream.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let pending = '', done = false;
  function frame(line) {
    if (!line.trim()) return;
    if (done) throw new BridgeError('invalid_response', 'Unexpected data after generation completed.');
    let item;
    try { item = JSON.parse(line); } catch { throw new BridgeError('invalid_response', 'The bridge returned a malformed stream.'); }
    if (item?.type === 'delta' && typeof item.text === 'string') onDelta(item.text);
    else if (item?.type === 'done') done = true;
    else if (item?.type === 'error' && typeof item.error?.message === 'string') throw new BridgeError(typeof item.error.code === 'string' ? item.error.code : 'generation_failed', item.error.message);
    else throw new BridgeError('invalid_response', 'The bridge returned an unknown stream event.');
  }
  try {
    while (true) {
      const chunk = await reader.read();
      pending += decoder.decode(chunk.value, { stream: !chunk.done });
      let index;
      while ((index = pending.indexOf('\n')) !== -1) { frame(pending.slice(0, index)); pending = pending.slice(index + 1); }
      if (pending.length > 1024 * 1024) throw new BridgeError('invalid_response', 'The bridge returned an oversized stream frame.');
      if (chunk.done) break;
    }
    if (pending.trim()) frame(pending);
    if (!done) throw new BridgeError('invalid_response', 'The generation stream ended before completion.');
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
