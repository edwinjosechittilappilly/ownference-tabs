# Observed verification

Environment: Node24.10.0, Playwright Chromium158.0.8127.18 (build1254), arm64 Mac, real Ownference bridge and local Ollama. Acceptance performed during implementation, 2026-11-12/13.

- `npm run check`: 4 stream-client behavior tests passed, plus ESLint and Secretlint. Loaded client coverage: 93.10% lines, 76.19% branches, 71.43% functions. This is not coverage of all extension UI code.
- `OWNFERENCE_SCREENSHOT=/tmp/ownference-tabs-verified.png npm run e2e`: passed real extension setup, browser action/activeTab grant, actual fixture selection capture, origin/title preview, real `ollama:llama3.2:latest` generation, source-related result, exact downloaded output and password-field refusal. No Chrome APIs or model inference were mocked and captured preview text was not filled manually.
- The toolbar action is invoked by browser-level CDP with the fixture's tab target. Because the native transient popup is not exposed as a Playwright Page, its identical popup.html is driven in a tab after the real action grant. This does not prove every native-toolbar popup focus/lifetime behavior; manual interactive acceptance is documented in README.
- The resulting extension UI screenshot was visually inspected. Password refusal left the previously approved preview unchanged and did not expose the fixture password.
- `npm run package`: verified exact sorted archive entries, no manifest key, LICENSE/NOTICE inclusion and two byte-identical builds. An observed archive hash was e96ac58ba5593d80ae3cbf2426dc764376176b3b5e60d647a04953e2d85e67ae; subsequent source edits intentionally change it.

Independent review and focused re-review resolved incorrect CDP targeting, async capture assertion races, password refusal propagation, manifest key removal and archive reproducibility. No remaining code blockers were reported.

The zip is not signed or Chrome Web Store-approved. The source public key is only for unpacked development identity. Native messaging and website-facing browser relay are PLANNED in browser-relay-plan.md, not implemented permissions or message listeners. Development dependency audit was clean with the documented patched ESLint overrides. See repository Actions for live CI status.
