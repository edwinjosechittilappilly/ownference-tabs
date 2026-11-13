# OwnMode Browser 0.3.0

Switch to your own AI. Local intelligence for your apps and browser.

[Download the extension ZIP](https://github.com/edwinjosechittilappilly/ownmode-browser/releases/download/v0.3.0/ownmode-browser.zip). The ZIP is unsigned and is not a Chrome Web Store listing.

## What's new

- Source-first page assistance in the OwnMode charcoal, paper and deep teal interface.
- Real extension screenshot and a clearer separation between page assistance and approved website relay.
- Public ZIP and durable npx/npm installation paths, with package/Chrome version agreement checked before release.

[First result and permissions](https://github.com/edwinjosechittilappilly/ownmode-browser/tree/v0.3.0#your-first-useful-result) · [Set up relay](https://github.com/edwinjosechittilappilly/ownmode-browser/tree/v0.3.0#let-a-web-app-use-your-models)


## Choose an asset

- `ownmode-browser-0.3.0.tgz`: Node.js 24+ installer for a durable unpacked Chrome extension directory.
- `ownmode-browser.zip`: reproducibly built extension archive. Extract it and load the extracted directory in Chrome; it omits the development key, so use the actual Chrome extension ID for bridge grants and native host installation.
- `SHA256SUMS`: verify downloaded assets with `shasum -a 256 -c SHA256SUMS` after downloading both assets into the same directory.

## Quick start

```sh
npx --yes --package https://github.com/edwinjosechittilappilly/ownmode-browser/releases/download/v0.3.0/ownmode-browser-0.3.0.tgz ownmode-browser install --directory "$HOME/Applications/OwnModeBrowser"
```

In Chrome, open `chrome://extensions`, enable Developer mode, choose Load unpacked and select that directory. For a durable CLI instead, use `npm install -g https://github.com/edwinjosechittilappilly/ownmode-browser/releases/download/v0.3.0/ownmode-browser-0.3.0.tgz`. This is a GitHub release asset, not an npm registry publication. Configure OwnMode Connect and a local model provider separately; relay use also requires native messaging setup and explicit per-tab approval. There is no cloud fallback.

Upgrade Connect, Web and Browser together. Before removing the former runtime, run `ownference native uninstall` and, if applicable, `ownference startup uninstall`. Register the new host for the actual extension ID and issue fresh grants; prior tokens and tab approvals are not imported.
