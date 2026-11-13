# Contributing

Use Node.js 24 or later. Run `npm ci`, `npm run check`, and, for integration changes, the live `npm run e2e` described in the README. Keep permissions narrow, keep capture explicitly user-triggered, never expose token or generation APIs to page messages, and render model output as text. Include tests for protocol failures and cancellation. Do not commit credentials, browser profiles or model output.

## Workflow and review

Use a focused branch and conventional commit subjects. Explain permission, privacy and compatibility changes in the PR template. Changes to capture, setup or generation require the real extension acceptance path; changes to packaging require verifying the resulting archive. A maintainer reviews security-sensitive changes. No self-approval, bypassed checks, real private prompts or fabricated verification. See docs/testing.md and SECURITY.md.
