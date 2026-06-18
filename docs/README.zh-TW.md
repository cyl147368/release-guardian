# Release Guardian 文件（繁體中文）

## 概述

Release Guardian 是一個面向企業軟體交付團隊的發佈治理 API，提供：

- 發佈申請管理
- 風險評分
- 審批流程
- 部署記錄
- 稽核時間線
- 治理儀表板
- 就緒探針（Readiness Probe）

## 快速開始

```bash
npm install
npm start
```

預設位址：

- `http://127.0.0.1:3000`

## 核心介面

- `GET /health` — 健康檢查探針，回傳純文字 `ok`
- `GET /ready` — 就緒探針，檢查資料儲存健康狀態，回傳 JSON
- `GET /api/releases` — 查詢發佈清單，支援多維篩選與分頁
- `POST /api/releases` — 建立發佈申請
- `GET /api/releases/:releaseId` — 取得單筆發佈詳情
- `GET /api/releases/:releaseId/evidence` — 取得稽核證據包
- `GET /api/releases/:releaseId/conflicts` — 查詢發佈窗口衝突
- `POST /api/releases/:releaseId/approvals` — 審批或駁回發佈
- `POST /api/releases/:releaseId/schedule` — 排程已核准的發佈
- `POST /api/releases/:releaseId/deploy` — 記錄部署結果
- `GET /api/dashboard` — 治理儀表板指標
- `GET /api/escalations` — 營運升級摘要
- `GET /api/escalations/report` — 管理層升級報告
- `GET /api/policy` — 治理策略設定

## 就緒探針說明

`GET /ready` 回傳 JSON 格式的就緒狀態：

```bash
curl -s http://localhost:3000/ready | jq .
```

- `status`: `ready`（就緒）或 `not_ready`（未就緒）
- `version`: 執行中的服務版本
- `checks.datastore.status`: `ok` 或 `error`
- `checks.datastore.releaseCount`: 資料儲存中的發佈總數
- `checks.datastore.teamCount`: 資料儲存中的團隊總數

當資料儲存不可用時，回傳 HTTP 503。

## 驗證命令

```bash
npm run lint
npm test
npm run test:coverage
npm run test:bootstrap
```

## 進一步建議

- 將 JSON 儲存替換為資料庫
- 新增身分驗證與 RBAC
- 導入集中式日誌與追蹤
- 建立備份與還原流程
