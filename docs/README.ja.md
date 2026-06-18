<div align="center">

# 🛡️ Release Guardian

**エンタープライズ リリースガバナンスプラットフォーム**

[![CI](https://github.com/cyl147368/release-guardian/actions/workflows/ci.yml/badge.svg)](https://github.com/cyl147368/release-guardian/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/badge/coverage-93.66%25-brightgreen)](https://github.com/cyl147368/release-guardian)
[![Node](https://img.shields.io/badge/node-%3E%3D20-green)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-MIT-blue)](../LICENSE)

[English](README.en.md) · [日本語](README.ja.md) · [中文](../README.md)

</div>

---

## 概要

Release Guardianは、ゼロ依存のエンタープライズリリースガバナンスプラットフォームです。リリースリクエストの提出から承認ルーティング、スケジューリング、デプロイメント、ロールバック回復まで、ソフトウェアリリースのライフサイクル全体を安全かつ準拠的に管理します。

**コアバリュー**: すべてのリリースを追跡可能・監査可能・制御可能にする。

### Release Guardianを選ぶ理由

| 特徴 | 説明 |
|------|------|
| 🏗️ ランタイム依存ゼロ | Node.js組み込みモジュールのみ使用、サードパーティパッケージリスクなし |
| 🛡️ 多段階承認ルーティング | リスクスコアとサービア層に基づき承認チームを自動割り当て |
| 📊 リアルタイムダッシュボード | Webコンソールでリリースステータス、リスク分布、SLA違反をリアルタイム表示 |
| 🔔 Webhookイベント | リリース状態変更時に外部システムへ自動プッシュ |
| 📝 監査ログ | 全操作の完全記録、多次元クエリ対応 |
| 📈 Prometheusメトリクス | 組み込みメトリクス収集、ワンクリックGrafana統合 |
| 🐳 コンテナ対応 | Docker + Kubernetes + Helm ワンクリックデプロイ |
| ✅ 93.66%カバレッジ | 246テストケース、エンタープライズ品質保証 |

---

## クイックスタート

### 前提条件

- Node.js >= 20
- npm >= 9

### インストールと起動

```bash
git clone https://github.com/cyl147368/release-guardian.git
cd release-guardian
npm install
npm start
```

起動後：
- **Webコンソール**: http://localhost:3000
- **APIドキュメント**: http://localhost:3000/api/policy
- **ヘルスチェック**: http://localhost:3000/health
- **Prometheusメトリクス**: http://localhost:3000/metrics

### Docker

```bash
docker build -t release-guardian .
docker run -d --name release-guardian -p 3000:3000 -v rg-data:/app/data release-guardian
```

### Kubernetes

```bash
kubectl apply -k k8s/overlays/production
# または
helm install release-guardian helm/release-guardian
```

---

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────┐
│                   Webコンソール (SPA)                     │
│  ダッシュボード│リリース一覧│作成│エスカレーション│Webhook  │
└──────────────────────────┬──────────────────────────────┘
                           │ HTTP
┌──────────────────────────┴──────────────────────────────┐
│                   ミドルウェアパイプライン                   │
│  メトリクス→セキュリティ→CORS→バリデーション→認証→ログ     │
├─────────────────────────────────────────────────────────┤
│                   ルーター (app.js)                       │
│  /health  /ready  /api/*  /metrics  /api/audit          │
├─────────────────────────────────────────────────────────┤
│                ビジネスロジック (releaseService.js)        │
│  リスク評価→承認ルーティング→SLA監視                       │
├─────────────────────────────────────────────────────────┤
│              永続化層 (repository.js)                     │
│  JSONファイルストレージ＋アトミックライト                    │
├──────────────┬──────────────────┬───────────────────────┤
│  監査ログ     │   メトリクス      │   Webhookエンジン      │
│  audit.js    │   metrics.js     │   webhooks.js         │
└──────────────┴──────────────────┴───────────────────────┘
```

---

## APIエンドポイント

### コア

| メソッド | パス | 説明 |
|---------|------|------|
| `GET` | `/health` | ヘルスチェック |
| `GET` | `/ready` | レディネスチェック（詳細付き） |
| `GET` | `/metrics` | Prometheus形式メトリクス |
| `GET` | `/api/metrics` | JSON形式メトリクス |

### リリース管理

| メソッド | パス | 説明 |
|---------|------|------|
| `GET` | `/api/releases` | リリース一覧（フィルタ・ページネーション対応） |
| `POST` | `/api/releases` | リリースリクエスト作成 |
| `POST` | `/api/releases/bulk` | 一括リリース作成 |
| `GET` | `/api/releases/:id` | リリース詳細 |
| `GET` | `/api/releases/:id/evidence` | エビデンスパッケージ |
| `GET` | `/api/releases/:id/conflicts` | ウィンドウ競合検出 |
| `POST` | `/api/releases/:id/approvals` | 承認/却下 |
| `POST` | `/api/releases/:id/schedule` | スケジューリング |
| `POST` | `/api/releases/:id/deploy` | デプロイ |

### リアルタイム（WebSocket）

| パス | 説明 |
|------|------|
| `ws://localhost:3000/ws` | WebSocket接続エンドポイント |

**イベント購読**:
```json
{
  "type": "subscribe",
  "events": ["release.created", "release.approved", "release.deployed"]
}
```

### 運用

| メソッド | パス | 説明 |
|---------|------|------|
| `GET` | `/api/dashboard` | ダッシュボード集計データ |
| `GET` | `/api/escalations` | エスカレーションアラート |
| `GET` | `/api/escalations/report` | エスカレーションレポート |
| `GET` | `/api/policy` | ガバナンスポリシー設定 |
| `GET` | `/api/audit` | 監査ログクエリ |
| `GET` | `/api/audit/stats` | 監査統計 |

### Webhook

| メソッド | パス | 説明 |
|---------|------|------|
| `GET` | `/api/webhooks` | Webhookサブスクリプション一覧 |
| `POST` | `/api/webhooks` | サブスクリプション作成 |
| `DELETE` | `/api/webhooks/:id` | サブスクリプション削除 |
| `GET` | `/api/webhooks/events` | イベントログ |

---

## ガバナンスモデル

### リスク評価

リリースリクエスト作成時に、以下の次元に基づきリスクスコア（0-100）を自動計算：

- **サービア層**: Tier 1（重要）/ Tier 2（標準）/ Tier 3（一般）
- **変更カテゴリ**: 緊急 > 通常 > 標準
- **コントロール項目**: 自動テスト、ロールバック準備、モニタリング、セキュリティレビュー
- **影響スコア**: 顧客影響 + データ機密性

### 承認ルーティング

リスクスコア >= 70のリリースは手動承認が必要：

| チーム | 条件 | SLA |
|--------|------|-----|
| Release Management | 全リリース | 4-8時間 |
| Security | セキュリティ未レビューまたはデータ機密性 >= 3 | 8時間 |
| SRE | Tier 1サービスまたは本番環境 | 4時間 |

### ステートマシン

```
draft → pending_approval → approved → scheduled → deployed
                  ↓                       ↑
              rejected              rolled_back
```

---

## 設定

| 変数 | デフォルト | 説明 |
|------|-----------|------|
| `PORT` | `3000` | リッスンポート |
| `HOST` | `127.0.0.1` | リッスンアドレス |
| `NODE_ENV` | `development` | 実行環境 |
| `RATE_LIMIT_ENABLED` | `false` | レート制限有効化 |
| `RATE_LIMIT_MAX` | `100` | ウィンドウ内最大リクエスト数 |
| `API_KEYS` | _(空)_ | APIキー（カンマ区切り） |
| `CORS_ORIGIN` | `*` | CORS許可オリジン |
| `MAX_BODY_BYTES` | `1048576` | 最大リクエストボディサイズ |

---

## 開発

```bash
npm test                # テスト実行
npm run test:coverage   # カバレッジ付きテスト
npm run lint            # リントチェック
npm run quality         # 総合品質ゲート
npm run seed            # デモデータ生成
npm run benchmark       # パフォーマンスベンチマーク
```

---

## ドキュメント

| ドキュメント | 説明 |
|-------------|------|
| [API変更履歴](API-CHANGELOG.md) | APIバージョン変更記録 |
| [デプロイメントガイド](DEPLOYMENT.md) | 詳細なデプロイメント手順 |
| [運用マニュアル](OPERATIONS.md) | 日常運用操作 |
| [可观測性](OBSERVABILITY.md) | モニタリング、ログ、アラート |
| [パフォーマンス](PERFORMANCE.md) | ベンチマークと最適化 |
| [セキュリティ](SECURITY.md) | セキュリティベストプラクティス |
| [トラブルシューティング](TROUBLESHOOTING.md) | 一般的な問題と解決策 |
| [ロードマップ](ROADMAP.md) | 将来の計画 |
| [ADR](adr/) | アーキテクチャ決定記録 |

---

## コントリビュート

コントリビューションを歓迎します！[CONTRIBUTING.md](../CONTRIBUTING.md)をお読みください。

---

## ライセンス

[MIT License](../LICENSE) © 2026 Release Guardian Contributors
