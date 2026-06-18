# Release Guardian（简体中文）

Release Guardian 是一个企业级发布治理 API，面向需要清晰的发布审批、可审计的部署记录和风险感知运营决策的工程团队。

## 1. 概述

Release Guardian 帮助平台工程团队回答五个关键问题：

1. 什么变更即将上线？
2. 每个发布的风险有多大？
3. 生产环境部署前需要谁来审批？
4. 部署过程中发生了什么？
5. 管理层应该关注哪些治理指标？

本项目使用 Node.js 内置能力实现，无第三方运行时依赖。这使得运营开销小、供应链攻击面窄、代码易于审查。

## 2. 核心能力

- 每个发布请求的风险评分
- 基于环境、服务层级和控制状态的审批路由
- 有状态的发布生命周期跟踪
- 部署调度和执行记录
- 每个重要操作的审计时间线
- 治理和变更绩效的仪表板指标
- 带有稳定审计标识符的管理层升级报告
- 用于下游集成的 schema 丰富的 OpenAPI 合约
- 容器化运行时和 CI 工作流
- 批量发布创建（最多 50 个）
- Webhook 事件通知系统
- 结构化 JSON 日志与关联 ID
- 速率限制与 API Key 认证
- CORS 和安全响应头
- 多语言文档

## 3. 产品范围

本项目的初始交付聚焦于发布治理的后端控制平面，适用于：

- 内部发布门户的基础
- 企业工作流工具背后的 API 服务
- 变更管理系统教学/参考项目
- 未来扩展到 UI、RBAC、SSO 和外部审批的安全基线

## 4. 架构

```text
客户端 / 自动化工具
        |
        v
  HTTP API 层
        |
        v
  中间件管道（日志、速率限制、认证、CORS、安全头）
        |
        v
  发布服务
        |
        v
  JSON 仓库
        |
        v
  持久化数据文件
```

### 架构说明

- `src/server.js`：启动 HTTP 服务器
- `src/app.js`：路由请求并构造 API 响应
- `src/services/releaseService.js`：承载业务逻辑
- `src/repository.js`：隔离持久化层
- `src/lib/http.js`：HTTP 工具函数
- `src/lib/logger.js`：结构化 JSON 日志
- `src/lib/middleware.js`：请求日志、速率限制、API Key 认证、CORS、安全头
- `src/lib/webhooks.js`：Webhook 订阅和事件分发
- `src/lib/validation.js`：输入验证
- `src/lib/time.js`：时间工具函数
- `tests/*.test.js`：服务和 API 测试覆盖

## 5. 技术选型

- 语言：JavaScript（ES 模块）
- 运行时：Node.js 20+（在 Node.js 24 上验证）
- 测试：原生 `node:test`
- 持久化：JSON 文件仓库
- API 描述：OpenAPI 3.1
- 容器运行时：Docker
- CI：GitHub Actions
- 部署：Kubernetes（Kustomize + Helm）

## 6. 功能设计

### 6.1 发布生命周期

发布状态：

- `draft`（草稿）
- `pending_approval`（待审批）
- `approved`（已批准）
- `rejected`（已拒绝）
- `scheduled`（已排期）
- `deployed`（已部署）
- `rolled_back`（已回滚）

### 6.2 风险输入

风险由以下因素计算：

- 目标环境
- 服务关键性等级
- 变更类别
- 影响的组件数量
- 客户影响分数
- 数据敏感度分数
- 自动化测试就绪状态
- 回滚就绪状态
- 监控就绪状态
- 安全审查完成状态

### 6.3 审批路由

- 基线审批：发布管理团队
- 附加审批：SRE（高风险发布）
- 附加审批：安全团队（关键或 Tier-1 发布）

## 7. API 接口

### `GET /health`

健康检查探针，返回纯文本 `ok`。

### `GET /ready`

就绪探针，检查数据存储健康状态。

```bash
curl -s http://localhost:3000/ready | jq .
```

响应字段：

- `status`：`ready` 或 `not_ready`
- `version`：运行中的服务版本
- `checks.datastore.status`：`ok` 或 `error`
- `checks.datastore.releaseCount`：数据存储中的发布总数
- `checks.datastore.teamCount`：数据存储中的团队总数

### `GET /api/releases`

查询发布列表，支持多维筛选与分页。

支持的查询参数：

- `environment` — 环境筛选
- `status` — 状态筛选
- `riskBand` — 风险等级筛选
- `application` — 应用名筛选
- `owner` — 负责人筛选
- `pendingApprovals` — 仅待审批
- `sort` — 排序字段
- `order` — 排序方向
- `limit` — 每页数量
- `offset` — 偏移量

### `POST /api/releases`

创建发布请求。

### `POST /api/releases/bulk`

批量创建发布（最多 50 个）。支持部分失败：成功创建的发布与每项错误一同返回。

```bash
curl -X POST http://localhost:3000/api/releases/bulk \
  -H "Content-Type: application/json" \
  -d '{
    "releases": [
      { "application": "app-a", "version": "1.0.0", ... },
      { "application": "app-b", "version": "2.0.0", ... }
    ]
  }'
```

响应字段：

- `created`：成功创建的数量
- `failed`：验证失败的数量
- `releases`：创建成功的发布数组
- `errors`：失败项的 `{ index, code, message }` 数组

### `GET /api/releases/:releaseId`

获取单个发布详情。

### `GET /api/releases/:releaseId/evidence`

获取审计证据包，包含控制证据、审批证据、部署结果证据、稳定证据标识符、冲突检查、升级标志和补救措施。

### `GET /api/releases/:releaseId/conflicts`

查询同一应用和环境的发布窗口冲突。

### `POST /api/releases/:releaseId/approvals`

审批或驳回发布。

### `POST /api/releases/:releaseId/schedule`

调度已批准的发布。如果存在活动的发布窗口冲突，返回 `409 release_window_conflict`。

### `POST /api/releases/:releaseId/deploy`

记录部署结果。

### `GET /api/dashboard`

治理仪表板指标：

- 发布总数
- 按状态分组的发布
- 按环境分组的发布
- 风险分布
- 审批 SLA 违规
- 变更失败率
- 平均前置时间（小时）

### `GET /api/escalations`

运营升级摘要：逾期审批、高风险待处理发布、发布窗口冲突。

### `GET /api/escalations/report`

管理层升级报告：带有稳定审计标识符、严重性分布、执行叙述、建议补救措施和机器可读行。

### `GET /api/policy`

治理策略配置。

## 7.1 Webhook API

### `GET /api/webhooks`

列出所有活跃的 Webhook 订阅。

### `POST /api/webhooks`

创建 Webhook 订阅。

```bash
curl -X POST http://localhost:3000/api/webhooks \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/release-events",
    "events": ["release.created", "release.deployed"],
    "secret": "可选的-HMAC-密钥"
  }'
```

字段：

- `url`（必填）：事件投递的目标 URL
- `events`：订阅的事件类型数组（默认：`["*"]` 订阅全部）
- `secret`：可选的 HMAC 密钥，用于签名载荷

### `DELETE /api/webhooks/:webhookId`

移除 Webhook 订阅。

### `GET /api/webhooks/events`

返回 Webhook 事件投递日志，支持分页（`limit`、`offset`）。

## 7.2 部署

### Docker

```bash
# 构建并运行
docker build -t release-guardian:latest .
docker run -p 3000:3000 release-guardian:latest

# 或使用 docker-compose
docker compose up              # 生产模式
docker compose up dev          # 开发模式（热重载）
```

### Kubernetes（Kustomize）

```bash
# 预发布环境
kubectl apply -k k8s/overlays/staging

# 生产环境
kubectl apply -k k8s/overlays/production
```

### Kubernetes（Helm）

```bash
helm install release-guardian helm/release-guardian \
  --set image.tag=2.0.0 \
  --set config.logLevel=info \
  --set secrets.apiKeys=my-secret-key
```

### 性能测试

```bash
node scripts/benchmark.js --url http://localhost:3000 --concurrency 20 --duration 30
```

## 8. 错误模型

所有错误遵循统一格式：

```json
{
  "error": {
    "code": "not_found",
    "message": "Release xyz was not found.",
    "details": {}
  }
}
```

HTTP 状态码与错误码映射：

| 状态码 | 错误码 | 含义 |
|--------|--------|------|
| 400 | `validation_error` | 请求参数无效 |
| 400 | `invalid_json` | 请求体不是有效 JSON |
| 401 | `unauthorized` | 缺少或无效的 API Key |
| 404 | `not_found` | 资源不存在 |
| 409 | `release_window_conflict` | 发布窗口冲突 |
| 409 | `release_window_conflict` | 调度冲突 |
| 429 | `rate_limit_exceeded` | 超出速率限制 |
| 500 | `internal_error` | 服务器内部错误 |

## 9. 数据契约

发布对象包含以下核心字段：

- `id`：UUID 标识符
- `application`：应用名称
- `version`：版本号
- `environment`：目标环境
- `serviceTier`：服务层级（tier_1/tier_2/tier_3）
- `changeCategory`：变更类别（standard/normal/emergency）
- `risk`：风险评分对象（score, band, factors）
- `approvals`：审批目标数组
- `conflicts`：发布窗口冲突数组
- `timeline`：审计时间线条目数组
- `deployment`：部署记录（部署后填充）

## 10. 快速开始

```bash
git clone https://github.com/cyl147368/release-guardian.git
cd release-guardian
npm install
npm start
```

服务默认在 `http://127.0.0.1:3000` 启动。

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `3000` | 服务端口 |
| `HOST` | `127.0.0.1` | 监听地址 |
| `LOG_LEVEL` | `info` | 日志级别 |
| `RATE_LIMIT_ENABLED` | `false` | 启用速率限制 |
| `RATE_LIMIT_MAX` | `100` | 每窗口最大请求数 |
| `RATE_LIMIT_WINDOW_MS` | `60000` | 窗口时长（毫秒） |
| `API_KEYS` | _(空)_ | 逗号分隔的 API Key |
| `CORS_ORIGIN` | `*` | CORS 允许的来源 |
| `MAX_BODY_BYTES` | `1048576` | Maximum request body size |
| `SECURITY_HEADERS` | `true` | 启用安全响应头 |

## 11. API 使用示例

### 创建发布

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
    "summary": "为企业发票启用新的对账工作流。",
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

### 查询发布列表

```bash
curl "http://localhost:3000/api/releases?environment=production&status=pending_approval&limit=10"
```

### 审批发布

```bash
curl -X POST http://localhost:3000/api/releases/{releaseId}/approvals \
  -H "Content-Type: application/json" \
  -d '{"team": "release_management", "decision": "approved", "comment": "已审查，同意部署。"}'
```

### 记录部署

```bash
curl -X POST http://localhost:3000/api/releases/{releaseId}/deploy \
  -H "Content-Type: application/json" \
  -d '{"status": "success", "deployedBy": "alice", "notes": "部署成功，无异常。"}'
```

## 12. 验证

```bash
npm run lint        # 语法检查
npm test            # 运行测试
npm run test:coverage  # 带覆盖率的测试
npm run test:bootstrap # 启动配置测试
```

## 13. 测试策略

- 单元测试覆盖所有业务逻辑
- API 测试覆盖所有 HTTP 路由和状态码
- OpenAPI 合约测试验证 schema 一致性
- 中间件测试覆盖日志、速率限制、认证、CORS
- Webhook 测试覆盖订阅、分发、投递跟踪
- 批量操作测试覆盖部分失败场景
- 覆盖率阈值：80%

## 14. 运维考量

### 可观测性

- 结构化 JSON 日志
- 请求关联 ID（X-Request-Id）
- 可配置日志级别
- 健康检查和就绪探针
- 性能测试脚本

### 安全

- API Key 认证
- 速率限制
- CORS 配置
- 安全响应头（HSTS、CSP、X-Frame-Options）
- 零第三方运行时依赖

### 可扩展性

- 将 JSON 持久化替换为 PostgreSQL（参见 `docs/DATABASE-MIGRATION.md`）
- 添加乐观锁
- 外化审批通知工作流
- 使用队列处理长时间运行的部署操作

## 15. 交付内容

- 源代码
- 测试套件（135 个测试）
- Dockerfile（多阶段构建）
- docker-compose.yml
- GitHub Actions CI 工作流
- Kubernetes 清单（Kustomize）
- Helm Chart
- OpenAPI 合约
- 性能测试脚本
- 数据库迁移文档
- 安全文档
- 多语言文档

## 16. 路线图

### 近期

- 添加 PostgreSQL 存储适配器
- 添加策略模板
- 添加前端运维控制台

### 中期

- 添加变更日历可视化
- 添加多区域部署编排
- 添加 DORA 指标趋势快照

### 长期

- 添加 AI 辅助发布风险解释
- 添加自适应审批路由
- 添加合规证据导出格式

## 17. 仓库结构

```text
release-guardian/
├── .dockerignore
├── .github/workflows/ci.yml
├── .env.example
├── data/seed.json
├── docker-compose.yml
├── Dockerfile
├── docs/
│   ├── DATABASE-MIGRATION.md
│   ├── DEPLOYMENT.md
│   ├── OPERATIONS.md
│   ├── README.ja.md
│   ├── README.ko.md
│   ├── README.zh-CN.md
│   ├── README.zh-TW.md
│   └── SECURITY.md
├── helm/release-guardian/
├── k8s/
├── openapi/openapi.yaml
├── package.json
├── scripts/
│   ├── benchmark.js
│   └── seed-demo.js
├── src/
│   ├── app.js
│   ├── bootstrap.js
│   ├── lib/
│   │   ├── http.js
│   │   ├── logger.js
│   │   ├── middleware.js
│   │   ├── time.js
│   │   ├── validation.js
│   │   └── webhooks.js
│   ├── repository.js
│   ├── server.js
│   └── services/
│       └── releaseService.js
└── tests/
```

## 18. 许可证

MIT
