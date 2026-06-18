# Release Guardian 文档（简体中文）

## 概述

Release Guardian 是一个面向企业软件交付团队的发布治理 API。它聚焦于以下几个能力：

- 发布申请管理
- 风险评分
- 审批链路
- 部署记录
- 审计时间线
- 治理指标汇总

## 快速开始

```bash
npm install
npm start
```

默认访问地址：

- `http://127.0.0.1:3000`

## 核心接口

- `GET /health`
- `GET /api/releases`
- `POST /api/releases`
- `GET /api/releases/:releaseId`
- `POST /api/releases/:releaseId/approvals`
- `POST /api/releases/:releaseId/schedule`
- `POST /api/releases/:releaseId/deploy`
- `GET /api/dashboard`

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
- `SECURITY.md`
