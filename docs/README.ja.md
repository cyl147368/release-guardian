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

## クイックスタート

```bash
npm install
npm start
```

既定の URL:

- `http://127.0.0.1:3000`

## 検証コマンド

```bash
npm run lint
npm test
npm run test:coverage
npm run test:bootstrap
```

## 本番導入前の推奨事項

- JSON 永続化をデータベースへ置き換える
- 認証と RBAC を追加する
- ログ、メトリクス、トレーシングを集中管理する
- バックアップと復旧手順を整備する
