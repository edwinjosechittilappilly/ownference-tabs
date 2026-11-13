<p align="center"><img src="docs/assets/logo.svg" width="88" alt="Ownference linked-loop logo with browser-tab badge"></p>

# Ownference Tabs
### Your tabs. Your AI.

Choose page text, preview exactly what will be sent, and let a local model help you **read, rewrite, summarize, compare or draft**. Cooperating websites can also use your local compute through a permissioned browser relay.

<p><a href="https://github.com/edwinjosechittilappilly/ownference-tabs/releases">Download releases</a> · <a href="#install-from-a-release">Install</a> · <a href="#use-it-on-a-page">Page assistant</a> · <a href="#let-a-website-use-local-compute">Browser relay</a> · <a href="docs/architecture.md">Architecture</a></p>

![Ownference Tabs: your tabs, your AI](docs/assets/hero.svg)

**Apache-2.0 · Chrome MV3 · User-approved access · Private preview**

## Two workflows, one extension

| Use it yourself | Let a cooperating app connect |
|---|---|
| Select text → capture → review → generate → copy/download | Open site → approve relay in extension → connect the site's SDK |
| You decide the source text and task | The approved site submits bounded inference requests |
| No automatic page mutation or sending | No bridge token exposed to page scripts |

No background scraping of every tab. No silent cloud fallback. No claim to replace a website's backend AI calls.

## Install from a release

Requires Chrome, Node 24+, GitHub CLI with access to this private repository, and the running [Ownference bridge](https://github.com/edwinjosechittilappilly/ownference). The bridge can use a downloaded Ollama generation model or another ready local provider.

```sh
gh release download v0.2.0 \
  --repo edwinjosechittilappilly/ownference-tabs \
  --pattern ownference-tabs-0.2.0.tgz

# Copies the extension out of the temporary npx cache:
npx --yes --package "$PWD/ownference-tabs-0.2.0.tgz" \
  ownference-tabs install --directory "$HOME/Applications/OwnferenceTabs"
```

The target directory must be empty. Open **chrome://extensions**, enable Developer mode, choose **Load unpacked**, and select `~/Applications/OwnferenceTabs`. Pin the extension for easy access.

Prefer a durable CLI?

```sh
npm install -g ./ownference-tabs-0.2.0.tgz
ownference-tabs path
```

`path` prints a durable content-addressed extension directory—not an npx cache directory. Load that directory in Chrome. The release also includes **ownference-tabs.zip**; extract it and load the extracted directory if you prefer not to use npm. The zip does not retain the keyed development ID, so use its actual Chrome ID for grants/native installation.

No public npm registry publication or Chrome Web Store approval is implied. Private release downloads require repository access. Never disable browser security to install or connect.

## Use it on a page

1. Open **Setup** from the extension. Copy the exact-origin grant command into a terminal running the Ownference CLI.
2. Paste the one-time token into Setup and save. It lives in `chrome.storage.session`, not sync or persistent local storage.
3. Open a regular HTTP(S) page and select text. Open the extension and choose **Read selection / page**.
4. Inspect the source label and editable preview. No selection captures visible body text; password fields are refused.
5. Choose a local model and task, then **Generate locally**. Review the answer before copying or downloading.

**Keep the action popup open while generating.** Closing it interrupts that request and loses the result. There is no automatic insert, email send, purchase or other model-authorized action.

Chrome ends the stored-token session on browser/extension lifecycle changes. Re-enter a securely retained token or create a new grant. To revoke it, use the exact extension origin displayed in Setup:

```sh
ownference revoke --origin chrome-extension://iacejanagmkfpcajmcnlbikgnmomdpba
```

Use your actual ID if it differs from the keyed unpacked release.

## Let a website use local compute

The relay is an implemented transport, not just a design document:

**Frontend SDK → approved document channel → extension → native host → local bridge → model.**

Install the native host for the ID shown in `chrome://extensions`:

```sh
ownference native install --extension-id iacejanagmkfpcajmcnlbikgnmomdpba
ownference native status
```

Open the cooperating website, invoke Ownference Tabs, inspect the exact origin and choose **Enable relay for this tab**. Then use the website's Connect action. The developer uses [`createRelayClient()`](https://github.com/edwinjosechittilappilly/ownference-web); the page never receives the native host's bridge token.

Approval is session-only and scoped to the tab's current top-level document. Permission survives ordinary service-worker idleness, with document identity rechecked on reconnection. Active work is never replayed after a connection or worker loss. Revocation, navigation or a disconnected document cancels its work; browser/extension restart clears session grants. Use the relay controls to revoke access or stop work; uninstall the native host with `ownference native uninstall`.

Only approve sites you trust. Other scripts on the same approved origin share its permission. A site receives generated output and can transmit it elsewhere. Do not approve a site merely because it says a request is private.

## Permission and privacy boundaries

- **activeTab + scripting:** capture or relay injection only after extension-owned user action. No always-on all-sites content script.
- **storage:** session credentials/grants, not prompt history or synchronized tokens.
- **nativeMessaging:** extension-to-installed-host transport. Website scripts cannot call the native host directly.
- **Loopback host permission:** the standalone assistant connects only to `127.0.0.1:3210`.
- Top-level HTTP(S) documents only; internal/store pages and cross-origin frames are restricted.
- Captured page text is capped at 24,000 characters and marked when truncated. Titles, page text and model output are untrusted.

Prompt injection and incorrect output remain possible. The permission layer—not a prompt—controls access. No cloud fallback, telemetry, clipboard reads or arbitrary tool execution.

## Develop, package and verify

```sh
npm ci
npm run check
npm run package
npx playwright install chromium
npm run e2e
```

Live tests require the sibling runtime, real Ollama and free local test ports. They exercise real Chrome/extension/native-model paths; see [testing](docs/testing.md) and [verification](docs/verification.md) for exact scope. Chrome's transient toolbar popup is not exposed as a Playwright Page, so action grants are genuine while the identical popup document is driven in a tab.

Packaging stages an explicit asset list, strips the development public key from the zip, includes LICENSE/NOTICE and verifies reproducibility for the same inputs/toolchain. Artifacts are not store-signed.

**The family:** [Bridge](https://github.com/edwinjosechittilappilly/ownference) · [Web SDK](https://github.com/edwinjosechittilappilly/ownference-web) · [Tabs + Relay](https://github.com/edwinjosechittilappilly/ownference-tabs) · [Native Mac](https://github.com/edwinjosechittilappilly/ownference-mac)

See [relay design and trust model](docs/browser-relay-plan.md), [security](SECURITY.md) and [contributing](CONTRIBUTING.md). Licensed under [Apache-2.0](LICENSE). Ownference is a working brand, not trademark-cleared.
