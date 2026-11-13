# Observed verification

## OwnMode Browser 0.3.0 identity cutover

- `npm run check` passed: lint, secret scanning and all 15 behavior tests.
- `npm run package` produced the reproducible renamed extension ZIP with the required assets/license and without the development manifest key.
- Live Chromium/Ollama acceptance passed after replacing a stale fixture-title assertion with a source-origin contract assertion and migrating screenshot environment names.
- The actual extension action/activeTab capture, source preview, model generation, exact download contents and password refusal passed.
- The renamed SDK/relay/native-host path passed origin/document isolation, revocation, cancellation and navigation checks. The real HTTPS workspace generated with loopback page fetch blocked and no bridge token exposed to the page.
- The source-first UI and new shared identity were captured from the actual popup document and visually inspected. The harness drives that document in a tab after a genuine action grant; it does not expose Chrome's transient toolbar popup.
- All native registration and browser state were isolated in temporary directories and cleaned up. GitHub release download/install checks and CI remain separate evidence.

## Historical verification — Ownference 0.2 family

Historical evidence for the pre-rebrand Ownference 0.2 releases; it does not verify OwnMode 0.3.0.

Environment: Node24.10.0, Playwright Chromium158/build1254, arm64 Mac, real bridge/native host and Ollama.

- 0.2.0 `npm run check`: 14 behavior tests passed, including 10 worker authorization/lifecycle regressions, plus lint and secret scanning. Loaded core-client/worker coverage measured 96.43% lines, 85.03% branches and 82.50% functions.
- Worker tests verify exact restored document identity, asynchronous restore races, malformed grants, navigation/removal/revoke, no replay after restart, request IDs/limits, cancellation/timeouts and missing native connection errors.
- `npm run e2e` passed actual extension Setup, genuine browser action/activeTab permission, actual selected-text capture, source preview, real Ollama response, exact downloaded content and password refusal.
- The same E2E exercised the real SDK → content relay → worker → installed native host → authenticated bridge → Ollama path, including no-approval/missing-host, second origin, iframe rejection, revoke, abort and navigation invalidation.
- A separate actual HTTPS workspace UI generated through the relay with direct loopback page fetch blocked and an empty/hidden page token field. It used an ephemeral local certificate accepted only in the isolated test profile; ordinary web security was not disabled.
- Native registration and profile storage stayed under the isolated temporary profile, not the user's real browser directories. The host install was removed on exit.
- The transient toolbar action is real, but Chrome does not expose that popup as a Playwright Page; the identical popup document is driven in a tab after action permission. Do not infer every native-popup focus/lifetime nuance from this harness.
- The actual workspace/extension UI screenshots were visually inspected.
- `npm run package` verified a sorted explicit archive list, required icons/LICENSE/NOTICE, no development manifest key and two identical builds.
- Downloaded 0.2.0 npm installation exposed an outdated Chrome manifest version. The 0.2.1 patch corrects package/manifest versions, updates release commands and adds a durable-install Chrome update regression. `node --test tests/distribution.test.js`, lint and reproducible archive packaging passed after the fix. Existing release tags remain unchanged.

Independent security review and focused re-review confirmed identity/token/resource/lifecycle fixes and reported no remaining blockers. Session grants survive ordinary worker idleness with browser-attested identity rechecked; live work is never replayed, and browser/extension restart clears session grants.

Artifacts are private GitHub tgz/zip releases, not public npm or Chrome Web Store publication. Downloaded release identity can differ from the keyed unpacked source, so Setup displays the actual extension ID and native install command. Signing/notarization or store approval is not claimed. See README and Actions for installation and current release status.
