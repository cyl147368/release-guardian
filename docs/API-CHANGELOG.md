# API 变更日志

所有 API 变更都记录在此文件中。格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)。

## [3.0.0] - 2026-06-18

### 新增

#### 审计日志 API

- `GET /api/audit` - 查询审计日志
  - 支持参数：`event`, `actor`, `resourceType`, `resourceId`, `since`, `limit`, `offset`
  - 返回审计日志条目列表和分页信息

- `GET /api/audit/stats` - 审计统计
  - 返回总条目数、按事件类型统计、最早/最新条目时间

#### 指标 API

- `GET /api/metrics` - 应用指标（JSON 格式）
  - 返回 HTTP 统计、延迟百分位、业务指标、运行时间

- `GET /metrics` - Prometheus 指标
  - 返回 Prometheus 格式指标文本

#### WebSocket API

- `ws://localhost:3000/ws` - WebSocket 连接
  - 支持事件订阅：`subscribe`, `unsubscribe`
  - 接收事件推送：`release.created`, `release.approved`, `release.deployed` 等

### 改进

- 所有 API 端点现在支持 ETag 缓存
- 错误响应格式统一为 `{ error: { code, message, details } }`
- 分页响应格式统一为 `{ data, pagination: { total, limit, offset, hasMore } }`

## [2.4.0] - 2026-06-17

### 改进

- `GET /api/releases` 支持更多过滤参数
  - `application` - 应用名称
  - `version` - 版本号
  - `environment` - 环境
  - `status` - 状态
  - `riskBand` - 风险等级
  - `owner` - 负责人

- `POST /api/releases/bulk` 批量创建优化
  - 支持部分失败
  - 返回详细错误信息

## [2.3.0] - 2026-06-16

### 新增

#### Webhook API

- `GET /api/webhooks` - 列出 Webhook 订阅
- `POST /api/webhooks` - 创建 Webhook 订阅
  - 参数：`url`, `events`
- `DELETE /api/webhooks/:id` - 删除 Webhook 订阅
- `GET /api/webhooks/events` - 查询 Webhook 事件日志

#### 升级告警 API

- `GET /api/escalations` - 升级告警摘要
  - 返回：`overdueApprovals`, `highRiskPending`, `conflicts`

- `GET /api/escalations/report` - 升级报告
  - 返回详细报告，包括执行摘要、推荐操作

### 改进

- `POST /api/releases/:id/approvals` 支持 `decision` 字段（`approved` 或 `rejected`）
- `POST /api/releases/:id/deploy` 支持 `deployedBy` 字段

## [2.2.0] - 2026-06-15

### 新增

#### 证据包 API

- `GET /api/releases/:id/evidence` - 获取证据包
  - 返回：发布信息、风险评估、审批记录、时间线、冲突检测

#### 冲突检测 API

- `GET /api/releases/:id/conflicts` - 检测时间窗口冲突
  - 返回：冲突列表、冲突详情

### 改进

- `GET /api/policy` 返回更详细的策略配置
  - 新增：`controlScoreBounds`（控制分范围）
  - 新增：`approvalRouting`（审批路由规则）

## [2.1.0] - 2026-06-14

### 新增

#### 仪表板 API

- `GET /api/dashboard` - 仪表板聚合数据
  - 返回：发布统计、状态分布、环境分布、风险分布、SLA 违规

### 改进

- `POST /api/releases` 返回更详细的发布信息
  - 新增：`risk`（风险评估）
  - 新增：`approvals`（审批链）
  - 新增：`timeline`（时间线）

## [2.0.0] - 2026-06-13

### 新增

#### 发布生命周期 API

- `POST /api/releases/:id/approvals` - 审批/拒绝
- `POST /api/releases/:id/schedule` - 排期
- `POST /api/releases/:id/deploy` - 部署

### 改进

- 风险评分算法优化
- 审批路由规则增强
- SLA 监控改进

### 破坏性变更

- 发布状态字段从 `status` 改为 `status`（保持不变）
- 审批字段从 `approver` 改为 `actor`

## [1.0.0] - 2026-06-12

### 新增

#### 基础 API

- `GET /health` - 健康检查
- `GET /ready` - 就绪检查
- `GET /api/releases` - 发布列表
- `POST /api/releases` - 创建发布
- `GET /api/releases/:id` - 发布详情

### 说明

- 初始版本
- 基础 CRUD 功能
- JSON 文件存储
- 零第三方依赖

## API 设计原则

### 1. RESTful 设计

- 使用标准 HTTP 方法（GET, POST, PUT, DELETE）
- 使用语义化 URL
- 使用标准 HTTP 状态码

### 2. 一致性

- 统一的响应格式
- 统一的错误处理
- 统一的分页方式

### 3. 向后兼容

- 新增字段不破坏现有客户端
- 废弃字段保留至少一个版本
- 提供迁移指南

### 4. 安全性

- API 密钥认证
- 速率限制
- 输入验证
- 输出编码

### 5. 可观测性

- 请求追踪（X-Request-Id）
- 结构化日志
- Prometheus 指标
- 审计日志

## 响应格式

### 成功响应

```json
{
  "data": { ... }
}
```

### 列表响应

```json
{
  "data": [ ... ],
  "pagination": {
    "total": 100,
    "limit": 20,
    "offset": 0,
    "hasMore": true
  }
}
```

### 错误响应

```json
{
  "error": {
    "code": "validation_error",
    "message": "Invalid input",
    "details": { ... }
  }
}
```

## 状态码

| 状态码 | 说明 |
|--------|------|
| 200 | 成功 |
| 201 | 创建成功 |
| 204 | 删除成功 |
| 400 | 请求错误 |
| 401 | 未认证 |
| 404 | 资源不存在 |
| 409 | 冲突 |
| 413 | 请求体过大 |
| 415 | 不支持的媒体类型 |
| 429 | 请求过多 |
| 500 | 服务器错误 |

## 认证

### API 密钥

```bash
curl -H "X-API-Key: your-key" http://localhost:3000/api/releases
```

### 白名单路径

以下路径不需要认证：
- `/health`
- `/ready`
- `/`
- `/openapi/*`

## 分页

### 请求

```bash
GET /api/releases?limit=20&offset=0
```

### 响应

```json
{
  "data": [ ... ],
  "pagination": {
    "total": 100,
    "limit": 20,
    "offset": 0,
    "hasMore": true
  }
}
```

## 过滤

### 请求

```bash
GET /api/releases?environment=production&status=approved
```

### 支持的过滤参数

- `environment` - 环境
- `status` - 状态
- `riskBand` - 风险等级
- `application` - 应用名称
- `version` - 版本号
- `owner` - 负责人

## 排序

### 请求

```bash
GET /api/releases?sort=createdAt:desc
```

### 支持的排序字段

- `createdAt` - 创建时间
- `updatedAt` - 更新时间
- `riskScore` - 风险评分

## 版本控制

### URL 版本控制

```
/api/v1/releases
/api/v2/releases
```

### 头版本控制

```
Accept: application/vnd.release-guardian.v1+json
```

## 速率限制

### 响应头

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1624000000
```

### 触发限制

```json
{
  "error": {
    "code": "rate_limit_exceeded",
    "message": "Rate limit exceeded. Try again in 60 seconds."
  }
}
```

## 缓存

### ETag

```
ETag: "abc123"
```

### 条件请求

```
If-None-Match: "abc123"
```

### 响应

- `304 Not Modified` - 未变化
- `200 OK` + 新 ETag - 已变化

## Webhook

### 事件类型

- `release.created` - 发布创建
- `release.approved` - 发布审批
- `release.rejected` - 发布拒绝
- `release.deployed` - 发布部署
- `release.rolled_back` - 发布回滚

### 订阅

```json
POST /api/webhooks
{
  "url": "https://example.com/webhook",
  "events": ["release.created", "release.approved"]
}
```

### 接收事件

```json
{
  "event": "release.created",
  "data": { ... },
  "timestamp": "2026-06-18T12:00:00.000Z"
}
```

## 迁移指南

### 从 v2.x 升级到 v3.0

1. **新增端点**
   - `/api/audit` - 审计日志
   - `/api/metrics` - 应用指标
   - `/metrics` - Prometheus 指标
   - `/ws` - WebSocket

2. **响应格式**
   - 错误响应格式统一
   - 分页响应格式统一

3. **新增功能**
   - 审计日志自动记录
   - 指标自动采集
   - WebSocket 实时推送

### 从 v1.x 升级到 v2.0

1. **破坏性变更**
   - 审批字段从 `approver` 改为 `actor`
   - 发布状态字段保持不变

2. **新增端点**
   - `/api/releases/:id/approvals` - 审批
   - `/api/releases/:id/schedule` - 排期
   - `/api/releases/:id/deploy` - 部署

3. **新增功能**
   - 风险评分
   - 审批路由
   - SLA 监控

## 最佳实践

### 1. 使用 HTTPS

生产环境必须使用 HTTPS。

### 2. 使用 API 密钥

保护 API 端点。

### 3. 处理错误

检查响应状态码和错误信息。

### 4. 使用分页

避免一次性获取大量数据。

### 5. 使用缓存

利用 ETag 减少不必要的请求。

### 6. 监控使用

查看指标端点了解 API 使用情况。

### 7. 订阅 Webhook

实时接收事件通知。

## 支持

如有问题，请通过以下方式联系我们：
- GitHub Issues
- 邮件：support@example.com
