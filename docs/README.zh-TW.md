# Release Guardian（繁體中文）

Release Guardian 是一個企業級發佈治理 API，面向需要清晰的發佈審批、可稽核的部署記錄和風險感知運營決策的工程團隊。

## 1. 概述

Release Guardian 平台工程團隊回答五個關鍵問題：

1. 什麼變更即將上線？
2. 每個發佈的風險有多大？
3. 生產環境部署前需要誰來審批？
4. 部署過程中發生了什麼？
5. 管理層應該關注哪些治理指標？

本專案使用 Node.js 內建能力實現，無第三方運行時依賴。運營開銷小、供應鏈攻擊面窄、程式碼易於審查。

## 2. 核心能力

- 每個發佈請求的風險評分
- 基於環境、服務層級和控制狀態的審批路由
- 有狀態的發佈生命週期追蹤
- 部署排程和執行記錄
- 每個重要操作的稽核時間線
- 治理和變更績效的儀表板指標
- 帶有穩定稽核標識符的管理層升級報告
- 用於下游整合的 schema 豐富的 OpenAPI 合約
- 容器化運行時和 CI 工作流
- 批次發佈建立（最多 50 個）
- Webhook 事件通知系統
- 結構化 JSON 日誌與關聯 ID
- 速率限制與 API Key 認證
- CORS 和安全回應標頭
- 多語言文件

## 3. 產品範圍

本專案的初始交付聚焦於發佈治理的後端控制平面，適用於：

- 內部發佈入口的基礎
- 企業工作流工具背後的 API 服務
- 變更管理系統教學/參考專案
- 未來擴展到 UI、RBAC、SSO 和外部審批的安全基線

## 4. 架構

```text
客戶端 / 自動化工具
        |
        v
  HTTP API 層
        |
        v
  中介軟體管道（日誌、速率限制、認證、CORS、安全標頭）
        |
        v
  發佈服務
        |
        v
  JSON 倉庫
        |
        v
  持久化資料檔案
```

### 架構說明

- `src/server.js`：啟動 HTTP 伺服器
- `src/app.js`：路由請求並構造 API 回應
- `src/services/releaseService.js`：承載業務邏輯
- `src/repository.js`：隔離持久化層
- `src/lib/http.js`：HTTP 工具函數
- `src/lib/logger.js`：結構化 JSON 日誌
- `src/lib/middleware.js`：請求日誌、速率限制、API Key 認證、CORS、安全標頭
- `src/lib/webhooks.js`：Webhook 訂閱和事件分發
- `src/lib/validation.js`：輸入驗證
- `src/lib/time.js`：時間工具函數
- `tests/*.test.js`：服務和 API 測試覆蓋

## 5. 技術選型

- 語言：JavaScript（ES 模組）
- 運行時：Node.js 20+（在 Node.js 24 上驗證）
- 測試：原生 `node:test`
- 持久化：JSON 檔案倉庫
- API 描述：OpenAPI 3.1
- 容器運行時：Docker
- CI：GitHub Actions
- 部署：Kubernetes（Kustomize + Helm）

## 6. 功能設計

### 6.1 發佈生命週期

發佈狀態：

- `draft`（草稿）
- `pending_approval`（待審批）
- `approved`（已核准）
- `rejected`（已駁回）
- `scheduled`（已排程）
- `deployed`（已部署）
- `rolled_back`（已回滾）

### 6.2 風險輸入

風險由以下因素計算：

- 目標環境
- 服務關鍵性等級
- 變更類別
- 影響的元件數量
- 客戶影響分數
- 資料敏感度分數
- 自動化測試就緒狀態
- 回滾就緒狀態
- 監控就緒狀態
- 安全審查完成狀態

### 6.3 審批路由

- 基線審批：發佈管理團隊
- 附加審批：SRE（高風險發佈）
- 附加審批：安全團隊（關鍵或 Tier-1 發佈）

## 7. API 介面

### `GET /health`

健康檢查探針，回傳純文字 `ok`。

### `GET /ready`

就緒探針，檢查資料儲存健康狀態。

```bash
curl -s http://localhost:3000/ready | jq .
```

回應欄位：

- `status`：`ready` 或 `not_ready`
- `version`：執行中的服務版本
- `checks.datastore.status`：`ok` 或 `error`
- `checks.datastore.releaseCount`：資料儲存中的發佈總數
- `checks.datastore.teamCount`：資料儲存中的團隊總數

### `GET /api/releases`

查詢發佈清單，支援多維篩選與分頁。

支援的查詢參數：

- `environment` — 環境篩選
- `status` — 狀態篩選
- `riskBand` — 風險等級篩選
- `application` — 應用名稱篩選
- `owner` — 負責人篩選
- `pendingApprovals` — 僅待審批
- `sort` — 排序欄位
- `order` — 排序方向
- `limit` — 每頁數量
- `offset` — 偏移量

### `POST /api/releases`

建立發佈申請。

### `POST /api/releases/bulk`

批次建立發佈（最多 50 個）。支援部分失敗：成功建立的發佈與每項錯誤一同回傳。

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

回應欄位：

- `created`：成功建立的數量
- `failed`：驗證失敗的數量
- `releases`：建立成功的發佈陣列
- `errors`：失敗項的 `{ index, code, message }` 陣列

### `GET /api/releases/:releaseId`

取得單筆發佈詳情。

### `GET /api/releases/:releaseId/evidence`

取得稽核證據包，包含控制證據、審批證據、部署結果證據、穩定證據標識符、衝突檢查、升級標誌和補救措施。

### `GET /api/releases/:releaseId/conflicts`

查詢同一應用和環境的發佈窗口衝突。

### `POST /api/releases/:releaseId/approvals`

審批或駁回發佈。

### `POST /api/releases/:releaseId/schedule`

排程已核准的發佈。如果存在活動的發佈窗口衝突，回傳 `409 release_window_conflict`。

### `POST /api/releases/:releaseId/deploy`

記錄部署結果。

### `GET /api/dashboard`

治理儀表板指標。

### `GET /api/escalations`

營運升級摘要：逾期審批、高風險待處理發佈、發佈窗口衝突。

### `GET /api/escalations/report`

管理層升級報告。

### `GET /api/policy`

治理策略設定。

## 7.1 Webhook API

### `GET /api/webhooks`

列出所有活躍的 Webhook 訂閱。

### `POST /api/webhooks`

建立 Webhook 訂閱。

### `DELETE /api/webhooks/:webhookId`

移除 Webhook 訂閱。

### `GET /api/webhooks/events`

回傳 Webhook 事件投遞日誌，支援分頁。

## 7.2 部署

### Docker

```bash
docker build -t release-guardian:latest .
docker run -p 3000:3000 release-guardian:latest
```

### Kubernetes（Kustomize）

```bash
kubectl apply -k k8s/overlays/staging      # 預發布環境
kubectl apply -k k8s/overlays/production   # 生產環境
```

### Kubernetes（Helm）

```bash
helm install release-guardian helm/release-guardian \
  --set image.tag=2.0.0 \
  --set config.logLevel=info
```

## 8. 錯誤模型

所有錯誤遵循統一格式：

```json
{
  "error": {
    "code": "not_found",
    "message": "Release xyz was not found.",
    "details": {}
  }
}
```

HTTP 狀態碼對應：

| 狀態碼 | 錯誤碼 | 含義 |
|--------|--------|------|
| 400 | `validation_error` | 請求參數無效 |
| 401 | `unauthorized` | 缺少或無效的 API Key |
| 404 | `not_found` | 資源不存在 |
| 409 | `release_window_conflict` | 發佈窗口衝突 |
| 429 | `rate_limit_exceeded` | 超出速率限制 |
| 500 | `internal_error` | 伺服器內部錯誤 |

## 9. 快速開始

```bash
git clone https://github.com/cyl147368/release-guardian.git
cd release-guardian
npm install
npm start
```

服務預設在 `http://127.0.0.1:3000` 啟動。

### 環境變數

| 變數 | 預設值 | 說明 |
|------|--------|------|
| `PORT` | `3000` | 服務埠 |
| `HOST` | `127.0.0.1` | 監聽位址 |
| `LOG_LEVEL` | `info` | 日誌層級 |
| `RATE_LIMIT_ENABLED` | `false` | 啟用速率限制 |
| `RATE_LIMIT_MAX` | `100` | 每窗口最大請求數 |
| `API_KEYS` | _(空)_ | 逗號分隔的 API Key |
| `CORS_ORIGIN` | `*` | CORS 允許的來源 |
| `MAX_BODY_BYTES` | `1048576` | Maximum request body size |
| `SECURITY_HEADERS` | `true` | 啟用安全回應標頭 |

## 10. 驗證命令

```bash
npm run lint           # 語法檢查
npm test               # 執行測試（135 個測試）
npm run test:coverage  # 帶覆蓋率的測試
npm run test:bootstrap # 啟動配置測試
```

## 11. 測試策略

- 單元測試覆蓋所有業務邏輯
- API 測試覆蓋所有 HTTP 路由和狀態碼
- OpenAPI 合約測試驗證 schema 一致性
- 中介軟體測試覆蓋日誌、速率限制、認證、CORS
- Webhook 測試覆蓋訂閱、分發、投遞追蹤
- 批次操作測試覆蓋部分失敗場景
- 覆蓋率閾值：80%

## 12. 運維建議

- 將 JSON 儲存替換為資料庫（參見 `docs/DATABASE-MIGRATION.md`）
- 新增身分驗證與 RBAC
- 導入集中式日誌與追蹤
- 建立備份與還原流程
- 參閱 `docs/OPERATIONS.md` 和 `docs/SECURITY.md`

## 13. 授權

MIT
