# Repository instructions

## Repository map

`src/` owns popup, setup and streaming client; `manifest.json` owns permissions. `fixture/` and `tests/live-e2e.js` exercise real activeTab capture and Ollama. `scripts/package.js` stages and verifies reproducible distribution archives.

## Commands and verification

Use Node 24, `npm ci` and `npm run check`. `npm run e2e` requires local Ollama, sibling Ownference and free ports 3210/4175. `npm run package` verifies archive contents and reproducibility. See README for browser installation, transient popup limitations and selectors.

## Conventions and boundaries

Preserve user-triggered capture, preview-before-send, session-only tokens, text rendering and narrow permissions. Never add page inference messages, broad host permissions or cloud fallback under an unrelated change. Browser relay is a plan only in docs/browser-relay-plan.md. The unpacked public key is not a signing secret and is stripped from packaged archives.

## Workflow

Plan behavior, test actual public workflows, implement, independently review, verify and update CHANGELOG/docs. Use conventional commits and PR template; never substitute filled-in text for capture proof. Development minimatch overrides patch GHSA-g3hv-75wg-m249.
