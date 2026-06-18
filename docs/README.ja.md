# Release Guardian ドキュメント（日本語）

## 概要

Release Guardian は、企業向けソフトウェア配信チームのためのリリースガバナンス API です。

主な機能:

- リリース申請管理
- リスクスコアリング
- 承認フロー
- デプロイ記録
- 監査タイムライン
- ダッシュボード指標
- レディネスプローブ

## クイックスタート

```bash
npm install
npm start
```

既定の URL:

- `http://127.0.0.1:3000`

## コアエンドポイント

- `GET /health` — ヘルスプローブ、プレーンテキスト `ok` を返却
- `GET /ready` — レディネスプローブ、データストアの健全性を JSON で返却
- `GET /api/releases` — リリース一覧、フィルタ・ページネーション対応
- `POST /api/releases` — リリース申請の作成
- `GET /api/releases/:releaseId` — 単一リリースの取得
- `GET /api/releases/:releaseId/evidence` — 監査エビデンスパッケージ
- `GET /api/releases/:releaseId/conflicts` — リリースウィンドウ衝突の照会
- `POST /api/releases/:releaseId/approvals` — リリースの承認・却下
- `POST /api/releases/:releaseId/schedule` — 承認済みリリースのスケジュール
- `POST /api/releases/:releaseId/deploy` — デプロイ結果の記録
- `GET /api/dashboard` — ガバナンスダッシュボード
- `GET /api/escalations` — オペレーショナルエスカレーション概要
- `GET /api/escalations/report` — エグゼクティブエスカレーションレポート
- `GET /api/policy` — ガバナンスポリシー

## レディネスプローブ

`GET /ready` は JSON 形式のレディネス状態を返却します：

```bash
curl -s http://localhost:3000/ready | jq .
```

- `status`: `ready`（準備完了）または `not_ready`（未準備）
- `version`: 実行中のサービスバージョン
- `checks.datastore.status`: `ok` または `error`
- `checks.datastore.releaseCount`: データストア内のリリース総数
- `checks.datastore.teamCount`: データストア内のチーム総数

データストアが利用不能な場合、HTTP 503 を返却します。

## 検証コマンド

```bash
npm run lint
npm test
npm run test:coverage
npm run test:bootstrap
```

## 本番導入前の推奨事項

- JSON 永久化をデータベースへ置き換える
- 認証と RBAC を追加する
- ログ、メトリクス、トレーシングを集中管理する
- バックアップと復旧手順を整備する
