# Release Guardian 文档（简体中文）

## 概述

Release Guardian 是一个面向企业软件交付团队的发布治理 API。它聚焦于以下几个能力：

- 发布申请管理
- 风险评分
- 审批链路
- 部署记录
- 审计时间线
- 治理指标汇总
- 就绪探针（Readiness Probe）

## 快速开始

```bash
npm install
npm start
```

默认访问地址：

- `http://127.0.0.1:3000`

## 核心接口

- `GET /health` — 健康检查探针，返回纯文本 `ok`
- `GET /ready` — 就绪探针，检查数据存储健康状态，返回 JSON
- `GET /api/releases` — 查询发布列表，支持多维筛选与分页
- `POST /api/releases` — 创建发布申请
- `GET /api/releases/:releaseId` — 获取单个发布详情
- `GET /api/releases/:releaseId/evidence` — 获取审计证据包
- `GET /api/releases/:releaseId/conflicts` — 查询发布窗口冲突
- `POST /api/releases/:releaseId/approvals` — 审批或驳回发布
- `POST /api/releases/:releaseId/schedule` — 调度已批准的发布
- `POST /api/releases/:releaseId/deploy` — 记录部署结果
- `GET /api/dashboard` — 治理仪表板指标
- `GET /api/escalations` — 运营升级摘要
- `GET /api/escalations/report` — 管理层升级报告
- `GET /api/policy` — 治理策略配置

## 就绪探针详解

`GET /ready` 返回 JSON 格式的就绪状态：

```bash
curl -s http://localhost:3000/ready | jq .
```

- `status`: `ready`（就绪）或 `not_ready`（未就绪）
- `version`: 运行中的服务版本
- `checks.datastore.status`: `ok` 或 `error`
- `checks.datastore.releaseCount`: 数据存储中的发布总数
- `checks.datastore.teamCount`: 数据存储中的团队总数

当数据存储不可用时，返回 HTTP 503。

## 验证命令

```bash
npm run lint
npm test
npm run test:coverage
npm run test:bootstrap
```

## 运维建议

- 将 JSON 存储替换为数据库
- 增加身份认证和 RBAC
- 引入集中日志、指标与追踪
- 建立备份恢复流程

更多说明请查看：

- `README.md`
- `docs/DEPLOYMENT.md`
- `docs/OPERATIONS.md`
- `docs/SECURITY.md`
