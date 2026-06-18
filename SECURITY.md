# Security Policy

## Supported Versions

This repository is currently maintained as a single active line:

- `1.x`

## Reporting a Vulnerability

Please avoid opening a public issue for a suspected security vulnerability.

Recommended process:

1. Prepare a short summary of the issue, affected component, impact, and reproduction steps.
2. Share a minimal proof of concept only when necessary.
3. Coordinate remediation and disclosure timing before publishing details.

## Security Posture of This Delivery

The current project intentionally keeps the runtime small:

- No third-party runtime dependencies
- Explicit request validation
- Clear state-transition guards
- Auditable release timelines
- Deterministic risk scoring

## Recommended Hardening Before Production

- Add authentication and role-based access control
- Replace file persistence with a hardened database
- Add tamper-evident audit storage
- Add rate limiting and request tracing
- Add secret rotation and encrypted configuration management
