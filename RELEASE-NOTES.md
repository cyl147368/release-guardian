# Release Guardian 发布说明

## v2.0.0 (2026-06-18)

### 重大改进

这是一个企业级的重大版本升级，从 v1.0.0 到 v2.0.0，涵盖了大量的功能增强和基础设施改进。

### 核心特性

#### 发布治理
- 完整的发布生命周期管理（草稿 → 待审批 → 已批准 → 已排期 → 已部署 → 已回滚）
- 基于多维度的风险评分（环境、服务层级、变更类别、组件数量、控制状态）
- 智能审批路由（发布管理、SRE、安全团队）
- 发布窗口冲突检测和阻止
- 批量发布创建（最多 50 个，支持部分失败）

#### 审计与合规
- 每个发布的完整审计时间线
- 审计证据包（控制证据、审批证据、部署证据）
- 管理层升级报告（稳定审计标识符、严重性分布）
- 审批 SLA 跟踪和违规告警

#### Webhook 事件系统
- 可配置的 Webhook 订阅（支持通配符和特定事件）
- 事件投递跟踪（成功/失败/重试）
- HMAC 签名支持（可选）

### 安全特性

#### 认证与授权
- API Key 认证（可配置路径白名单）
- 速率限制（滑动窗口、每客户端 IP）
- CORS 配置（可配置来源、方法、头）
- 安全响应头（HSTS、CSP、X-Frame-Options、X-Content-Type-Options）

#### 输入安全
- 请求体大小限制（413 Payload Too Large）
- Content-Type 验证（415 Unsupported Media Type）
- 输入清理工具（HTML 转义、控制字符移除）
- 严格的输入验证（类型检查、枚举边界、数值范围）

### 可观测性

#### 日志与追踪
- 结构化 JSON 日志（可配置级别：debug/info/warn/error）
- 请求关联 ID（X-Request-Id 传播）
- 请求计时和状态码日志
- 子日志器支持（模块级日志前缀）

#### 健康检查
- 健康探针（GET /health）
- 就绪探针（GET /ready，含数据存储健康检查）
- 优雅关闭（SIGTERM/SIGINT 处理）

### API 增强

#### 分页
- 列表端点支持分页元数据（total, limit, offset, hasMore）
- 可配置的每页数量和偏移量

#### 端点覆盖
- 17 个 API 端点，全部在 OpenAPI 3.1 中文档化
- 丰富的请求/响应示例
- 统一的错误响应模型

### 基础设施

#### 容器化
- 多阶段 Dockerfile（非 root 用户、健康检查、OCI 标签）
- docker-compose.yml（生产 + 开发配置）

#### Kubernetes
- Kustomize 清单（base + staging/production 覆盖层）
- Helm Chart（可配置副本、Ingress、自动扩缩、持久化、密钥）

#### CI/CD
- GitHub Actions CI（Node 20/22/24 矩阵）
- 80% 覆盖率阈值
- OpenAPI 合约测试
- 自动标签（基于文件变更）

### 文档

#### 多语言支持
- English (README.md)
- 简体中文 (docs/README.zh-CN.md) — 554 行
- 繁體中文 (docs/README.zh-TW.md) — 350 行
- 日本語 (docs/README.ja.md) — 322 行
- 한국어 (docs/README.ko.md) — 322 行

#### 运维文档
- 部署指南 (docs/DEPLOYMENT.md)
- 运维手册 (docs/OPERATIONS.md)
- 安全文档 (docs/SECURITY.md)
- 可观测性指南 (docs/OBSERVABILITY.md)
- 数据库迁移指南 (docs/DATABASE-MIGRATION.md)
- API 变更日志 (docs/API-CHANGELOG.md)

#### 开发文档
- 贡献指南 (CONTRIBUTING.md)
- 架构决策记录 (docs/adr/) — 5 篇
- 发布说明 (RELEASE-NOTES.md)

### 测试

- 162 个自动化测试
- 30 个测试套件
- 94.25% 行覆盖率
- 87.12% 分支覆盖率
- 95.48% 函数覆盖率

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| PORT | 3000 | 服务端口 |
| HOST | 127.0.0.1 | 监听地址 |
| NODE_ENV | development | 运行环境 |
| LOG_LEVEL | info | 日志级别 |
| RATE_LIMIT_ENABLED | false | 启用速率限制 |
| RATE_LIMIT_MAX | 100 | 每窗口最大请求数 |
| RATE_LIMIT_WINDOW_MS | 60000 | 窗口时长（毫秒） |
| API_KEYS | (空) | 逗号分隔的 API Key |
| CORS_ORIGIN | * | CORS 允许的来源 |
| SECURITY_HEADERS | true | 启用安全响应头 |
| MAX_BODY_BYTES | 1048576 | 最大请求体大小（字节） |

### 致谢

感谢所有为 Release Guardian 做出贡献的开发者和运维工程师。
