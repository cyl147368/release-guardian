# Release Guardian（日本語）

Release Guardian は、明確なリリース承認、監査可能なデプロイ記録、リスク認識に基づく運用判断を必要とするエンジニアリング組織向けのエンタープライズグレードリリースガバナンス API です。

## 1. 概要

Release Guardian は、プラットフォームチームが5つの重要な質問に答えるのを支援します：

1. どのような変更がリリースされようとしているか？
2. 各リリースのリスクはどの程度か？
3. 本番環境へのデプロイ前に誰の承認が必要か？
4. デプロイ中に何が起きたか？
5. リーダーシップはどのガバナンス指標を監視すべきか？

本プロジェクトはNode.jsのビルトイン機能を使用して実装されており、サードパーティのランタイム依存がありません。運用フットプリントが小さく、サプライチェーンの攻撃表面が狭く、コードベースの検査が容易です。

## 2. コア機能

- すべてのリリースリクエストに対するリスクスコアリング
- 環境、サービスティア、統制状態に基づく承認ルーティング
- ステートフルなリリースライフサイクル追跡
- デプロイスケジューリングと実行記録
- 重要なすべてのアクションの監査タイムライン
- ガバナンスと変更パフォーマンスのダッシュボード指標
- 安定した監査識別子を持つエグゼクティブエスカレーションレポート
- ダウンストリーム統合のためのスキーマリッチなOpenAPIコントラクト
- コンテナ化されたランタイムとCIワークフロー
- バルクリリース作成（最大50件）
- Webhookイベント通知システム
- 構造化JSONログと相関ID
- レート制限とAPI Key認証
- CORSとセキュリティヘッダー
- 多言語ドキュメント

## 3. 製品スコープ

初期デリバリーは、リリースガバナンスのバックエンドコントロールプレーンに焦点を当てています：

- 内部リリースポータルの基盤
- エンタープライズワークフローツール背後のAPIサービス
- 変更管理システムの教育/参考プロジェクト
- UI、RBAC、SSO、外部承認への将来拡張のための安全なベースライン

## 4. アーキテクチャ

```text
クライアント / オートメーション
        |
        v
  HTTP APIレイヤー
        |
        v
  ミドルウェアパイプライン（ログ、レート制限、認証、CORS、セキュリティヘッダー）
        |
        v
  リリースサービス
        |
        v
  JSONリポジトリ
        |
        v
  永続データファイル
```

### アーキテクチャノート

- `src/server.js`：HTTPサーバーを起動
- `src/app.js`：リクエストをルーティングしAPIレスポンスを構築
- `src/services/releaseService.js`：ビジネスロジックを保持
- `src/repository.js`：永続化を分離
- `src/lib/http.js`：HTTPユーティリティ関数
- `src/lib/logger.js`：構造化JSONロガー
- `src/lib/middleware.js`：リクエストログ、レート制限、API Key認証、CORS、セキュリティヘッダー
- `src/lib/webhooks.js`：Webhookサブスクリプションとイベントディスパッチ
- `src/lib/validation.js`：入力検証
- `src/lib/time.js`：時間ユーティリティ
- `tests/*.test.js`：サービスおよびAPIテストカバレッジ

## 5. 技術選択

- 言語：JavaScript（ESモジュール）
- ランタイム：Node.js 20+（Node.js 24で検証済み）
- テスト：ネイティブ `node:test`
- 永続化：JSONファイルリポジトリ
- API記述：OpenAPI 3.1
- コンテナランタイム：Docker
- CI：GitHub Actions
- デプロイ：Kubernetes（Kustomize + Helm）

## 6. 機能設計

### 6.1 リリースライフサイクル

リリース状態：

- `draft`（下書き）
- `pending_approval`（承認待ち）
- `approved`（承認済み）
- `rejected`（却下）
- `scheduled`（スケジュール済み）
- `deployed`（デプロイ済み）
- `rolled_back`（ロールバック済み）

### 6.2 リスク入力

リスクは以下から算出されます：

- 対象環境
- サービスクリティカリティティア
- 変更カテゴリ
- 影響を受けるコンポーネント数
- 顧客影響スコア
- データ感度スコア
- 自動テスト準備状態
- ロールバック準備状態
- モニタリング準備状態
- セキュリティレビュー完了状態

### 6.3 承認ルーティング

- ベースライン承認：リリース管理チーム
- 追加承認：SRE（高リスクリリース）
- 追加承認：セキュリティ（重要またはティア1リリース）

## 7. APIエンドポイント

### `GET /health`

ヘルスプローブ。プレーンテキスト `ok` を返却。

### `GET /ready`

レディネスプローブ。データストアの健全性をチェック。

```bash
curl -s http://localhost:3000/ready | jq .
```

レスポンスフィールド：

- `status`：`ready` または `not_ready`
- `version`：実行中のサービスバージョン
- `checks.datastore.status`：`ok` または `error`
- `checks.datastore.releaseCount`：データストア内のリリース総数
- `checks.datastore.teamCount`：データストア内のチーム総数

### `GET /api/releases`

リリース一覧の照会。複数のフィルタとページネーションをサポート。

サポートされるクエリパラメータ：

- `environment`、`status`、`riskBand`、`application`、`owner`
- `pendingApprovals`、`sort`、`order`、`limit`、`offset`

### `POST /api/releases`

リリース申請を作成。

### `POST /api/releases/bulk`

バルクリリース作成（最大50件）。部分失敗をサポート。

### `GET /api/releases/:releaseId`

単一リリースの取得。

### `GET /api/releases/:releaseId/evidence`

監査エビデンスパッケージの取得。

### `GET /api/releases/:releaseId/conflicts`

リリースウィンドウ衝突の照会。

### `POST /api/releases/:releaseId/approvals`

リリースの承認または却下。

### `POST /api/releases/:releaseId/schedule`

承認済みリリースのスケジュール。ウィンドウ衝突がある場合 `409 release_window_conflict` を返却。

### `POST /api/releases/:releaseId/deploy`

デプロイ結果の記録。

### `GET /api/dashboard`

ガバナンスダッシュボード指標。

### `GET /api/escalations`

オペレーショナルエスカレーション概要。

### `GET /api/escalations/report`

エグゼクティブエスカレーションレポート。

### `GET /api/policy`

ガバナンスポリシー設定。

## 7.1 Webhook API

### `GET /api/webhooks`

すべてのWebhookサブスクリプションを一覧表示。

### `POST /api/webhooks`

Webhookサブスクリプションを作成。

### `DELETE /api/webhooks/:webhookId`

Webhookサブスクリプションを削除。

### `GET /api/webhooks/events`

Webhookイベント配信ログを返却（ページネーション対応）。

## 7.2 デプロイ

### Docker

```bash
docker build -t release-guardian:latest .
docker run -p 3000:3000 release-guardian:latest
```

### Kubernetes（Kustomize）

```bash
kubectl apply -k k8s/overlays/staging
kubectl apply -k k8s/overlays/production
```

### Kubernetes（Helm）

```bash
helm install release-guardian helm/release-guardian \
  --set image.tag=2.0.0 \
  --set config.logLevel=info
```

## 8. エラーモデル

すべてのエラーは統一形式に従います：

```json
{
  "error": {
    "code": "not_found",
    "message": "Release xyz was not found.",
    "details": {}
  }
}
```

| ステータスコード | エラーコード | 意味 |
|-----------------|-------------|------|
| 400 | `validation_error` | リクエストパラメータが無効 |
| 401 | `unauthorized` | API Keyが不足または無効 |
| 404 | `not_found` | リソースが存在しない |
| 409 | `release_window_conflict` | リリースウィンドウ衝突 |
| 429 | `rate_limit_exceeded` | レート制限を超過 |
| 500 | `internal_error` | サーバー内部エラー |

## 9. クイックスタート

```bash
git clone https://github.com/cyl147368/release-guardian.git
cd release-guardian
npm install
npm start
```

デフォルトで `http://127.0.0.1:3000` で起動。

### 環境変数

| 変数 | デフォルト | 説明 |
|------|-----------|------|
| `PORT` | `3000` | サービスポート |
| `HOST` | `127.0.0.1` | リッスンアドレス |
| `LOG_LEVEL` | `info` | ログレベル |
| `RATE_LIMIT_ENABLED` | `false` | レート制限を有効化 |
| `RATE_LIMIT_MAX` | `100` | ウィンドウ内の最大リクエスト数 |
| `API_KEYS` | _(空)_ | カンマ区切りのAPI Key |
| `CORS_ORIGIN` | `*` | CORS許可オリジン |
| `MAX_BODY_BYTES` | `1048576` | Maximum request body size |
| `SECURITY_HEADERS` | `true` | セキュリティヘッダーを有効化 |

## 10. 検証コマンド

```bash
npm run lint           # 構文チェック
npm test               # テスト実行（135テスト）
npm run test:coverage  # カバレッジ付きテスト
npm run test:bootstrap # ブートストラップテスト
```

## 11. テスト戦略

- すべてのビジネスロジックをカバーするユニットテスト
- すべてのHTTPルートとステータスコードをカバーするAPIテスト
- OpenAPIコントラクトテストによるスキーマ検証
- ログ、レート制限、認証、CORSをカバーするミドルウェアテスト
- Webhookサブスクリプション、ディスパッチ、配信追跡テスト
- バルク操作の部分失敗シナリオテスト
- カバレッジ閾値：80%

## 12. 本番導入前の推奨事項

- JSON永続化をデータベースへ置き換える（`docs/DATABASE-MIGRATION.md`参照）
- 認証とRBACを追加する
- ログ、メトリクス、トレーシングを集中管理する
- バックアップと復旧手順を整備する
- `docs/OPERATIONS.md`と`docs/SECURITY.md`を参照

## 13. ライセンス

MIT
