# Changelog

All notable changes to this project are documented in this file.

## 1.4.0 - 2026-06-18

### Added

- Readiness probe at `GET /ready` with datastore health checks
- Service and API tests for readiness endpoint (200 ready, 503 not ready)
- Readiness and ReadinessResponse schemas in OpenAPI contract

### Changed

- Version bumped to 1.4.0 across package metadata, service, and OpenAPI

## 1.3.0 - 2026-06-18

### Added

- Executive escalation report endpoint at `GET /api/escalations/report`
- Stable escalation report identifiers for audit traceability
- Severity distribution, executive narrative, recommended remediation actions, and machine-readable report rows
- Stable evidence package and control evidence identifiers
- Evidence package conflict checks, escalation flags, and remediation actions
- Service and API tests for the escalation report contract
- Evidence package tests for traceability, conflict visibility, and remediation guidance
- Scheduling now blocks releases with active release-window conflicts
- Service and API tests for the scheduling conflict gate
- Schema-rich OpenAPI contract with reusable request, response, governance, reporting, and error schemas
- OpenAPI contract guardrail tests

### Changed

- OpenAPI, README, and package metadata now describe the expanded reporting and evidence surface
- Release-window conflict payloads now include the conflicting release version
- The lint script now syntax-checks the OpenAPI contract test

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
