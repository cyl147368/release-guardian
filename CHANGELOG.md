# Changelog

All notable changes to this project are documented in this file.

## 1.1.0 - 2026-06-18

### Added

- Runtime bootstrap abstraction in `src/bootstrap.js`
- Bootstrap-level tests for startup configuration and request pipeline
- Additional API validation tests for malformed JSON and timestamps
- Deployment, operations, security, and multilingual documentation assets
- Atomic file-write behavior in the JSON repository

### Changed

- Server startup now supports both host/port and unix socket modes
- README expanded with verification guidance and documentation links

## 1.0.0 - 2026-06-18

### Added

- Initial Release Guardian service with release lifecycle management
- Risk scoring and approval routing
- Deployment recording and dashboard metrics
- OpenAPI definition, Dockerfile, GitHub Actions workflow, and tests
