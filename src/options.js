const $ = id => document.getElementById(id);
const origin = `chrome-extension://${chrome.runtime.id}`;
$('command').textContent = `ownmode grant --origin ${origin}`;
$('native-command').textContent = `ownmode native install --extension-id ${chrome.runtime.id}`;
$('copy-native-command').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText($('native-command').textContent); $('native-copy-status').textContent = 'Install command copied.'; }
  catch { $('native-copy-status').textContent = 'Select and copy the install command above.'; }
});
$('copy-command').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText($('command').textContent); $('status').textContent = 'Command copied.'; }
  catch { $('status').textContent = 'Select and copy the command above.'; }
});
$('save').addEventListener('click', async () => {
  const token = $('token').value.trim();
  if (!token) { $('status').textContent = 'Paste a token first.'; return; }
  await chrome.storage.session.set({ token });
  $('token').value = '';
  $('status').textContent = 'Saved for this browser session. Reopen the popup to load models.';
});
$('clear').addEventListener('click', async () => { await chrome.storage.session.remove('token'); $('token').value = ''; $('status').textContent = 'Session token forgotten.'; });
chrome.storage.session.get('token').then(({ token }) => { $('status').textContent = token ? 'A session token is saved. Paste a replacement to change it.' : 'No token saved yet.'; });
