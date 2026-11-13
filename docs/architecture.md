# Architecture and permissions

OwnMode Browser is a Chrome MV3 extension with extension-owned setup and popup documents, plus an explicitly enabled browser relay for cooperating websites.

## Flow

Toolbar invocation grants temporary activeTab access. The user then clicks Read selection / page. `chrome.scripting.executeScript` reads selected text or visible document text and returns an explicit password refusal when appropriate. The popup shows origin, title, truncation status and editable text. Only Generate sends the displayed text through the local bridge to the selected model. Results are text-only and can be copied or downloaded, not auto-inserted or sent.

`src/options.js` owns setup and session token storage. `src/popup.js` owns capture, preview and operation lifecycle. `src/client.js` owns the bounded streaming client. The relay content script and service worker forward approved requests to the native host; see browser-relay-plan.md. `scripts/package.js` stages a sorted explicit allowlist, strips the unpacked manifest public key, normalizes timestamps/modes and verifies two identical zip builds.

## Permission and privacy decisions

Permissions are activeTab, scripting, storage and nativeMessaging, with a single local-host bridge permission. There is no all-sites permission, automatic page observation or clipboard read. The popup token stays in chrome.storage.session with default extension-only access, not sync storage. Relay sites do not receive the native host's bridge credential; only a tab explicitly enabled by the user can send relay requests.

Password values are never captured. Body text may still contain private account information; users must inspect the preview. The popup is ephemeral; closing it interrupts popup generation. Local inference does not make model output trustworthy or prevent copied text or relay results from reaching websites.

## Distribution

The source manifest's public key stabilizes unpacked development IDs; it is not a private signing key. The packaged extension obtains the identity of its actual installation/distribution and needs a separate exact-origin grant. The zip is verified, not store-approved or signed. Chrome store and OS policy can restrict installation. See testing.md and SECURITY.md.
