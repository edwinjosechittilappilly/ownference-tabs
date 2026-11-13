// Live acceptance: actual unpacked MV3 extension, actual Ownference bridge and Ollama.
import { chromium } from 'playwright';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const bridge = resolve(root, '../ownference/src/cli.js');
const manifest = JSON.parse(await readFile(join(root, 'manifest.json')));
const hex = createHash('sha256').update(Buffer.from(manifest.key, 'base64')).digest('hex').slice(0, 32);
const id = [...hex].map(n => String.fromCharCode(97 + parseInt(n, 16))).join('');
const origin = `chrome-extension://${id}`;
const temp = await mkdtemp(join(tmpdir(), 'ownference-tabs-e2e-'));
let browser, server, fixture;
try {
  const grant = execFileSync(process.execPath, [bridge, 'grant', '--origin', origin, '--config-dir', join(temp, 'config')], { encoding: 'utf8' });
  const token = grant.trim().split('\n').at(-1);
  assert.match(token, /^[\w-]{30,}$/);
  server = spawn(process.execPath, [bridge, 'serve', '--config-dir', join(temp, 'config')], { stdio: 'inherit' });
  fixture = spawn(process.execPath, [join(root, 'fixture/server.js')], { stdio: 'inherit' });
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null || fixture.exitCode !== null) throw new Error('Bridge or fixture failed to start; ensure ports 3210 and 4175 are free.');
    await new Promise(resolve => setTimeout(resolve, 100));
    try { const [bridgeResponse, fixtureResponse] = await Promise.all([fetch('http://127.0.0.1:3210/health'), fetch('http://127.0.0.1:4175/')]); if (bridgeResponse.ok && fixtureResponse.ok) break; } catch { /* Retry only while the spawned servers are starting. */ }
    if (i === 99) throw new Error('Bridge did not start.');
  }
  // Extension debugging is enabled only in this disposable test profile; normal web security stays enabled.
  browser = await chromium.launchPersistentContext(join(temp, 'profile'), { headless: process.env.HEADLESS === '1', args: ['--enable-unsafe-extension-debugging', `--disable-extensions-except=${root}`, `--load-extension=${root}`] });
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:4175/');
  const source = await page.locator('#source').innerText();
  const options = await browser.newPage();
  await options.goto(`${origin}/options.html`);
  assert.match(await options.locator('#command').innerText(), new RegExp(id));
  await options.locator('#token').fill(token);
  await options.locator('#save').click();
  await options.locator('#status').getByText('Saved', { exact: false }).waitFor();
  await page.bringToFront();
  await page.locator('#source').evaluate(element => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  });
  const cdp = await browser.browser().newBrowserCDPSession();
  const { targetInfos } = await cdp.send('Target.getTargets', { filter: [{ type: 'tab', exclude: false }, { exclude: true }] });
  const targetInfo = targetInfos.find(target => target.url === page.url());
  assert.ok(targetInfo, 'The fixture must have a browser tab target for extension invocation.');
  await cdp.send('Extensions.triggerAction', { id, targetId: targetInfo.targetId });
  // Chrome does not expose its transient toolbar popup as a Playwright Page.
  // The real action above grants activeTab; exercise the identical popup document in a tab.
  const popup = await browser.newPage();
  await popup.goto(`${origin}/popup.html`);
  await page.bringToFront();
  await popup.locator('#capture').click();
  await popup.waitForFunction(expected => document.querySelector('#text').value === expected, source);
  assert.equal(await popup.locator('#text').inputValue(), source);
  assert.match(await popup.locator('#source').innerText(), /Selection · Ownference Tabs fixture · http:\/\/127\.0\.0\.1:4175/);
  await popup.waitForFunction(() => [...document.querySelector('#model').options].some(option => option.value.startsWith('ollama:')), null, { timeout: 30000 });
  const model = process.env.OLLAMA_MODEL || 'ollama:llama3.2:latest';
  await popup.locator('#model').selectOption(model);
  await popup.locator('#generate').click();
  await popup.getByRole('status').filter({ hasText: 'Done.' }).waitFor({ timeout: 180000 });
  const generated = await popup.locator('#output').innerText();
  assert.match(generated, /garden|volunteer|harvest/i, 'A summary should retain a fact from the selected garden text.');
  assert.equal(await popup.locator('#copy').isEnabled(), true);
  assert.equal(await popup.locator('#download').isEnabled(), true);
  const downloadPromise = popup.waitForEvent('download');
  await popup.locator('#download').click();
  const download = await downloadPromise;
  const downloaded = join(temp, 'result.txt');
  await download.saveAs(downloaded);
  assert.equal(await readFile(downloaded, 'utf8'), generated);
  if (process.env.OWNFERENCE_SCREENSHOT) await popup.screenshot({ path: process.env.OWNFERENCE_SCREENSHOT, fullPage: true });
  await page.bringToFront();
  await page.locator('#password').focus();
  await popup.locator('#capture').click();
  await popup.waitForFunction(() => document.querySelector('#status').textContent.includes('Password fields are never read.'));
  assert.equal(await popup.locator('#text').inputValue(), source, 'Refused capture must not replace the approved preview.');
  assert.doesNotMatch(await popup.locator('#text').inputValue(), /fixture-secret-never-capture/);
  console.log(`PASS: real extension action, activeTab capture, bridge and ${model} produced a result`);
} finally {
  try { await browser?.close(); } finally {
    await Promise.all([server, fixture].filter(child => child && child.exitCode === null && child.signalCode === null).map(child => new Promise(resolve => { child.once('exit', resolve); child.kill(); })));
  }
  await rm(temp, { recursive: true, force: true });
}
