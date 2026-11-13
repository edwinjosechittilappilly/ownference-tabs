# Security

Do not include bearer tokens, private page content, or model output containing sensitive data in public reports. Please report security issues privately to the repository maintainers through the hosting platform's private vulnerability reporting feature, if available. Do not assume a response SLA. Until private reporting is configured, contact the maintainers directly before public disclosure.

The bridge authorizes exact origins and uses bearer tokens. Treat tokens as passwords, revoke them if exposed, and keep the bridge and browser updated. The extension does not execute page instructions or provide model tools; model output is still untrusted. Session storage limits persistence, not access by a compromised browser or device.
