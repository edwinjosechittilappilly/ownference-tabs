// Live acceptance: actual unpacked MV3 extension, actual Ownference bridge and Ollama.
import { chromium } from 'playwright';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import https from 'node:https';
import { createServer as createWorkspace } from '../../ownference-web/server.js';
import { installNative, uninstallNative } from '../../ownference/src/native.js';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const bridge = resolve(root, '../ownference/src/cli.js');
const manifest = JSON.parse(await readFile(join(root, 'manifest.json')));
const hex = createHash('sha256').update(Buffer.from(manifest.key, 'base64')).digest('hex').slice(0, 32);
const id = [...hex].map(n => String.fromCharCode(97 + parseInt(n, 16))).join('');
const origin = `chrome-extension://${id}`;
const temp = await mkdtemp(join(tmpdir(), 'ownference-tabs-e2e-'));
const manifestDir = join(temp, 'profile', 'NativeMessagingHosts');
const nativeOptions = { extensionId: id, configDir: join(temp, 'config'), manifestDir };
let browser, server, fixture, workspaceTLS, nativeInstalled = false;
try {
  const grant = execFileSync(process.execPath, [bridge, 'grant', '--origin', origin, '--config-dir', join(temp, 'config')], { encoding: 'utf8' });
  const token = grant.trim().split('\n').at(-1);
  assert.match(token, /^[\w-]{30,}$/);
  server = spawn(process.execPath, [bridge, 'serve', '--config-dir', join(temp, 'config')], { stdio: 'inherit' });
  fixture = spawn(process.execPath, [join(root, 'fixture/server.js')], { stdio: 'inherit' });
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null || fixture.exitCode !== null) throw new Error('Bridge or fixture failed to start; ensure ports 3210 and 4175 are free.');
    await new Promise(resolve => setTimeout(resolve, 100));
    try { const responses = await Promise.all([fetch('http://127.0.0.1:3210/health'), fetch('http://127.0.0.1:4175/'), fetch('http://127.0.0.1:4176/')]); if (responses.every(response => response.ok)) break; } catch { /* Retry only while the spawned servers are starting. */ }
    if (i === 99) throw new Error('Bridge did not start.');
  }
  // Extension debugging is enabled only in this disposable test profile; normal web security stays enabled.
  // The only TLS exception is for the ephemeral localhost fixture certificate below.
  browser = await chromium.launchPersistentContext(join(temp, 'profile'), { headless: process.env.HEADLESS === '1', ignoreHTTPSErrors: true, args: ['--enable-unsafe-extension-debugging', `--disable-extensions-except=${root}`, `--load-extension=${root}`] });
  const page = await browser.newPage();
  await page.route('http://127.0.0.1:3210/**', route => route.abort());
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
  // The page's own loopback requests are blocked, so success requires the relay.
  const connect = frame => frame.evaluate(async () => {
    try {
      const { createRelayClient } = await import('/sdk.js');
      window.relay = createRelayClient();
      await window.relay.connect();
      return { ok: true };
    } catch (error) { return { code: error.code, message: error.message }; }
  });
  assert.equal((await connect(page)).code, 'RELAY_UNAVAILABLE', 'A page cannot enable its own relay.');
  await page.bringToFront();
  await popup.locator('#relay-enable').click();
  await popup.waitForFunction(() => /enabled/i.test(document.querySelector('#relay-status').textContent));
  const initialConnection = await connect(page);
  const missing = initialConnection.ok ? await page.evaluate(async () => {
    try { await window.relay.models(); return null; } catch (error) { return { code: error.code, message: error.message }; }
  }) : initialConnection;
  assert.match(missing?.code || '', /native_unavailable|relay_disconnected/i, 'A missing native host must be reported.');
  assert.match(missing.message, /native|relay/i);
  await page.evaluate(() => window.relay.disconnect());
  // Never overwrite a pre-existing registration; remove this one on exit.
  nativeInstalled = true;
  await installNative(nativeOptions);
  assert.equal((await connect(page)).ok, true);
  const relayModels = await page.evaluate(() => window.relay.models());
  assert.ok(relayModels.models.some(item => item.id === model), `Expected ${model} from the real native relay.`);
  const relayResult = await page.evaluate(async ({ model, text }) => {
    let output = '', chunks = 0;
    for await (const delta of window.relay.generate({ model, task: 'summarize', text })) { output += delta; chunks++; }
    return { output, chunks };
  }, { model, text: source });
  assert.ok(relayResult.chunks > 0, 'Generation must deliver streamed deltas.');
  assert.match(relayResult.output, /garden|volunteer|harvest/i);
  const cancelled = await page.evaluate(async ({ model, text }) => {
    const controller = new AbortController();
    try {
      for await (const delta of window.relay.generate({ model, task: 'draft', text, instruction: 'Write a long detailed response.' }, { signal: controller.signal })) {
        if (delta) controller.abort();
      }
      return null;
    } catch (error) { return error.code; }
  }, { model, text: source });
  assert.equal(cancelled, 'ABORTED', 'Aborting an active stream must cancel it.');
  const second = await browser.newPage();
  await second.goto('http://127.0.0.1:4176/');
  assert.equal((await connect(second)).code, 'RELAY_UNAVAILABLE', 'Another origin has no grant.');
  const attached = page.waitForEvent('frameattached');
  await page.evaluate(() => {
    const iframe = document.createElement('iframe');
    iframe.src = 'http://127.0.0.1:4176/';
    document.body.append(iframe);
  });
  const child = await attached;
  await child.waitForURL('http://127.0.0.1:4176/');
  assert.equal((await connect(child)).code, 'RELAY_CONTEXT', 'Frames cannot use the relay.');
  await page.bringToFront();
  await popup.locator('#relay-revoke').click();
  await popup.waitForFunction(() => /revok/i.test(document.querySelector('#relay-status').textContent));
  const revoked = await page.evaluate(async () => {
    try { await window.relay.models(); return null; } catch (error) { return error.code; }
  });
  assert.ok(revoked, 'Revocation must invalidate an existing connection.');
  await page.bringToFront();
  await popup.locator('#relay-enable').click();
  await popup.waitForFunction(() => /enabled/i.test(document.querySelector('#relay-status').textContent));
  assert.equal((await connect(page)).ok, true);
  await page.evaluate(({ model, text }) => {
    window.navigationStreamStarted = false;
    (async () => {
      try {
        for await (const delta of window.relay.generate({ model, task: 'draft', text, instruction: 'Write a long detailed response.' })) {
          if (delta) window.navigationStreamStarted = true;
        }
      } catch { /* Navigation tears down this document and its relay. */ }
    })();
  }, { model, text: source });
  await page.waitForFunction(() => window.navigationStreamStarted, null, { timeout: 180000 });
  await page.reload();
  assert.equal((await connect(page)).code, 'RELAY_UNAVAILABLE', 'Navigation must invalidate the document grant.');
  await second.close();
  console.log(`PASS: real SDK, extension relay, native host, bridge and ${model}; grant isolation, revoke, cancellation and navigation`);
  // Exercise the actual workspace controls on HTTPS without a page-held token.
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', join(temp, 'tls.key'), '-out', join(temp, 'tls.crt'), '-days', '1', '-subj', '/CN=localhost'], { stdio: 'ignore' });
  const workspace = createWorkspace();
  workspaceTLS = https.createServer({ key: await readFile(join(temp, 'tls.key')), cert: await readFile(join(temp, 'tls.crt')) }, (req, res) => workspace.emit('request', req, res));
  await new Promise((resolve, reject) => { workspaceTLS.once('error', reject); workspaceTLS.listen(0, '127.0.0.1', resolve); });
  const workspaceURL = `https://127.0.0.1:${workspaceTLS.address().port}`;
  const demo = await browser.newPage();
  await demo.route('http://127.0.0.1:3210/**', route => route.abort());
  await demo.goto(workspaceURL);
  await demo.locator('#transport').selectOption('relay');
  assert.equal(await demo.locator('#token').isVisible(), false);
  await demo.bringToFront();
  const targets = await cdp.send('Target.getTargets', { filter: [{ type: 'tab', exclude: false }, { exclude: true }] });
  const demoTarget = targets.targetInfos.find(target => target.url.startsWith(workspaceURL));
  assert.ok(demoTarget);
  await cdp.send('Extensions.triggerAction', { id, targetId: demoTarget.targetId });
  await popup.locator('#relay-revoke').click();
  await popup.waitForFunction(() => /revok/i.test(document.querySelector('#relay-status').textContent));
  await popup.locator('#relay-enable').click();
  await popup.waitForFunction(() => /enabled/i.test(document.querySelector('#relay-status').textContent));
  await demo.locator('#connect').click();
  await demo.waitForFunction(() => document.querySelector('#connection-status').textContent === 'Connected');
  assert.equal(await demo.locator('#token').inputValue(), '');
  await demo.locator('#model').selectOption(model);
  await demo.locator('#text').fill(source);
  await demo.locator('#generate').click();
  await demo.waitForFunction(() => document.querySelector('#status').textContent === 'Finished.', null, { timeout: 180000 });
  assert.match(await demo.locator('#output').textContent(), /garden|volunteer|harvest/i);
  if (process.env.OWNFERENCE_WORKSPACE_SCREENSHOT) await demo.screenshot({ path: process.env.OWNFERENCE_WORKSPACE_SCREENSHOT, fullPage: true });
  await demo.locator('#disconnect').click();
  assert.equal(await demo.locator('#connection-status').innerText(), 'Not connected');
  console.log('PASS: real HTTPS workspace UI → extension → native host → Ollama, with loopback page fetch blocked and no page token');
} finally {
  try { await browser?.close(); } finally {
    if (workspaceTLS) { workspaceTLS.closeAllConnections(); await new Promise(resolve => workspaceTLS.close(resolve)); }
    await Promise.all([server, fixture].filter(child => child && child.exitCode === null && child.signalCode === null).map(child => new Promise(resolve => { child.once('exit', resolve); child.kill(); })));
    if (nativeInstalled) await uninstallNative(nativeOptions);
  }
  await rm(temp, { recursive: true, force: true });
}
