# Browser relay: local compute for frontend applications

The relay connects a cooperating frontend to local models through the extension and the installed OwnMode native messaging host. It does not intercept other websites' requests, expose a runtime token to a page, or provide arbitrary local actions.

## Flow and approval

1. The user opens the extension on an HTTP(S) tab and explicitly enables relay for that tab. The extension injects an isolated content script using `activeTab` and `scripting`; there is no always-on all-sites content script.
2. The page uses `createRelayClient()` from `@ownmode/web` and calls `connect()`. Only top-level documents can connect. If the relay has not been enabled, connection times out with instructions to enable it in the extension.
3. The content script relays messages to the extension service worker. The worker uses browser-attested sender tab, frame, origin and document identity to enforce the session grant. Navigation, revocation or disconnect ends the corresponding work.
4. The worker forwards bounded model and generation requests through the `com.ownmode.bridge` native host. The host owns the bridge credential and communicates with the local runtime; a missing host or stopped runtime is an error, not a cloud fallback.

## Protocol

The page posts `{source: 'ownmode-page', type: 'connect', version: 1}` to its own window and transfers a `MessagePort`. The content script validates the window, origin and version and answers on the port with `{type: 'ready'}` or `{type: 'error', error: {code, message}}`. Subsequent requests are `{id, op: 'models' | 'generate' | 'cancel', input?, target?}`. Responses are `{id, event: 'models' | 'delta' | 'done' | 'error', data?, text?, error?}`. Cancellation targets work belonging to the same connection; disconnection does not replay requests.

Native messaging uses versioned, length-framed JSON, with `models`, `generate` and `cancel` requests and `models`, `delta`, `done` and `error` events. The host's browser registration must allow the exact extension ID. Model inventory and inference are available only after extension-owned approval. Page scripts on an approved origin share that origin's access; returned results can be transmitted by the page.

## Distribution and installation

The npm package contains the unpacked extension assets. `ownmode-browser path` installs a content-addressed copy under `~/.local/share/ownmode/browser/` and prints its durable directory, including when invoked through npx. Alternatively, run `ownmode-browser install --directory /path/to/empty/directory` to select the location. Load the resulting directory via Chrome's developer-mode **Load unpacked** control. Both copies retain the public manifest key, giving unpacked installations a stable ID. Register the native host using that exact ID with the bridge's native installer. A new package with changed assets gets a new content-addressed path; load the new directory to update the extension.

`npm run package` builds a reproducible zip for distribution and removes the unpacked manifest key. Its installed ID depends on how it is distributed, so native host registration must use its actual ID. The zip is not a signed or Chrome Web Store-approved extension. Browser or enterprise policy may restrict installation and native messaging.

## Security and limitations

The extension grants relay access to a particular tab, origin and document for the current browser session, not to all websites or subframes. The worker derives identity from browser sender metadata rather than page-supplied origin fields. Revocation, navigation and disconnection cancel active work. A service-worker restart restores session grants and revalidates the browser-attested document identity; live requests fail closed and are never replayed. Browser restart clears session grants. Up to two requests per origin and eight total can be active, with a 120-second deadline. Requests are bounded and local only; generated text cannot execute tools or grant permissions. The user's provider must be running and available. Safari and Firefox have different extension and native-host requirements and are not claimed as supported.

The existing popup capture workflow remains separate: the user previews selected or page text before sending it. Neither workflow prevents an approved website from transmitting content it already receives. See testing.md and verification.md for test procedures and observed evidence; implementation alone is not proof of browser, policy or provider compatibility.
