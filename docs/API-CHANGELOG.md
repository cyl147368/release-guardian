# API 变更日志

本文档记录 Release Guardian API 的所有破坏性和非破坏性变更。

## v2.0.0 (2026-06-18)

### 破坏性变更

- `GET /api/releases` 响应格式变更：
  - 之前：`{ data: [release, ...] }`
  - 之后：`{ data: [release, ...], pagination: { total, limit, offset, hasMore } }`
  - 迁移指南：客户端应使用 `data` 数组获取发布列表，使用 `pagination` 对象获取分页信息

### 新增功能

- 请求体大小限制（413 Payload Too Large）
- Content-Type 验证（415 Unsupported Media Type）
- `MAX_BODY_BYTES` 环境变量

## v1.9.0 (2026-06-18)

### 新增功能

- 单元测试覆盖时间工具和验证工具模块
- 应用层测试覆盖 Webhook、批量操作、就绪探针

## v1.8.0 (2026-06-18)

### 新增功能

- CORS 中间件（可配置来源、方法、预检处理）
- 安全响应头（HSTS、CSP、X-Content-Type-Options、X-Frame-Options）
- 优雅关闭（SIGTERM/SIGINT 处理）

## v1.7.0 (2026-06-18)

### 新增功能

- 多阶段 Dockerfile（非 root 用户、健康检查、OCI 标签）
- docker-compose.yml（生产 + 开发配置）
- GitHub Actions CI（多 Node 矩阵、覆盖率阈值、OpenAPI 合约测试）
- Kustomize Kubernetes 清单（staging/production 覆盖层）
- Helm Chart（可配置副本、Ingress、自动扩缩、持久化、密钥）
- 性能测试脚本（scripts/benchmark.js）
- 数据库迁移文档

## v1.6.0 (2026-06-18)

### 新增功能

- 批量发布创建 `POST /api/releases/bulk`（最多 50 个，支持部分失败）
- Webhook 订阅管理 `GET/POST /api/webhooks`
- Webhook 订阅删除 `DELETE /api/webhooks/:id`
- Webhook 事件日志 `GET /api/webhooks/events`

## v1.5.0 (2026-06-18)

### 新增功能

- 结构化 JSON 日志（可配置级别、子日志器）
- 请求日志中间件（关联 ID、计时）
- 速率限制中间件（滑动窗口、每客户端 IP）
- API Key 认证中间件（路径白名单）
- `X-Request-Id` 响应头
- `X-RateLimit-*` 响应头

## v1.4.0 (2026-06-18)

### 新增功能

- 就绪探针 `GET /ready`（数据存储健康检查）

## v1.3.0 (2026-06-18)

### 新增功能

- 管理层升级报告 `GET /api/escalations/report`
- 审计证据包增强（冲突检查、升级标志、补救措施）
- 调度冲突阻止（409 release_window_conflict）
- 丰富的 OpenAPI schema

## v1.2.0 (2026-06-18)

### 新增功能

- 发布列表筛选（环境、状态、风险等级、应用、负责人）
- 分页和排序
- 治理策略端点 `GET /api/policy`
- 审计证据端点 `GET /api/releases/:id/evidence`
- 发布窗口冲突端点 `GET /api/releases/:id/conflicts`
- 运营升级端点 `GET /api/escalations`

## v1.1.0 (2026-06-18)

### 新增功能

- 运行时启动抽象
- 原子文件写入
- Unix socket 支持

## v1.0.0 (2026-06-18)

### 初始发布

- 发布生命周期管理
- 风险评分和审批路由
- 部署记录和仪表板指标
- OpenAPI 定义、Dockerfile、GitHub Actions、测试
