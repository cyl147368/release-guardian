# Changelog

All notable changes to this project are documented in this file.

## 2.0.0 - 2026-06-18

### Added

- Pagination metadata in list responses: `total`, `limit`, `offset`, `hasMore`
- Request body size limiting middleware (413 Payload Too Large)
- Content-Type validation middleware (415 Unsupported Media Type)
- `MAX_BODY_BYTES` environment variable for body size limit configuration
- Pagination schema and 413/415 responses in OpenAPI contract
- 8 new tests for body size limit, content-type validation, and pagination metadata (129 total)

### Changed

- **BREAKING**: `GET /api/releases` response now includes `pagination` object alongside `data` array
- Bootstrap middleware pipeline extended with content-type validation and body size limit
- OpenAPI contract expanded with Pagination schema and new error responses

## 1.9.0 - 2026-06-18

### Added

- CONTRIBUTING.md with development workflow, code style, and PR guidelines
- Enhanced seed script with 5 diverse demo releases across environments and risk levels
- Unit tests for time utilities: nowIso, addHours, compareIso (6 tests)
- Unit tests for validation utilities: assertString, assertArray, assertEnum, assertIntegerRange, assertIsoTimestamp (12 tests)
- App-level tests for webhook CRUD, bulk create, readiness probe, and 404 handling (8 tests)
- Expanded OpenAPI contract tests verifying all 17 endpoints, all response schemas, and webhook/bulk tags (3 tests)
- .env.example with all environment variable documentation

### Changed

- OpenAPI contract tests now verify all 17 endpoints (health, ready, releases, bulk, evidence, conflicts, approvals, schedule, deploy, dashboard, escalations, escalation report, policy, webhooks, webhook events)
- Test coverage improved to 93.54% line coverage with 121 total tests

## 1.8.1 - 2026-06-18

### Added

- Comprehensive multilingual README translations (322-554 lines each)
  - `docs/README.zh-CN.md` (简体中文)
  - `docs/README.zh-TW.md` (繁体中文)
  - `docs/README.ja.md` (日本語)
  - `docs/README.ko.md` (한국어)
- Each translation covers: architecture, API surface, deployment, error model, environment variables, testing strategy, and repository layout

### Changed

- All multilingual READMEs now match the English README in depth and structure

## 1.8.0 - 2026-06-18

### Added

- CORS middleware with configurable origins, methods, and preflight handling
- Security headers middleware: HSTS, CSP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy
- Graceful shutdown on SIGTERM/SIGINT with 10-second force-exit timeout
- Comprehensive security documentation (`docs/SECURITY.md`)
- Hardening checklist for production deployments
- 5 new tests for CORS and security headers (87 total)

### Changed

- Bootstrap now layers security headers, CORS, auth, rate limiting, request logging
- Environment variable configuration: `CORS_ORIGIN`, `SECURITY_HEADERS`

## 1.7.0 - 2026-06-18

### Added

- Multi-stage Dockerfile with non-root user, health check, and OCI labels
- docker-compose.yml with production and development service profiles
- GitHub Actions CI: multi-Node matrix (20, 22, 24), coverage enforcement, OpenAPI contract tests
- Kustomize-based Kubernetes manifests with staging and production overlays
- Helm chart with configurable replicas, ingress, autoscaling, persistence, and secrets
- Load test / benchmark script (`scripts/benchmark.js`) with configurable concurrency and duration
- Database migration documentation with PostgreSQL schema, adapter pattern, and zero-downtime migration guide
- .dockerignore for minimal build context

### Changed

- Dockerfile now uses multi-stage build for smaller production images
- CI pipeline now enforces 80% coverage threshold

## 1.6.0 - 2026-06-18

### Added

- Bulk release creation endpoint at `POST /api/releases/bulk` (up to 50 per request)
- Partial failure handling: created releases and per-item errors returned together
- Webhook subscription management at `GET/POST /api/webhooks`
- Webhook subscription removal at `DELETE /api/webhooks/:webhookId`
- Webhook event log at `GET /api/webhooks/events`
- `WebhookManager` class with event dispatch and delivery tracking (`src/lib/webhooks.js`)
- ReleaseService webhook integration: subscribe, unsubscribe, list, event log, emit
- 21 new tests for bulk operations and webhooks (82 total)

### Changed

- OpenAPI contract expanded with bulk create and webhook schemas
- ReleaseService constructor now accepts optional WebhookManager

## 1.5.0 - 2026-06-18

### Added

- Structured JSON logger with configurable log levels (`src/lib/logger.js`)
- Request logging middleware with correlation IDs and timing (`src/lib/middleware.js`)
- Rate limiting middleware with sliding window per client IP
- API key authentication middleware with path whitelisting
- `X-Request-Id` header propagation for distributed tracing
- `X-RateLimit-*` response headers for client rate awareness
- Environment variable configuration: `LOG_LEVEL`, `RATE_LIMIT_ENABLED`, `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS`, `API_KEYS`
- 21 new tests for logger and middleware (61 total)

### Changed

- Bootstrap now layers middleware: auth, rate limiting, request logging
- OpenAPI contract includes 401 Unauthorized and 429 TooManyRequests responses

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
