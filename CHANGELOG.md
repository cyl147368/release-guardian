# Changelog

All notable changes to this project are documented in this file.

## 1.3.0 - 2026-06-18

### Added

- Executive escalation report endpoint at `GET /api/escalations/report`
- Stable escalation report identifiers for audit traceability
- Severity distribution, executive narrative, recommended remediation actions, and machine-readable report rows
- Service and API tests for the escalation report contract

### Changed

- OpenAPI, README, and package metadata now describe the expanded reporting surface

## 1.2.0 - 2026-06-18

### Added

- Release list filtering by environment, status, risk band, application, and owner
- Release list pagination, sorting, and pending approval filtering
- Governance policy endpoint at `GET /api/policy`
- Audit evidence endpoint at `GET /api/releases/:releaseId/evidence`
- Release-window conflict endpoint at `GET /api/releases/:releaseId/conflicts`
- Operational escalation endpoint at `GET /api/escalations`
- Evidence package tests and API filter tests
- Release-window conflict detection tests
- Operational escalation tests for overdue approvals, high-risk pending releases, and conflicts

### Changed

- Customer impact and data sensitivity scores are now bounded to `0` through `5`
- OpenAPI and README now document the expanded governance API surface

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
