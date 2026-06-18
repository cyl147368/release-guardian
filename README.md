# Release Guardian

Release Guardian is an enterprise-grade release governance API designed for engineering organizations that need clear release approvals, auditable deployment records, and risk-aware operational decisions.

## 1. Executive Summary

Release Guardian helps platform teams answer five critical questions:

1. What changes are about to go live?
2. How risky is each release?
3. Who must approve it before production?
4. What happened during deployment?
5. Which governance indicators should leadership monitor?

The project is intentionally implemented with modern built-in Node.js capabilities and no third-party runtime dependencies. That keeps the operational footprint small, the supply-chain surface narrow, and the codebase easy to inspect.

## 2. Core Capabilities

- Risk scoring for every release request
- Approval routing based on environment, service tier, and control posture
- Stateful release lifecycle tracking
- Deployment scheduling and execution recording
- Audit timeline for every important action
- Dashboard metrics for governance and change performance
- OpenAPI contract for downstream integration
- Containerized runtime and CI workflow
- Multilingual documentation for global teams

## 3. Product Scope

This initial delivery focuses on the backend control plane for release governance. It is suitable as:

- A foundation for an internal release portal
- A service behind an enterprise workflow tool
- A teaching/reference project for change management systems
- A secure baseline for future expansion into UI, RBAC, SSO, and external approvals

## 4. Architecture

```text
Client / Automation
        |
        v
  HTTP API Layer
        |
        v
  Release Service
        |
        v
  JSON Repository
        |
        v
 Persistent Data File
```

### Architectural Notes

- `src/server.js`: bootstraps the HTTP server
- `src/app.js`: routes requests and shapes API responses
- `src/services/releaseService.js`: owns business logic
- `src/repository.js`: isolates persistence
- `src/lib/*.js`: small utility helpers
- `tests/*.test.js`: service and API coverage

## 5. Technology Choices

- Language: JavaScript (ES modules)
- Runtime: Node.js 20+ (validated on Node.js 24)
- Testing: native `node:test`
- Persistence: JSON file repository
- API description: OpenAPI 3.1
- Container runtime: Docker
- CI: GitHub Actions

## 6. Functional Design

### 6.1 Release Lifecycle

Possible release states:

- `draft`
- `pending_approval`
- `approved`
- `rejected`
- `scheduled`
- `deployed`
- `rolled_back`

### 6.2 Risk Inputs

Risk is calculated from:

- Target environment
- Service criticality tier
- Change category
- Number of components affected
- Customer impact score
- Data sensitivity score
- Automated test readiness
- Rollback readiness
- Monitoring readiness
- Security review completion

### 6.3 Approval Routing

- Baseline approval: Release Management
- Additional approval: SRE for higher-risk releases
- Additional approval: Security for critical or tier-1 releases

## 7. API Surface

### `GET /health`

Returns a plain-text health response.

### `GET /api/releases`

Returns all releases sorted by creation time.

### `POST /api/releases`

Creates a new release request.

### `GET /api/releases/:releaseId`

Returns a single release.

### `POST /api/releases/:releaseId/approvals`

Applies an approval or rejection decision.

### `POST /api/releases/:releaseId/schedule`

Schedules an approved release.

### `POST /api/releases/:releaseId/deploy`

Records the deployment outcome.

### `GET /api/dashboard`

Returns governance aggregates:

- Total releases
- Releases by status
- Releases by environment
- Risk distribution
- Approval SLA breaches
- Change failure rate
- Average lead time in hours

## 8. Quick Start

### 8.1 Prerequisites

- Node.js 20 or later
- npm 10 or later

### 8.2 Install

```bash
npm install
```

### 8.3 Run

```bash
npm start
```

Server default:

- URL: `http://localhost:3000`

### 8.4 Test

```bash
npm test
```

### 8.5 Lint

```bash
npm run lint
```

## 9. Example API Usage

### Create a Release

```bash
curl -X POST http://localhost:3000/api/releases \
  -H "Content-Type: application/json" \
  -d '{
    "application": "billing-api",
    "version": "2026.06.18",
    "environment": "production",
    "serviceTier": "tier_1",
    "changeCategory": "normal",
    "plannedStartAt": "2026-06-20T08:00:00.000Z",
    "plannedEndAt": "2026-06-20T09:00:00.000Z",
    "summary": "Enable a new reconciliation workflow for enterprise invoices.",
    "components": ["api", "worker", "scheduler"],
    "owner": "alice",
    "controls": {
      "automatedTestsPassed": true,
      "rollbackReady": true,
      "monitoringReady": true,
      "securityReviewed": true,
      "customerImpactScore": 4,
      "dataSensitivityScore": 5
    }
  }'
```

### Approve a Release

```bash
curl -X POST http://localhost:3000/api/releases/<releaseId>/approvals \
  -H "Content-Type: application/json" \
  -d '{
    "team": "release_management",
    "actor": "manager",
    "decision": "approved",
    "comment": "Operational readiness confirmed."
  }'
```

## 10. Testing Strategy

The project currently includes:

- Service-layer lifecycle tests
- Approval workflow tests
- Scheduling guardrail tests
- Deployment metric tests
- API smoke tests

Recommended next-stage additions:

- Property-based tests for risk scoring
- Concurrency tests for repository writes
- Contract tests against the OpenAPI document
- End-to-end tests with a browser-based operations UI

## 11. Operational Concerns

### Observability

Suggested production hardening:

- Structured logging
- Request correlation IDs
- Metrics export
- Central audit sink
- Error budgets and alerting

### Security

Suggested production hardening:

- Authentication and RBAC
- SSO or OIDC integration
- Tamper-evident audit storage
- Encryption at rest
- Policy-based approval constraints

### Scalability

Suggested production hardening:

- Replace JSON persistence with PostgreSQL
- Add optimistic locking
- Externalize approval notification workflows
- Use queues for long-running deployment actions

## 12. Delivery Contents

- Source code
- Test suite
- Dockerfile
- GitHub Actions workflow
- OpenAPI contract
- Seed data
- Multilingual documentation

## 13. Multilingual Overview

### English

Release Guardian is a release governance API for enterprise software delivery teams. It centralizes risk evaluation, approval routing, deployment traceability, and executive reporting.

### 简体中文

Release Guardian 是一个面向企业软件交付团队的发布治理 API。它将风险评估、审批流转、部署追踪与管理报表集中到一个轻量、易审计的服务中。

### 繁體中文

Release Guardian 是一個面向企業軟體交付團隊的發佈治理 API。它將風險評估、審批流程、部署追蹤與管理報表集中於一個輕量且易於審計的服務之中。

### Japanese

Release Guardian は、企業向けソフトウェアデリバリーチームのためのリリースガバナンス API です。リスク評価、承認フロー、デプロイ追跡、管理レポートを一つの軽量サービスに集約します。

### Korean

Release Guardian는 엔터프라이즈 소프트웨어 전달 팀을 위한 릴리스 거버넌스 API입니다. 위험 평가, 승인 흐름, 배포 추적, 운영 보고를 하나의 가볍고 감사 가능한 서비스로 통합합니다.

## 14. Detailed Multilingual README Extension

Additional detailed documentation is provided below so globally distributed teams can share the same operational language.

### 14.1 English Detailed Notes

- Risk is calculated deterministically from declared controls and release context.
- Approval routing is explicit and inspectable.
- Each release contains its own audit timeline.
- Dashboard metrics are derived directly from stored release history.

### 14.2 简体中文详细说明

- 风险评分由发布上下文和控制项状态共同决定，结果可重复、可解释。
- 审批路径不是黑盒逻辑，而是清晰可审计的显式规则。
- 每一个发布单据都自带完整的时间线，便于复盘与审计。
- 仪表盘指标直接来源于发布历史数据，方便与治理流程保持一致。

### 14.3 繁體中文詳細說明

- 風險分數由發佈背景與控制項狀態共同決定，結果可重現且可解釋。
- 審批路徑採用明確規則而非黑盒判斷，便於稽核。
- 每一筆發佈單都保留完整時間線，方便事後追蹤。
- 儀表板指標直接由歷史發佈資料推導而來，與治理流程保持一致。

### 14.4 Japanese Detailed Notes

- リスクスコアは、宣言された統制項目とリリース条件から決定論的に算出されます。
- 承認ルーティングは明示的で、後から検査可能です。
- 各リリースは独自の監査タイムラインを保持します。
- ダッシュボード指標は保存済みの履歴から直接集計されます。

### 14.5 Korean Detailed Notes

- 위험 점수는 선언된 통제 항목과 릴리스 맥락을 바탕으로 결정론적으로 계산됩니다.
- 승인 라우팅은 명시적이며 추적 가능합니다.
- 각 릴리스는 자체 감사 타임라인을 보유합니다.
- 대시보드 지표는 저장된 릴리스 이력에서 직접 집계됩니다.

## 15. Roadmap

### Near-Term

- Add role-based access control
- Add PostgreSQL storage adapter
- Add notification webhooks
- Add policy templates for regulated environments

### Mid-Term

- Add front-end operations console
- Add change calendar visualization
- Add multi-region deployment orchestration
- Add DORA metrics trend snapshots

### Long-Term

- Add AI-assisted release risk explanation
- Add adaptive approval routing
- Add compliance evidence packaging

## 16. Repository Layout

```text
release-guardian/
├── .github/workflows/ci.yml
├── data/seed.json
├── docs/
├── Dockerfile
├── openapi/openapi.yaml
├── package.json
├── scripts/seed-demo.js
├── src/
│   ├── app.js
│   ├── lib/
│   │   ├── http.js
│   │   ├── time.js
│   │   └── validation.js
│   ├── repository.js
│   ├── server.js
│   └── services/
│       └── releaseService.js
└── tests/
    ├── app.test.js
    └── releaseService.test.js
```

## 17. License

MIT
