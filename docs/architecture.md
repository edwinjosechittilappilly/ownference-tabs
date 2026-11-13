# Architecture and permissions

Ownference Tabs is a Chrome MV3 extension with extension-owned setup and popup documents. No background inference listener or website messaging endpoint exists.

## Flow

Toolbar invocation grants temporary activeTab access. The user then clicks Read selection / page. `chrome.scripting.executeScript` reads selected text or visible document text and returns an explicit password refusal when appropriate. The popup shows origin, title, truncation status and editable text. Only Generate sends the displayed text through the local bridge to the selected model. Results are text-only and can be copied or downloaded, not auto-inserted or sent.

`src/options.js` owns setup and session token storage. `src/popup.js` owns capture, preview and operation lifecycle. `src/client.js` owns the bounded streaming client. `scripts/package.js` stages a sorted explicit allowlist, strips the unpacked manifest public key, normalizes timestamps/modes and verifies two identical zip builds.

## Permission and privacy decisions

Permissions are activeTab, scripting and storage, with a single local-host bridge permission. No all-sites permission, automatic page observation, page-origin inference messages or clipboard read. The token stays in chrome.storage.session with default extension-only access, not sync storage. A site cannot call the extension to generate or read its token.

Password values are never captured. Body text may still contain private account information; users must inspect the preview. The popup is ephemeral; closing it interrupts generation. Local inference does not make model output trustworthy or prevent copied text from reaching websites. The browser relay in browser-relay-plan.md is planning only, not an active permission expansion.

## Distribution

The source manifest's public key stabilizes unpacked development IDs; it is not a private signing key. The packaged extension obtains the identity of its actual installation/distribution and needs a separate exact-origin grant. The zip is verified, not store-approved or signed. Chrome store and OS policy can restrict installation. See testing.md and SECURITY.md.
