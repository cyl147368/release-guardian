<div align="center">

# 🛡️ Release Guardian

**Enterprise Release Governance Platform**

[![CI](https://github.com/cyl147368/release-guardian/actions/workflows/ci.yml/badge.svg)](https://github.com/cyl147368/release-guardian/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/badge/coverage-93.66%25-brightgreen)](https://github.com/cyl147368/release-guardian)
[![Node](https://img.shields.io/badge/node-%3E%3D20-green)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-MIT-blue)](../LICENSE)

[English](README.en.md) · [日本語](README.ja.md) · [中文](../README.md)

</div>

---

## Overview

Release Guardian is a zero-dependency enterprise release governance platform that helps teams manage the entire software release lifecycle securely and compliantly. From release request submission to approval routing, scheduling, deployment, and rollback recovery — every step is fully controlled and observable.

**Core value**: Make every release traceable, auditable, and controllable.

### Why Release Guardian?

| Feature | Description |
|---------|-------------|
| 🏗️ Zero Runtime Dependencies | Uses only Node.js built-in modules, no third-party package risks |
| 🛡️ Multi-level Approval Routing | Auto-routes approval teams based on risk score and service tier |
| 📊 Real-time Dashboard | Web console for live release status, risk distribution, SLA breaches |
| 🔔 Webhook Events | Auto-push events to external systems on release state changes |
| 📝 Audit Log | Complete operation records with multi-dimensional querying and export |
| 📈 Prometheus Metrics | Built-in metrics collection, one-click Grafana integration |
| 🐳 Container Ready | Docker + Kubernetes + Helm one-click deployment |
| ✅ 93.66% Coverage | 262 test cases, enterprise-grade quality assurance |
| 🔌 WebSocket Real-time Push | Zero-dependency WebSocket support with event subscription |
| 📤 Data Export | CSV/JSON export for releases and audit logs |
| 🎨 Quantum Observatory UI | 2026 design trends, eye-comfort colors, light/dark theme toggle |
| 📱 Mobile Optimized | Responsive design, touch optimization, safe area adaptation |
| ⚙️ User Preferences | Theme/language/pagination/refresh interval personalization |
| 📊 Performance Monitoring | Request distribution, system health, real-time metrics visualization |

---

## Quick Start

### Prerequisites

- Node.js >= 20
- npm >= 9

### Installation

```bash
git clone https://github.com/cyl147368/release-guardian.git
cd release-guardian
npm install
npm start
```

After startup:
- **Web Console**: http://localhost:3000
- **API Docs**: http://localhost:3000/api/policy
- **Health Check**: http://localhost:3000/health
- **Prometheus Metrics**: http://localhost:3000/metrics

### Docker

```bash
docker build -t release-guardian .
docker run -d --name release-guardian -p 3000:3000 -v rg-data:/app/data release-guardian
```

### Kubernetes

```bash
kubectl apply -k k8s/overlays/production
# or
helm install release-guardian helm/release-guardian
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Web Console (SPA)                     │
│  Dashboard │ Releases │ Create │ Escalations │ Webhooks │
└──────────────────────────┬──────────────────────────────┘
                           │ HTTP
┌──────────────────────────┴──────────────────────────────┐
│                    Middleware Pipeline                    │
│  Metrics → Security → CORS → Validation → Auth → Log    │
├─────────────────────────────────────────────────────────┤
│                    Router (app.js)                       │
│  /health  /ready  /api/*  /metrics  /api/audit          │
├─────────────────────────────────────────────────────────┤
│                 Business Logic (releaseService.js)       │
│  Risk Assessment → Approval Routing → SLA Monitoring     │
├─────────────────────────────────────────────────────────┤
│               Persistence (repository.js)                │
│  JSON File Storage + Atomic Writes                       │
├──────────────┬──────────────────┬───────────────────────┤
│  Audit Log   │   Metrics        │   Webhook Engine      │
│  audit.js    │   metrics.js     │   webhooks.js         │
└──────────────┴──────────────────┴───────────────────────┘
```

---

## API Endpoints

### Core

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/ready` | Readiness check with details |
| `GET` | `/metrics` | Prometheus format metrics |
| `GET` | `/api/metrics` | JSON metrics snapshot |

### Release Management

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/releases` | List releases (filterable/paginated) |
| `POST` | `/api/releases` | Create release request |
| `POST` | `/api/releases/bulk` | Bulk create releases |
| `GET` | `/api/releases/:id` | Release details |
| `GET` | `/api/releases/:id/evidence` | Evidence package |
| `GET` | `/api/releases/:id/conflicts` | Window conflict detection |
| `POST` | `/api/releases/:id/approvals` | Approve/reject |
| `POST` | `/api/releases/:id/schedule` | Schedule release |
| `POST` | `/api/releases/:id/deploy` | Deploy release |

### Real-time (WebSocket)

| Path | Description |
|------|-------------|
| `ws://localhost:3000/ws` | WebSocket connection endpoint |

**Subscribe to events**:
```json
{
  "type": "subscribe",
  "events": ["release.created", "release.approved", "release.deployed"]
}
```

### Operations

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/dashboard` | Dashboard aggregated data |
| `GET` | `/api/escalations` | Escalation alerts summary |
| `GET` | `/api/escalations/report` | Escalation report |
| `GET` | `/api/policy` | Governance policy config |
| `GET` | `/api/audit` | Audit log query |
| `GET` | `/api/audit/stats` | Audit statistics |

### Webhooks

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/webhooks` | List webhook subscriptions |
| `POST` | `/api/webhooks` | Create subscription |
| `DELETE` | `/api/webhooks/:id` | Delete subscription |
| `GET` | `/api/webhooks/events` | Event log |

---

## Governance Model

### Risk Assessment

When a release request is created, the system automatically calculates a risk score (0-100) based on:

- **Service Tier**: Tier 1 (Critical) / Tier 2 (Important) / Tier 3 (Standard)
- **Change Category**: Emergency > Normal > Standard
- **Control Items**: Automated tests, rollback readiness, monitoring, security review
- **Impact Scores**: Customer impact + Data sensitivity

### Approval Routing

Releases with risk score >= 70 require manual approval. Approval teams are automatically assigned:

| Team | Conditions | SLA |
|------|-----------|-----|
| Release Management | All releases | 4-8 hours |
| Security | Security not reviewed OR data sensitivity >= 3 | 8 hours |
| SRE | Tier 1 services OR production environment | 4 hours |

### State Machine

```
draft → pending_approval → approved → scheduled → deployed
                  ↓                       ↑
              rejected              rolled_back
```

---

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Listen port |
| `HOST` | `127.0.0.1` | Listen address |
| `NODE_ENV` | `development` | Environment |
| `RATE_LIMIT_ENABLED` | `false` | Enable rate limiting |
| `RATE_LIMIT_MAX` | `100` | Max requests per window |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Rate limit window (ms) |
| `API_KEYS` | _(empty)_ | API keys (comma-separated) |
| `CORS_ORIGIN` | `*` | CORS allowed origins |
| `MAX_BODY_BYTES` | `1048576` | Max request body size |
| `SECURITY_HEADERS` | `true` | Enable security headers |

---

## Development

```bash
npm test                # Run tests
npm run test:coverage   # Run tests with coverage
npm run lint            # Lint check
npm run quality         # Full quality gate
npm run seed            # Generate demo data
npm run benchmark       # Performance benchmark
```

---

## Documentation

| Document | Description |
|----------|-------------|
| [API Changelog](API-CHANGELOG.md) | API version changes |
| [Deployment Guide](DEPLOYMENT.md) | Detailed deployment instructions |
| [Operations Manual](OPERATIONS.md) | Day-to-day operations |
| [Observability](OBSERVABILITY.md) | Monitoring, logging, alerting |
| [Performance](PERFORMANCE.md) | Benchmarks and optimization |
| [Security](SECURITY.md) | Security best practices |
| [Troubleshooting](TROUBLESHOOTING.md) | Common issues and solutions |
| [Roadmap](ROADMAP.md) | Future plans |
| [ADRs](adr/) | Architecture Decision Records |

---

## Contributing

Contributions welcome! Please read [CONTRIBUTING.md](../CONTRIBUTING.md) for details.

---

## License

[MIT License](../LICENSE) © 2026 Release Guardian Contributors
