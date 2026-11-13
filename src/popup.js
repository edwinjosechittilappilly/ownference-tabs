import { listModels, generate } from './client.js';
const $ = id => document.getElementById(id);
let controller, output = '';
const status = message => { $('status').textContent = message; };
const token = async () => (await chrome.storage.session.get('token')).token || '';

async function relayTab() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab?.id || !/^https?:$/.test(new URL(tab.url).protocol)) throw new Error('Open an HTTP or HTTPS page first.');
  return tab;
}
async function relayAction(action) {
  try {
    const tab = action === 'revoke-all' || action === 'stop' ? null : await relayTab();
    const response = await chrome.runtime.sendMessage({ relayAction: action, tabId: tab?.id, origin: tab ? new URL(tab.url).origin : undefined });
    if (!response?.ok) throw new Error(response?.error || 'Relay unavailable.');
    $('relay-status').textContent = response.message;
  } catch (error) { $('relay-status').textContent = error.message; }
}
for (const action of ['enable', 'revoke', 'revoke-all', 'stop']) $('relay-' + action).addEventListener('click', () => relayAction(action));
relayTab().then(tab => { $('relay-origin').textContent = new URL(tab.url).origin; }).catch(() => { $('relay-origin').textContent = 'Open an HTTP or HTTPS page to enable relay.'; });

async function loadModels() {
  const secret = await token();
  if (!secret) { status('Open Setup to authorize this extension and save your session token.'); return; }
  try {
    const models = await listModels(secret);
    $('model').replaceChildren();
    if (!models.length) { $('model').add(new Option('No local models available', '')); status('No models available. Start Ollama and pull a model.'); return; }
    for (const model of models) $('model').add(new Option(model.name, model.id));
    status('Connected. Review your text before generating.');
  } catch (error) { status(error.message); }
}

$('capture').addEventListener('click', async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab?.id || !/^https?:/.test(tab.url || '')) throw new Error('Open a regular HTTP or HTTPS page and try again. Chrome internal pages cannot be read.');
    const [result] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => {
      const active = document.activeElement;
      let selected = '';
      if (active instanceof HTMLInputElement) {
        if (active.type === 'password') return { refused: 'password' };
        if (['text', 'search', 'url', 'tel'].includes(active.type) && active.selectionStart !== null) selected = active.value.slice(active.selectionStart, active.selectionEnd);
      } else if (active instanceof HTMLTextAreaElement && active.selectionStart !== null) selected = active.value.slice(active.selectionStart, active.selectionEnd);
      if (!selected) selected = window.getSelection()?.toString() || '';
      return { text: selected || document.body?.innerText || '', selection: !!selected, title: document.title, origin: location.origin };
    } });
    const data = result.result;
    if (data?.refused === 'password') throw new Error('Password fields are never read. Focus another part of the page and try again.');
    if (!data?.text.trim()) throw new Error('No readable text found on this page.');
    $('text').value = data.text.slice(0, 24000);
    $('source').textContent = `${data.selection ? 'Selection' : 'Page text'} · ${data.title || 'Untitled'} · ${data.origin}${data.text.length > 24000 ? ' · truncated to 24,000 characters' : ''}`;
    status('Review and edit the preview. Nothing is sent until you generate.');
  } catch (error) { status(`Could not read this page: ${error.message}`); }
});
$('generate').addEventListener('click', async () => {
  if (controller) return;
  const secret = await token();
  if (!secret) { status('Open Setup and save your session token first.'); return; }
  const text = $('text').value;
  if (!text.trim() || !$('model').value) { status('Add text and choose an available model first.'); return; }
  controller = new AbortController(); $('generate').disabled = true; $('cancel').disabled = false;
  output = ''; $('output').textContent = ''; $('copy').disabled = true; $('download').disabled = true;
  status('Generating locally… Keep this popup open.');
  try {
    await generate(secret, { model: $('model').value, task: $('task').value, text, instruction: $('instruction').value }, delta => { output += delta; $('output').textContent = output; }, controller.signal);
    status('Done. Review the result before using it.');
  } catch (error) { status(error.name === 'AbortError' ? 'Cancelled.' : error.message); }
  finally { controller = null; $('generate').disabled = false; $('cancel').disabled = true; $('copy').disabled = !output; $('download').disabled = !output; }
});
$('cancel').addEventListener('click', () => controller?.abort());
$('copy').addEventListener('click', async () => { try { await navigator.clipboard.writeText(output); status('Copied result.'); } catch { status('Copy failed; select the result and copy it manually.'); } });
$('download').addEventListener('click', () => { const url = URL.createObjectURL(new Blob([output], { type: 'text/plain;charset=utf-8' })); const a = document.createElement('a'); a.href = url; a.download = 'ownference-result.txt'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); });
loadModels();
