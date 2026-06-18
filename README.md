<div align="center">

# 🛡️ Release Guardian

**企业级发布治理平台**

[![CI](https://github.com/cyl147368/release-guardian/actions/workflows/ci.yml/badge.svg)](https://github.com/cyl147368/release-guardian/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/badge/coverage-93.66%25-brightgreen)](https://github.com/cyl147368/release-guardian)
[![Node](https://img.shields.io/badge/node-%3E%3D20-green)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

[English](docs/README.en.md) · [日本語](docs/README.ja.md) · [中文](README.md)

</div>

---

## 概述

Release Guardian 是一个零依赖的企业级发布治理平台，帮助团队安全、合规地管理软件发布全生命周期。从发布请求提交到审批流转、排期部署、回滚恢复，每个环节都有完善的控制和可观测性。

**核心价值**：让每一次发布都可追溯、可审计、可控制。

### 为什么选择 Release Guardian？

| 特性 | 说明 |
|------|------|
| 🏗️ 零运行时依赖 | 仅使用 Node.js 内置模块，无第三方包风险 |
| 🛡️ 多级审批路由 | 根据风险评分、服务层级自动路由审批团队 |
| 📊 实时仪表板 | Web 控制台实时查看发布状态、风险分布、SLA 违规 |
| 🔔 Webhook 事件 | 发布状态变更时自动推送事件到外部系统 |
| 📝 审计日志 | 完整记录所有操作，支持多维度查询 |
| 📈 Prometheus 指标 | 内置指标采集，一键接入 Grafana 监控 |
| 🐳 容器就绪 | Docker + Kubernetes + Helm 一键部署 |
| ✅ 93.66% 覆盖率 | 262 个测试用例，企业级质量保障 |
| 🔌 WebSocket 实时推送 | 零依赖 WebSocket 支持，事件订阅机制 |

---

## 快速开始

### 环境要求

- Node.js >= 20
- npm >= 9

### 安装运行

```bash
# 克隆项目
git clone https://github.com/cyl147368/release-guardian.git
cd release-guardian

# 安装依赖
npm install

# 启动服务
npm start
```

服务启动后访问：
- **Web 控制台**: http://localhost:3000
- **API 文档**: http://localhost:3000/api/policy
- **健康检查**: http://localhost:3000/health
- **Prometheus 指标**: http://localhost:3000/metrics

### Docker 部署

```bash
# 构建镜像
docker build -t release-guardian .

# 运行容器
docker run -d \
  --name release-guardian \
  -p 3000:3000 \
  -v rg-data:/app/data \
  release-guardian
```

### Docker Compose

```bash
docker compose up -d
```

### Kubernetes

```bash
# 使用 Kustomize
kubectl apply -k k8s/overlays/production

# 或使用 Helm
helm install release-guardian helm/release-guardian
```

---

## 架构

```
┌─────────────────────────────────────────────────────────┐
│                    Web 控制台 (SPA)                       │
│  仪表板 │ 发布列表 │ 创建发布 │ 升级告警 │ Webhook │ 策略  │
└──────────────────────────┬──────────────────────────────┘
                           │ HTTP
┌──────────────────────────┴──────────────────────────────┐
│                    中间件管道                              │
│  指标 → 安全头 → CORS → 内容验证 → 限流 → 认证 → 日志     │
├─────────────────────────────────────────────────────────┤
│                    路由层 (app.js)                        │
│  /health  /ready  /api/*  /metrics  /api/audit          │
├─────────────────────────────────────────────────────────┤
│                 业务逻辑 (releaseService.js)              │
│  风险评估 → 审批路由 → SLA 监控 → 窗口冲突检测             │
├─────────────────────────────────────────────────────────┤
│               持久化层 (repository.js)                    │
│  JSON 文件存储 + 原子写入                                  │
├──────────────┬──────────────────┬───────────────────────┤
│  审计日志     │   指标采集器       │   Webhook 引擎        │
│  audit.js     │   metrics.js     │   webhooks.js         │
└──────────────┴──────────────────┴───────────────────────┘
```

### 目录结构

```
release-guardian/
├── src/
│   ├── app.js              # HTTP 路由和静态文件服务
│   ├── bootstrap.js        # 服务器启动、中间件管道组装
│   ├── server.js           # 入口文件
│   ├── repository.js       # JSON 文件持久化
│   ├── services/
│   │   └── releaseService.js  # 核心业务逻辑
│   └── lib/
│       ├── middleware.js    # 请求日志、限流、认证、CORS、安全头
│       ├── logger.js        # 结构化 JSON 日志
│       ├── audit.js         # 审计日志模块
│       ├── metrics.js       # Prometheus 指标采集
│       ├── webhooks.js      # Webhook 订阅和事件分发
│       ├── healthcheck.js   # 可扩展健康检查框架
│       ├── validation.js    # 输入验证工具
│       ├── sanitization.js  # HTML 转义、控制字符清理
│       ├── http.js          # HTTP 响应工具
│       └── time.js          # 时间处理工具
├── public/                  # Web 控制台前端
│   ├── index.html           # SPA 入口
│   ├── css/style.css        # 样式（深空靛蓝紫主题）
│   └── js/app.js            # 前端逻辑
├── tests/                   # 测试套件（218 个用例）
├── data/seed.json           # 数据文件
├── openapi/openapi.yaml     # OpenAPI 3.1 规范（17 个端点）
├── docs/                    # 详细文档
├── helm/                    # Helm Chart
├── k8s/                     # Kustomize 配置
├── Dockerfile               # 多阶段构建
├── docker-compose.yml       # Docker Compose 配置
└── .github/workflows/ci.yml # GitHub Actions CI/CD
```

---

## API 端点

### 核心端点

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/health` | 健康检查 |
| `GET` | `/ready` | 就绪检查（含详细状态） |
| `GET` | `/metrics` | Prometheus 格式指标 |
| `GET` | `/api/metrics` | JSON 格式指标快照 |

### 发布管理

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/releases` | 发布列表（支持过滤/分页） |
| `POST` | `/api/releases` | 创建发布请求 |
| `POST` | `/api/releases/bulk` | 批量创建发布 |
| `GET` | `/api/releases/:id` | 发布详情 |
| `GET` | `/api/releases/:id/evidence` | 证据包 |
| `GET` | `/api/releases/:id/conflicts` | 窗口冲突检测 |
| `POST` | `/api/releases/:id/approvals` | 审批/拒绝 |
| `POST` | `/api/releases/:id/schedule` | 排期 |
| `POST` | `/api/releases/:id/deploy` | 部署 |

### 运营管理

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/dashboard` | 仪表板聚合数据 |
| `GET` | `/api/escalations` | 升级告警摘要 |
| `GET` | `/api/escalations/report` | 升级报告 |
| `GET` | `/api/policy` | 治理策略配置 |

### Webhook 管理

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/webhooks` | Webhook 订阅列表 |
| `POST` | `/api/webhooks` | 创建订阅 |
| `DELETE` | `/api/webhooks/:id` | 删除订阅 |
| `GET` | `/api/webhooks/events` | 事件日志 |

### 实时推送 (WebSocket)

| 路径 | 说明 |
|------|------|
| `ws://localhost:3000/ws` | WebSocket 连接端点 |

**事件订阅**:
```json
{
  "type": "subscribe",
  "events": ["release.created", "release.approved", "release.deployed"]
}
```

**接收事件**:
```json
{
  "type": "event",
  "event": "release.created",
  "data": { "id": "...", "application": "..." },
  "timestamp": "2026-06-18T12:00:00.000Z"
}
```

### 审计与监控

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/audit` | 审计日志查询 |
| `GET` | `/api/audit/stats` | 审计统计 |

### 创建发布示例

```bash
curl -X POST http://localhost:3000/api/releases \
  -H "Content-Type: application/json" \
  -d '{
    "application": "user-service",
    "version": "3.2.1",
    "environment": "production",
    "serviceTier": "tier_1",
    "changeCategory": "standard",
    "plannedStartAt": "2026-07-01T10:00:00Z",
    "plannedEndAt": "2026-07-01T12:00:00Z",
    "summary": "用户服务性能优化和安全补丁",
    "components": ["api", "worker"],
    "owner": "alice",
    "controls": {
      "automatedTestsPassed": true,
      "rollbackReady": true,
      "monitoringReady": true,
      "securityReviewed": true,
      "customerImpactScore": 2,
      "dataSensitivityScore": 1
    }
  }'
```

---

## 治理模型

### 风险评估

发布请求创建时，系统自动计算风险评分（0-100），基于以下维度：

- **服务层级**: Tier 1 (关键) / Tier 2 (重要) / Tier 3 (一般)
- **变更类别**: 紧急 > 普通 > 标准
- **控制项**: 自动化测试、回滚就绪、监控就绪、安全审查
- **影响评分**: 客户影响分 + 数据敏感度分

### 审批路由

风险评分 >= 70 的发布需要人工审批，审批团队根据以下规则自动分配：

| 团队 | 适用条件 | SLA |
|------|----------|-----|
| Release Management | 所有发布 | 4-8 小时 |
| Security | 安全审查未通过 或 数据敏感度 >= 3 | 8 小时 |
| SRE | Tier 1 服务 或 生产环境 | 4 小时 |

### 状态流转

```
draft → pending_approval → approved → scheduled → deployed
                  ↓                       ↑
              rejected              rolled_back
```

---

## 配置

通过环境变量配置：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `3000` | 监听端口 |
| `HOST` | `127.0.0.1` | 监听地址 |
| `NODE_ENV` | `development` | 运行环境 |
| `RATE_LIMIT_ENABLED` | `false` | 启用速率限制 |
| `RATE_LIMIT_MAX` | `100` | 窗口内最大请求数 |
| `RATE_LIMIT_WINDOW_MS` | `60000` | 速率限制窗口（毫秒） |
| `API_KEYS` | _(空)_ | API 密钥列表（逗号分隔） |
| `CORS_ORIGIN` | `*` | CORS 允许源 |
| `MAX_BODY_BYTES` | `1048576` | 最大请求体大小（字节） |
| `SECURITY_HEADERS` | `true` | 启用安全头 |

---

## 开发

### 常用命令

```bash
npm test                # 运行测试
npm run test:coverage   # 运行测试并生成覆盖率报告
npm run lint            # 代码规范检查
npm run quality         # 综合质量门禁（语法+测试+覆盖率+OpenAPI）
npm run seed            # 生成演示数据
npm run benchmark       # 性能基准测试
```

### 测试覆盖率

```
文件                   | 行覆盖 | 分支覆盖 | 函数覆盖
-----------------------|--------|----------|--------
src/lib/audit.js       | 100%   | 100%     | 100%
src/lib/sanitization.js| 100%   | 100%     | 100%
src/lib/time.js        | 100%   | 100%     | 100%
src/lib/validation.js  | 100%   | 100%     | 100%
src/lib/webhooks.js    | 100%   | 100%     | 100%
src/repository.js      | 100%   | 100%     | 100%
src/lib/metrics.js     | 99.4%  | 89.2%    | 100%
src/lib/middleware.js   | 97.2%  | 97.9%    | 93.3%
src/lib/logger.js      | 100%   | 94.1%    | 100%
src/services/...       | 95.1%  | 85.7%    | 100%
总体                   | 96.98% | 88.68%   | 97.07%
```

---

## 性能

基准测试结果（Apple Silicon，单线程）：

| 端点 | 吞吐量 (RPS) | P50 延迟 | P95 延迟 | P99 延迟 |
|------|-------------|----------|----------|----------|
| GET /health | 158,678 | 0ms | 0.01ms | 0.26ms |
| GET /ready | 11,518 | 0.06ms | 0.11ms | 1.97ms |
| POST /api/releases | 726 | 1.22ms | 2.73ms | 4.23ms |
| GET /api/releases | 325 | 2.87ms | 3.72ms | 10.63ms |
| GET /api/dashboard | 724 | 1.28ms | 1.92ms | 3.17ms |

运行性能测试：
```bash
node scripts/performance-test.js
```

## 部署

### Docker 生产部署

```bash
# 构建
docker build -t release-guardian:3.0.0 .

# 运行
docker run -d \
  --name rg-prod \
  -p 3000:3000 \
  -v /data/release-guardian:/app/data \
  -e NODE_ENV=production \
  -e RATE_LIMIT_ENABLED=true \
  -e API_KEYS=your-secret-key \
  release-guardian:3.0.0
```

### Kubernetes 部署

```bash
# 生产环境
kubectl apply -k k8s/overlays/production

# 预发布环境
kubectl apply -k k8s/overlays/staging
```

### Helm 部署

```bash
helm install release-guardian helm/release-guardian \
  --set replicaCount=3 \
  --set ingress.enabled=true \
  --set ingress.hosts[0].host=rg.example.com
```

---

## 文档

| 文档 | 说明 |
|------|------|
| [API 变更日志](docs/API-CHANGELOG.md) | API 版本变更记录 |
| [部署指南](docs/DEPLOYMENT.md) | 详细部署说明 |
| [运维手册](docs/OPERATIONS.md) | 日常运维操作 |
| [可观测性](docs/OBSERVABILITY.md) | 监控、日志、告警配置 |
| [性能调优](docs/PERFORMANCE.md) | 性能基准和优化建议 |
| [安全策略](docs/SECURITY.md) | 安全最佳实践 |
| [故障排查](docs/TROUBLESHOOTING.md) | 常见问题解决 |
| [路线图](docs/ROADMAP.md) | 未来规划 |
| [架构决策记录](docs/adr/) | ADR 文档 |

### 多语言文档

- [English](docs/README.en.md)
- [日本語](docs/README.ja.md)
- [中文繁體](docs/README.zh-TW.md)
- [한국어](docs/README.ko.md)

---

## 贡献

欢迎贡献！请阅读 [贡献指南](CONTRIBUTING.md) 了解详情。

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'feat: 新增超棒功能'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

---

## 许可证

[MIT License](LICENSE) © 2026 Release Guardian Contributors
