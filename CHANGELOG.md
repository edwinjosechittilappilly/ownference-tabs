# Changelog

## 0.3.0

- Rebrand as OwnMode Browser, with updated relay protocol and native-host identifiers. Upgrades require fresh authorization and native-host registration.
- Align extension and package versions and publish release installation guidance.

## 0.2.1

- Correct Chrome's installed manifest version to match the release package, allowing Chrome to recognize the current extension version.
- Add a durable-install regression test for the Chrome update version contract.

## 0.2.0

- Document-scoped browser relay, extension-owned approval, native messaging and strict frame/origin isolation.
- Session grant restoration across worker idleness without replaying live work.
- Durable npx/npm extension installer, branded icons and actual-ID native-host setup guidance.
- Real Ollama and HTTPS workspace relay acceptance, including cancellation, revoke, navigation and hostile-origin checks.
- Clearly report when capture is refused because a password field is focused.
- Produce reproducible, verified extension archives without the unpacked manifest key.

## 0.1.0

- Initial local-only MV3 assistant with explicit page text preview, session authorization, streaming generation, cancellation, copy and download.
