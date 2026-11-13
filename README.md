<p align="center"><img src="docs/assets/logo.svg" alt="Ownference Tabs" width="320"></p>

# Ownference Tabs — Turn selected page text into answers, locally.

![Ownference Tabs: your reading, with room to think](docs/assets/hero.svg)

A deliberate Chrome companion for summarizing, rewriting, extracting, comparing, or drafting from text you choose. Preview and edit before anything goes to your local model. Copy or download the result; nothing is inserted or sent back to a page. Ownference Tabs is a working brand, not trademark-cleared.

## Install and connect

Requirements: Chrome with unpacked MV3 extensions enabled, Node.js 24+, [Ollama](https://ollama.com/) running locally with a pulled model, and the sibling `ownference` bridge. No cloud fallback is used.

1. Start Ollama and pull a model: `ollama pull llama3.2:latest`.
2. In `../ownference`, run `npm install` and `npm link` (or use `node ../ownference/src/cli.js` in place of `ownference`). Start the bridge with `ownference serve` in a terminal.
3. Open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select this repository directory. Pin Ownference Tabs if desired.
4. Open the extension, choose **Setup**, and copy the displayed `ownference grant --origin chrome-extension://…` command into a terminal. It grants exactly this extension's origin and prints a secret once. Paste the token into Setup and save. The manifest contains a public key for a stable unpacked ID; it contains no signing private key.
5. Open a regular HTTP(S) page, select text if desired, open the extension, and click **Read selection / page**. No selection means visible page text. Review the editable preview and source label. Choose task and model, add optional direction, and click **Generate locally**. Copy or download after reviewing.

The token is in `chrome.storage.session`, not sync or persistent local storage; it survives popup reopen but is cleared when Chrome ends the session, the extension is reloaded, disabled or updated. Save the existing token again if retained securely, or issue a new grant. Revoke with `ownference revoke --origin <exact-origin>`. The extension connects only to `http://127.0.0.1:3210`; configure the bridge's provider separately.


If Chrome blocks local network access or the bridge is unreachable, confirm `ownference serve` is running on `127.0.0.1:3210`, check Chrome's site/local-network permissions and OS firewall, and retry. Browser policies or newer Local Network Access restrictions may block the connection; do not disable browser security to work around them. Check that the exact displayed extension origin was granted and that the current session token matches it.
## Privacy, permissions and limits

- `activeTab` grants temporary access after the toolbar action; `scripting` reads text only after you click the capture button. `storage` holds the session token. The sole host permission is the local bridge. There is no `<all_urls>`, content-script listener, page messaging API, background scraping, telemetry, clipboard read, or cloud provider.
- The capture never reads password inputs. It reads selected text from text-like inputs, textareas or the document; otherwise it reads visible document body text, not input values. Preview can contain sensitive page content: inspect and edit it before generating. Pages, titles and text are untrusted. Model output can be inaccurate or follow malicious instructions in page text; review it.
- Chrome blocks scripts on internal pages, browser stores, and other restricted pages. Cross-origin frames and content not exposed as visible document text are not captured. Page text is truncated to 24,000 characters and marked in the source label. Origin and title are shown without URL path or query.
- The action popup is ephemeral: **keep it open while generating**. Closing it interrupts the request and loses the result; cancellation stops the request. There is no background generation. A browser crash or malicious extension with sufficient privileges may compromise the session; the local bridge token is a bearer credential.

## Development and acceptance

```sh
npm ci
npm run check
npm run package                   # dist/ownference-tabs.zip
npx playwright install chromium
npm run e2e                       # live Ollama + bridge; requires free ports 3210 and 4175
```
`npm run package` requires the `zip` and `unzip` command-line tools. It stages only the extension UI files, LICENSE and NOTICE, removes the public key from the packaged manifest (the unpacked manifest is unchanged), and verifies the archive contents and two identical builds. The archive does not have the stable unpacked extension ID: Chrome assigns its ID according to how it is installed or signed, so grant that actual origin separately. Archives use `SOURCE_DATE_EPOCH` in seconds, defaulting to 1980-01-01 UTC; identical sources, epoch and zip tool versions produce identical bytes. Packaging does not sign the extension.


`npm run e2e` creates an isolated temporary Chrome profile and bridge config, grants the actual extension origin, starts the sibling bridge and fixture, and saves a real token through Setup. It invokes the real toolbar action with browser-level CDP `Extensions.triggerAction` to obtain the genuine `activeTab` grant, then drives the identical `popup.html` document in a tab because Chrome does not expose its transient toolbar popup as a Playwright Page. It checks actual capture, source labeling, a source-related Ollama response, exact downloaded content and password refusal. The test-only `--enable-unsafe-extension-debugging` flag is confined to the temporary profile; normal web security stays enabled. Set `OLLAMA_MODEL=ollama:<your-model>` to choose another installed model, `OWNFERENCE_SCREENSHOT=/tmp/ownference-tabs.png` for visual proof, or `HEADLESS=1` where supported. No Chrome runtime or model is faked. This does not prove the native toolbar popup's full interaction/lifetime behavior. For additional interactive checks:

```sh
npm run fixture                   # http://127.0.0.1:4175/
```

Open the fixture in Chrome, select the `#source` paragraph, click the toolbar icon and `#capture`, verify the selection and origin in `#source` (popup), edit `#text`, then generate with `#generate`. Try no selection for page capture, select inside `#editor`, and focus `#password` to confirm it is refused. Setup selectors are `#token`, `#save`; results are `#output`, `#copy`, `#download`, and `#status`.

## License

Apache License 2.0; see [LICENSE](LICENSE). See [SECURITY.md](SECURITY.md) for reporting and [CONTRIBUTING.md](CONTRIBUTING.md) for development.

## Explore the suite

[Ownference runtime](https://github.com/edwinjosechittilappilly/ownference) · [Ownference Web SDK](https://github.com/edwinjosechittilappilly/ownference-web) · [Architecture](docs/architecture.md) · [Testing](docs/testing.md) · [Verification](docs/verification.md)

The [browser relay plan](docs/browser-relay-plan.md) explores letting cooperating frontends request local compute through a permissioned extension/native host. It is a design document, not an enabled website messaging interface or a change to this extension's permissions.
