# Cloudflare Demo Project

Cloudflare Worker上でKV（Key-Valueストレージ）、D1（SQLデータベース）、R2（オブジェクトストレージ）の3つのストレージサービスを統合したデモアプリケーションです。Honoフレームワークを使用して軽量で高速なREST APIを実装しています。

## 目次

- [前提条件](#前提条件)
- [プロジェクト概要](#プロジェクト概要)
- [ローカル開発環境のセットアップ](#ローカル開発環境のセットアップ)
- [Cloudflareリソースの作成](#cloudflareリソースの作成)
- [D1データベースのマイグレーション](#d1データベースのマイグレーション)
- [ローカル開発サーバーの起動](#ローカル開発サーバーの起動)
- [デプロイ手順](#デプロイ手順)
- [APIエンドポイント](#apiエンドポイント)
- [セキュリティベストプラクティス](#セキュリティベストプラクティス)

## 前提条件

このプロジェクトを実行するには、以下のツールとアカウントが必要です：

- **Node.js**: v18.0.0以上
- **npm**: v9.0.0以上
- **Cloudflareアカウント**: [無料アカウント登録](https://dash.cloudflare.com/sign-up)
- **Wrangler CLI**: Cloudflare Workers用のコマンドラインツール


| Cloudflare             | AWSで一番近いもの                      |
| ---------------------- | ------------------------------- |
| **Cloudflare KV**      | **Amazon DynamoDB**             |
| **Cloudflare D1**      | **Amazon Aurora Serverless v2** |
| **Cloudflare R2**      | **Amazon S3**                   |
| **Cloudflare Workers** | **AWS Lambda**                  |
| **Cloudflare Pages**   | **Amazon S3**                   |

### Wrangler CLIのインストール

```bash
npm install -g wrangler
```

### Cloudflareアカウントへのログイン

```bash
wrangler login
```

ブラウザが開き、Cloudflareアカウントへのアクセスを許可するよう求められます。

## プロジェクト概要

このプロジェクトは、Cloudflareのエッジコンピューティング環境で動作し、以下の機能を提供します：

### 技術スタック

- **Cloudflare Workers**: エッジランタイム環境
- **Hono**: 軽量Webフレームワーク
- **TypeScript**: 型安全性を提供
- **Wrangler**: デプロイとローカル開発用CLIツール

### ストレージサービス

1. **KV (Key-Value Storage)**: シンプルなキーバリューストレージ
2. **D1 (SQLite Database)**: 構造化データ用のSQLデータベース
3. **R2 (Object Storage)**: バイナリデータ/ファイルストレージ

## ローカル開発環境のセットアップ

### 1. リポジトリのクローン

```bash
git clone <repository-url>
cd cloudflare-demo-project
```

### 2. 依存関係のインストール

```bash
npm install
```

### 3. プロジェクト構造

```
cloudflare-demo-project/
├── src/
│   ├── index.ts          # メインWorkerエントリーポイント
│   ├── env.d.ts          # TypeScript型定義
│   └── utils/            # ユーティリティ関数
├── schema.sql            # D1データベーススキーマ
├── migrate.sh            # マイグレーション実行スクリプト
├── seed.sql              # サンプルデータ
├── seed.sh               # サンプルデータ投入スクリプト
├── wrangler.toml         # Cloudflare Workers設定
├── tsconfig.json         # TypeScript設定
└── package.json          # プロジェクト依存関係
```

## Cloudflareリソースの作成

デプロイ前に、以下のCloudflareリソースを作成する必要があります。

### 1. KV Namespaceの作成

```bash
# 本番環境用KV Namespace
npx wrangler kv:namespace create "DEMO_KV"

# プレビュー環境用KV Namespace
npx wrangler kv:namespace create "DEMO_KV" --preview
```

出力されたIDを`wrangler.toml`の該当箇所に設定します：

```toml
[[kv_namespaces]]
binding = "DEMO_KV"
id = "your-kv-namespace-id"          # ここに本番環境のIDを設定
preview_id = "your-preview-kv-namespace-id"  # ここにプレビュー環境のIDを設定
```

### 2. D1 Databaseの作成

```bash
# D1データベースの作成
wrangler d1 create demo-database
```

出力されたdatabase_idを`wrangler.toml`の該当箇所に設定します：

```toml
[[d1_databases]]
binding = "DEMO_DB"
database_name = "demo-database"
database_id = "your-d1-database-id"  # ここにIDを設定
```

### 3. R2 Bucketの作成

```bash
# R2バケットの作成
npxwrangler r2 bucket create demo-bucket

# プレビュー環境用R2バケット
wrangler r2 bucket create demo-bucket-preview
```

`wrangler.toml`の該当箇所にバケット名を設定します：

```toml
[[r2_buckets]]
binding = "DEMO_BUCKET"
bucket_name = "demo-bucket"
preview_bucket_name = "demo-bucket-preview"
```

### 4. Account IDの設定

Cloudflareダッシュボードから自分のAccount IDを取得し、`wrangler.toml`に設定します：

```bash
# 自分のID調べる
npx wrangler whoami
```

```toml
account_id = "your-account-id"  # ここにAccount IDを設定
```

Account IDは[Cloudflareダッシュボード](https://dash.cloudflare.com/)の右側のサイドバーで確認できます。

## D1データベースのマイグレーション

D1データベースにテーブルを作成します。

### 重要: ローカルとリモートの違い

- `--local`: ローカル開発環境のデータベース（`.wrangler/state/`内）
- `--remote`: Cloudflare上の本番データベース

**デプロイする場合は、必ず`--remote`フラグを使用してください。**

### 1. スキーマの適用

#### ローカル環境（開発用）

```bash
wrangler d1 execute demo-database --local --file=./schema.sql
```

#### 本番環境（Cloudflareへデプロイ）

```bash
# 1. まずスキーマを適用（テーブル作成）
wrangler d1 execute demo-database --remote --file=./schema.sql

# 2. 次にサンプルデータを投入（オプション）
wrangler d1 execute demo-database --remote --file=./seed.sql
```

**注意**: `--remote`フラグを付けないと、ローカル環境にのみ適用され、Cloudflareにデプロイしても動作しません。

または、提供されているシェルスクリプトを使用：

```bash
# スクリプトに実行権限を付与
chmod +x migrate.sh

# マイグレーション実行
./migrate.sh
```

### 2. データベースの確認

#### ローカル環境の確認

```bash
# テーブル一覧の確認
wrangler d1 execute demo-database --local --command="SELECT name FROM sqlite_master WHERE type='table';"

# ユーザーデータの確認
wrangler d1 execute demo-database --local --command="SELECT * FROM users;"
```

#### 本番環境の確認

```bash
# テーブル一覧の確認
wrangler d1 execute demo-database --remote --command="SELECT name FROM sqlite_master WHERE type='table';"

# ユーザーデータの確認
wrangler d1 execute demo-database --remote --command="SELECT * FROM users;"
```



## ローカル開発サーバーの起動

ローカル環境でWorkerを実行し、開発とテストを行います。

```bash
npm run dev
```

サーバーが起動すると、以下のURLでアクセスできます：

```
http://localhost:8787
```

### ローカル開発の特徴

- **ホットリロード**: コードを変更すると自動的に再読み込みされます
- **ローカルストレージ**: KV、D1、R2のエミュレーションを使用します
- **デバッグ**: `console.log()`の出力がターミナルに表示されます

### テストの実行

```bash
# 全テストを実行
npm test

# ウォッチモード（開発時）
npm run test:watch

# カバレッジレポート生成
npm run test:coverage
```

## デプロイ手順

### 前提条件の確認

デプロイ前に、以下が完了していることを確認してください：

1. ✅ Cloudflareリソースの作成（KV、D1、R2）
2. ✅ `wrangler.toml`の設定（account_id、各種ID）
3. ✅ **D1データベースのリモートマイグレーション（重要！）**

### 1. D1データベースのリモートマイグレーション（必須）

**デプロイ前に必ず実行してください。ローカル環境（`--local`）とリモート環境（`--remote`）は別々です。**

```bash
# 1. スキーマを適用（テーブル作成）
wrangler d1 execute demo-database --remote --file=./schema.sql

# 2. サンプルデータを投入（オプション）
wrangler d1 execute demo-database --remote --file=./seed.sql

# 3. 確認
wrangler d1 execute demo-database --remote --command="SELECT * FROM users;"
```

### 2. 設定の確認

`wrangler.toml`の以下の項目が正しく設定されていることを確認してください：

- `account_id`: CloudflareアカウントID
- KV Namespace ID
- D1 Database ID
- R2 Bucket名

### 3. 本番環境へのデプロイ

```bash
npm run deploy
```

または：

```bash
wrangler deploy
```

### 4. デプロイの確認

デプロイが成功すると、以下のようなURLが表示されます：

```
https://cloudflare-demo-project.<your-subdomain>.workers.dev
```

ブラウザまたはcurlでアクセスして動作を確認します：

```bash
# ヘルスチェック
curl https://cloudflare-demo-project.<your-subdomain>.workers.dev/health

# D1データベースの確認
curl https://cloudflare-demo-project.<your-subdomain>.workers.dev/d1/users
```

### 5. 環境別デプロイ

開発環境やステージング環境にデプロイする場合：

```bash
# 開発環境
wrangler deploy --env development

# ステージング環境
wrangler deploy --env staging
```

### 6. デプロイログの確認

```bash
# リアルタイムログの表示
wrangler tail

# 特定の環境のログ
wrangler tail --env production
```

## APIエンドポイント

### 認証について

このAPIは2種類の認証を使用します：

- **マスターキー認証**: KV操作とAPIキー管理に必要（`X-API-Key: Aquaring@74`）
- **APIキー認証**: D1とR2操作に必要（`X-API-Key: <登録済みAPIキー>`）

### ベースURL

- **ローカル**: `http://localhost:8787`
- **本番**: `https://cloudflare-demo-project.<your-subdomain>.workers.dev`

### 1. ルートエンドポイント

#### API情報の取得

```bash
curl http://localhost:8787/
```

**レスポンス例**:
```json
{
  "name": "Cloudflare Demo Project",
  "version": "1.0.0",
  "description": "Demo API integrating KV, D1, and R2 storage services",
  "authentication": {
    "kv": "Requires master key in X-API-Key header",
    "d1_r2": "Requires registered API key in X-API-Key header"
  },
  "endpoints": [...]
}
```

### 2. ヘルスチェック

#### システムステータスの確認

```bash
curl http://localhost:8787/health
```

**レスポンス例**:
```json
{
  "status": "healthy",
  "services": {
    "kv": true,
    "d1": true,
    "r2": true
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### 3. APIキー管理エンドポイント（マスターキー必須）

#### APIキーの登録

```bash
curl -X POST http://localhost:8787/kv/api-keys/my-api-key \
  -H "Content-Type: application/json" \
  -H "X-API-Key: Aquaring@74" \
  -d '{"description": "My application API key"}'
```

**レスポンス例**:
```json
{
  "success": true,
  "message": "API key \"my-api-key\" registered successfully",
  "description": "My application API key",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### 登録済みAPIキーの一覧取得

```bash
curl http://localhost:8787/kv/api-keys \
  -H "X-API-Key: Aquaring@74"
```

**レスポンス例**:
```json
{
  "success": true,
  "apiKeys": [
    {
      "key": "my-api-key",
      "description": "My application API key"
    }
  ],
  "count": 1,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### APIキーの削除

```bash
curl -X DELETE http://localhost:8787/kv/api-keys/my-api-key \
  -H "X-API-Key: Aquaring@74"
```

**レスポンス例**:
```json
{
  "success": true,
  "message": "API key \"my-api-key\" revoked successfully",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### 4. KV Storage エンドポイント（マスターキー必須）

#### キーバリューの保存

```bash
curl -X POST http://localhost:8787/kv/mykey \
  -H "Content-Type: application/json" \
  -H "X-API-Key: Aquaring@74" \
  -d '{"value": "Hello, Cloudflare!"}'
```

**レスポンス例**:
```json
{
  "success": true,
  "message": "Key \"mykey\" stored successfully",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### 値の取得

```bash
curl http://localhost:8787/kv/mykey \
  -H "X-API-Key: Aquaring@74"
```

**レスポンス例**:
```json
{
  "key": "mykey",
  "value": "Hello, Cloudflare!",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### キーの削除

```bash
curl -X DELETE http://localhost:8787/kv/mykey \
  -H "X-API-Key: Aquaring@74"
```

**レスポンス例**:
```json
{
  "success": true,
  "message": "Key \"mykey\" deleted successfully",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### 全キーのリスト取得

```bash
curl http://localhost:8787/kv \
  -H "X-API-Key: Aquaring@74"
```

**レスポンス例**:
```json
{
  "keys": ["mykey", "anotherkey"],
  "count": 2,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### 5. D1 Database エンドポイント（APIキー必須）

#### ユーザーの作成

```bash
curl -X POST http://localhost:8787/d1/users \
  -H "Content-Type: application/json" \
  -H "X-API-Key: my-api-key" \
  -d '{"name": "田中太郎", "email": "tanaka@example.com"}'
```

**レスポンス例**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "田中太郎",
    "email": "tanaka@example.com",
    "created_at": "2024-01-15 10:30:00"
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### 全ユーザーの取得

```bash
curl http://localhost:8787/d1/users \
  -H "X-API-Key: my-api-key"
```

**レスポンス例**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "田中太郎",
      "email": "tanaka@example.com",
      "created_at": "2024-01-15 10:30:00"
    }
  ],
  "count": 1,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### 特定ユーザーの取得

```bash
curl http://localhost:8787/d1/users/1 \
  -H "X-API-Key: my-api-key"
```

**レスポンス例**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "田中太郎",
    "email": "tanaka@example.com",
    "created_at": "2024-01-15 10:30:00"
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### ユーザーの更新

```bash
curl -X PUT http://localhost:8787/d1/users/1 \
  -H "Content-Type: application/json" \
  -H "X-API-Key: my-api-key" \
  -d '{"name": "田中次郎", "email": "tanaka.jiro@example.com"}'
```

**レスポンス例**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "田中次郎",
    "email": "tanaka.jiro@example.com",
    "created_at": "2024-01-15 10:30:00"
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### ユーザーの削除

```bash
curl -X DELETE http://localhost:8787/d1/users/1 \
  -H "X-API-Key: my-api-key"
```

**レスポンス例**:
```json
{
  "success": true,
  "message": "User with id 1 deleted successfully",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### 6. R2 Object Storage エンドポイント（APIキー必須）

#### ファイルのアップロード

```bash
# テキストファイルのアップロード
curl -X POST http://localhost:8787/r2/myfile.txt \
  -H "Content-Type: text/plain" \
  -H "X-API-Key: my-api-key" \
  -d "Hello, R2 Storage!"

# 画像ファイルのアップロード
curl -X POST http://localhost:8787/r2/image.jpg \
  -H "Content-Type: image/jpeg" \
  -H "X-API-Key: my-api-key" \
  --data-binary @/path/to/image.jpg
```

**レスポンス例**:
```json
{
  "success": true,
  "message": "File \"myfile.txt\" uploaded successfully",
  "contentType": "text/plain",
  "size": 18,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### ファイルのダウンロード

```bash
curl http://localhost:8787/r2/myfile.txt \
  -H "X-API-Key: my-api-key"

# ファイルとして保存
curl http://localhost:8787/r2/image.jpg \
  -H "X-API-Key: my-api-key" \
  -o downloaded-image.jpg
```

#### ファイルの削除

```bash
curl -X DELETE http://localhost:8787/r2/myfile.txt \
  -H "X-API-Key: my-api-key"
```

**レスポンス例**:
```json
{
  "success": true,
  "message": "File \"myfile.txt\" deleted successfully",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### 全オブジェクトのリスト取得

```bash
curl http://localhost:8787/r2 \
  -H "X-API-Key: my-api-key"
```

**レスポンス例**:
```json
{
  "success": true,
  "objects": [
    {
      "key": "myfile.txt",
      "size": 18,
      "uploaded": "2024-01-15T10:30:00.000Z",
      "etag": "abc123",
      "httpEtag": "\"abc123\"",
      "contentType": "text/plain"
    }
  ],
  "count": 1,
  "truncated": false,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### エラーレスポンス

全てのエラーは統一されたJSON形式で返されます：

```json
{
  "error": "Unauthorized",
  "message": "Invalid or missing API key",
  "status": 401,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**一般的なエラーコード**:
- `400 Bad Request`: 無効なリクエストボディ、バリデーションエラー
- `401 Unauthorized`: 認証エラー、無効なAPIキー
- `404 Not Found`: 存在しないリソース、存在しないエンドポイント
- `409 Conflict`: 重複するリソース（例: 同じemailのユーザー）
- `500 Internal Server Error`: サーバー側のエラー

## セキュリティベストプラクティス

### 認証システム

このプロジェクトは2段階の認証システムを実装しています：

#### 1. KV操作の認証（マスターキー）

KVストレージへの全ての操作には、固定のマスターキー `Aquaring@74` が必要です。

```bash
# マスターキーを使用したKV操作の例
curl -X POST http://localhost:8787/kv/mykey \
  -H "Content-Type: application/json" \
  -H "X-API-Key: Aquaring@74" \
  -d '{"value": "Hello, Cloudflare!"}'
```

**マスターキーで実行できる操作**:
- KVへのキーバリューの保存・取得・削除
- APIキーの登録・一覧表示・削除

#### 2. D1/R2操作の認証（APIキー）

D1データベースとR2ストレージへの操作には、KVに登録されたAPIキーが必要です。

**APIキーの登録**:
```bash
# マスターキーを使用してAPIキーを登録
curl -X POST http://localhost:8787/kv/api-keys/my-api-key \
  -H "Content-Type: application/json" \
  -H "X-API-Key: Aquaring@74" \
  -d '{"description": "My application API key"}'
```

**登録済みAPIキーの一覧表示**:
```bash
curl http://localhost:8787/kv/api-keys \
  -H "X-API-Key: Aquaring@74"
```

**APIキーの削除**:
```bash
curl -X DELETE http://localhost:8787/kv/api-keys/my-api-key \
  -H "X-API-Key: Aquaring@74"
```

**APIキーを使用したD1/R2操作の例**:
```bash
# D1データベース操作
curl http://localhost:8787/d1/users \
  -H "X-API-Key: my-api-key"

# R2ストレージ操作
curl http://localhost:8787/r2 \
  -H "X-API-Key: my-api-key"
```

#### 認証エラー

認証が失敗した場合、以下のようなエラーレスポンスが返されます：

```json
{
  "error": "Unauthorized",
  "message": "Invalid or missing API key",
  "status": 401,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### 1. 入力値のサニタイゼーション

このプロジェクトでは、全ての入力値に対してサニタイゼーションを実装しています：

```typescript
// src/utils/sanitize.ts
export function sanitizeString(input: string): string {
  return input
    .replace(/[<>]/g, '')  // HTMLタグの除去
    .trim();
}

export function sanitizeKey(input: string): string {
  return input
    .replace(/[^a-zA-Z0-9_\-\.]/g, '')  // 安全な文字のみ許可
    .trim();
}
```

### 2. SQLインジェクション対策

D1データベースへのクエリには、必ずプリペアドステートメントを使用しています：

```typescript
// 安全な実装例
const result = await env.DEMO_DB.prepare(
  'SELECT * FROM users WHERE id = ?'
).bind(userId).first();

// 危険な実装（使用しない）
// const result = await env.DEMO_DB.prepare(
//   `SELECT * FROM users WHERE id = ${userId}`
// ).first();
```

### 3. レート制限の実装例

本番環境では、レート制限を実装することを強く推奨します。以下は実装例です：

```typescript
// レート制限ミドルウェアの例
import { Hono } from 'hono';

const app = new Hono<{ Bindings: Env }>();

// レート制限ミドルウェア
app.use('*', async (c, next) => {
  const clientIP = c.req.header('CF-Connecting-IP') || 'unknown';
  const rateLimitKey = `rate_limit:${clientIP}`;
  
  // KVから現在のリクエスト数を取得
  const currentCount = await c.env.DEMO_KV.get(rateLimitKey);
  const count = currentCount ? parseInt(currentCount, 10) : 0;
  
  // 1分間に100リクエストまで許可
  const RATE_LIMIT = 100;
  const WINDOW_SECONDS = 60;
  
  if (count >= RATE_LIMIT) {
    return c.json({
      error: 'RateLimitExceeded',
      message: 'Too many requests. Please try again later.',
      status: 429,
      timestamp: new Date().toISOString(),
    }, 429);
  }
  
  // カウントを増やす
  await c.env.DEMO_KV.put(
    rateLimitKey,
    (count + 1).toString(),
    { expirationTtl: WINDOW_SECONDS }
  );
  
  await next();
});
```

### 4. CORS設定

本番環境では、特定のオリジンのみを許可するようCORS設定を調整してください：

```typescript
// 開発環境（現在の設定）
app.use('*', cors({
  origin: '*',  // 全てのオリジンを許可
  // ...
}));

// 本番環境（推奨）
app.use('*', cors({
  origin: ['https://yourdomain.com', 'https://app.yourdomain.com'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));
```

### 5. 認証と認可

本番環境では、APIエンドポイントに認証を追加することを推奨します：

```typescript
// 認証ミドルウェアの例
app.use('/d1/*', async (c, next) => {
  const authHeader = c.req.header('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({
      error: 'Unauthorized',
      message: 'Missing or invalid authorization header',
      status: 401,
      timestamp: new Date().toISOString(),
    }, 401);
  }
  
  const token = authHeader.substring(7);
  
  // トークンの検証（実装は環境に応じて調整）
  const isValid = await verifyToken(token);
  
  if (!isValid) {
    return c.json({
      error: 'Unauthorized',
      message: 'Invalid token',
      status: 401,
      timestamp: new Date().toISOString(),
    }, 401);
  }
  
  await next();
});
```

### 6. 環境変数とシークレット

機密情報は環境変数として管理し、コードにハードコードしないでください：

```bash
# シークレットの設定
wrangler secret put API_SECRET_KEY
wrangler secret put DATABASE_ENCRYPTION_KEY
```

```typescript
// コード内での使用
const secretKey = c.env.API_SECRET_KEY;
```

### 7. ログとモニタリング

本番環境では、適切なログとモニタリングを設定してください：

```typescript
// エラーログの記録
app.onError((err, c) => {
  console.error('Error:', {
    message: err.message,
    stack: err.stack,
    path: c.req.path,
    method: c.req.method,
    timestamp: new Date().toISOString(),
  });
  
  // エラーレスポンスを返す
  return c.json({
    error: err.name || 'InternalServerError',
    message: err.message || 'An unexpected error occurred',
    status: 500,
    timestamp: new Date().toISOString(),
  }, 500);
});
```

## Cloudflare環境の削除

プロジェクトを削除する場合や、リソースをクリーンアップする場合は、以下のコマンドを使用します。

### 1. Workerの削除

```bash
# デプロイされたWorkerを削除
wrangler delete cloudflare-demo-project

# 確認メッセージが表示されるので、yesを入力
```

### 2. D1 Databaseの削除

```bash
# D1データベースの削除
wrangler d1 delete demo-database

# 確認メッセージが表示されるので、yesを入力
```

### 3. KV Namespaceの削除

```bash
# KV Namespaceの一覧を確認
wrangler kv:namespace list

# KV Namespaceを削除（IDを指定）
wrangler kv:namespace delete --namespace-id=your-kv-namespace-id

# プレビュー環境のKV Namespaceも削除
wrangler kv:namespace delete --namespace-id=your-preview-kv-namespace-id
```

### 4. R2 Bucketの削除

```bash
# R2バケットの一覧を確認
wrangler r2 bucket list

# R2バケットを削除
wrangler r2 bucket delete demo-bucket

# プレビュー環境のR2バケットも削除
wrangler r2 bucket delete demo-bucket-preview

# 注意: バケット内にオブジェクトがある場合は、先に削除する必要があります
```

### 5. 全リソースを一括削除するスクリプト

プロジェクトルートに`cleanup.sh`を作成して、全リソースを一括削除できます：

```bash
#!/bin/bash

echo "⚠️  Warning: This will delete all Cloudflare resources for this project!"
echo "Are you sure you want to continue? (yes/no)"
read -r confirmation

if [ "$confirmation" != "yes" ]; then
    echo "Cleanup cancelled."
    exit 0
fi

echo "🗑️  Deleting Cloudflare resources..."

# Worker削除
echo "Deleting Worker..."
wrangler delete cloudflare-demo-project --force 2>/dev/null || echo "Worker not found or already deleted"

# D1データベース削除
echo "Deleting D1 database..."
wrangler d1 delete demo-database --skip-confirmation 2>/dev/null || echo "D1 database not found or already deleted"

# R2バケット削除
echo "Deleting R2 buckets..."
wrangler r2 bucket delete demo-bucket --force 2>/dev/null || echo "R2 bucket not found or already deleted"
wrangler r2 bucket delete demo-bucket-preview --force 2>/dev/null || echo "R2 preview bucket not found or already deleted"

# KV Namespace削除（IDが必要なため、wrangler.tomlから取得）
echo "Deleting KV namespaces..."
if [ -f "wrangler.toml" ]; then
    KV_ID=$(grep -A 2 'binding = "DEMO_KV"' wrangler.toml | grep '^id' | head -1 | cut -d'"' -f2)
    PREVIEW_KV_ID=$(grep -A 2 'binding = "DEMO_KV"' wrangler.toml | grep 'preview_id' | cut -d'"' -f2)
    
    if [ -n "$KV_ID" ]; then
        wrangler kv:namespace delete --namespace-id="$KV_ID" --force 2>/dev/null || echo "KV namespace not found or already deleted"
    fi
    
    if [ -n "$PREVIEW_KV_ID" ]; then
        wrangler kv:namespace delete --namespace-id="$PREVIEW_KV_ID" --force 2>/dev/null || echo "Preview KV namespace not found or already deleted"
    fi
fi

# ローカルキャッシュのクリア
echo "Cleaning local cache..."
rm -rf .wrangler

echo "✅ Cleanup completed!"
```

スクリプトに実行権限を付与して実行：

```bash
chmod +x cleanup.sh
./cleanup.sh
```

### 6. 個別リソースの確認コマンド

削除前に、現在のリソースを確認できます：

```bash
# デプロイされているWorkerの一覧
wrangler deployments list

# D1データベースの一覧
wrangler d1 list

# KV Namespaceの一覧
wrangler kv:namespace list

# R2バケットの一覧
wrangler r2 bucket list
```

### 注意事項

- **削除は取り消せません**: 削除したリソースは復元できないため、慎重に実行してください
- **本番環境の確認**: 本番環境のリソースを削除する場合は、特に注意が必要です
- **バックアップ**: 重要なデータがある場合は、削除前にバックアップを取得してください
- **R2のオブジェクト**: R2バケットを削除する前に、バケット内の全オブジェクトを削除する必要があります

## トラブルシューティング

### よくある問題と解決方法

#### 1. `no such table: users` エラー（D1）

**エラーメッセージ**:
```
✘ [ERROR] no such table: users: SQLITE_ERROR
```

**原因**: リモート環境にスキーマが適用されていません。ローカル環境（`--local`）とリモート環境（`--remote`）は別々のデータベースです。

**解決方法**:
```bash
# 1. リモート環境にスキーマを適用
wrangler d1 execute demo-database --remote --file=./schema.sql

# 2. サンプルデータを投入
wrangler d1 execute demo-database --remote --file=./seed.sql

# 3. 確認
wrangler d1 execute demo-database --remote --command="SELECT * FROM users;"
```

#### 2. `wrangler login`が失敗する

```bash
# キャッシュをクリアして再試行
wrangler logout
wrangler login
```

#### 3. R2有効化エラー

**エラーメッセージ**:
```
✘ [ERROR] Please enable R2 through the Cloudflare Dashboard. [code: 10042]
```

**解決方法**: 
1. [Cloudflareダッシュボード](https://dash.cloudflare.com/)にログイン
2. 左側メニューから「R2」を選択
3. 「R2を有効にする」ボタンをクリック
4. 利用規約に同意して有効化
5. 再度`wrangler r2 bucket create demo-bucket`を実行

#### 4. D1マイグレーションが失敗する

```bash
# データベースの状態を確認
wrangler d1 execute demo-database --remote --command="SELECT name FROM sqlite_master WHERE type='table';"

# 必要に応じてデータベースを再作成
wrangler d1 delete demo-database
wrangler d1 create demo-database
# 新しいdatabase_idをwrangler.tomlに設定してから再度マイグレーション
```

#### 5. ローカル開発サーバーが起動しない

```bash
# ポートが使用中の場合、別のポートを指定
wrangler dev --port 8788

# キャッシュをクリア
rm -rf .wrangler
npm run dev
```

#### 6. デプロイ時のバインディングエラー

`wrangler.toml`の設定を確認し、全てのIDが正しく設定されていることを確認してください。

#### 7. R2バケットが削除できない

```bash
# バケット内のオブジェクトを全て削除してから、バケットを削除
# まず、オブジェクト一覧を取得
wrangler r2 object list demo-bucket

# 個別にオブジェクトを削除
wrangler r2 object delete demo-bucket/object-key

# または、全オブジェクトを削除するスクリプトを使用
# （多数のオブジェクトがある場合は、Cloudflareダッシュボードから削除することを推奨）
```

## Demo UIのデプロイ

`demo-ui.html`は、Cloudflare Pagesを使って簡単にデプロイできます。

### 方法1: Cloudflare Pagesでデプロイ（推奨）

1. **Cloudflareダッシュボードにログイン**
   - [Cloudflare Dashboard](https://dash.cloudflare.com/)にアクセス

2. **Pagesプロジェクトを作成**
   ```bash
   # Pagesディレクトリを作成
   mkdir demo-ui-pages
   cp demo-ui.html demo-ui-pages/index.html
   cd demo-ui-pages
   
   # Pagesにデプロイ
   npx wrangler pages deploy . --project-name=cloudflare-demo-ui
   ```

3. **デプロイ完了**
   - デプロイが完了すると、以下のようなURLが表示されます：
   - `https://cloudflare-demo-ui.pages.dev`

### 方法2: Cloudflare Workersでデプロイ

HTMLを直接返すWorkerを作成してデプロイすることもできます。

1. **UIデプロイ用のWorkerを作成**
   ```bash
   # 新しいディレクトリを作成
   mkdir demo-ui-worker
   cd demo-ui-worker
   
   # package.jsonを作成
   npm init -y
   npm install wrangler --save-dev
   ```

2. **wrangler.tomlを作成**
   ```toml
   name = "cloudflare-demo-ui"
   main = "index.js"
   compatibility_date = "2024-01-15"
   workers_dev = true
   account_id = "your-account-id"
   ```

3. **index.jsを作成**
   ```javascript
   export default {
     async fetch(request) {
       const html = `<!DOCTYPE html>
       <!-- demo-ui.htmlの内容をここに貼り付け -->
       `;
       
       return new Response(html, {
         headers: {
           'Content-Type': 'text/html; charset=utf-8',
           'Cache-Control': 'public, max-age=3600',
         },
       });
     },
   };
   ```

4. **デプロイ**
   ```bash
   npx wrangler deploy
   ```

### 方法3: ローカルで使用

最も簡単な方法は、`demo-ui.html`をブラウザで直接開くことです：

```bash
# ブラウザで開く（macOS）
open demo-ui.html

# ブラウザで開く（Linux）
xdg-open demo-ui.html

# ブラウザで開く（Windows）
start demo-ui.html
```

ヘッダーの「API Base URL」に、デプロイしたWorkerのURLを入力してください：
- ローカル: `http://localhost:8787`
- 本番: `https://cloudflare-demo-project.<your-subdomain>.workers.dev`

### デプロイ後の設定

1. **API Base URLの設定**
   - Demo UIを開く
   - ヘッダーの「API Base URL」に本番APIのURLを入力
   - 例: `https://cloudflare-demo-project.youqi-nie.workers.dev`

2. **APIキーの設定**
   - 「Master Key (KV)」に `Aquaring@74` を入力
   - 「API Keys」タブでD1/R2用のAPIキーを登録
   - 登録したAPIキーを「API Key (D1/R2)」に入力

3. **動作確認**
   - 「Health Check」ボタンをクリックして接続を確認
   - 各タブで操作をテスト

## ライセンス

MIT

## 参考リンク

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Hono Framework](https://hono.dev/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)
- [KV Storage](https://developers.cloudflare.com/workers/runtime-apis/kv/)
- [D1 Database](https://developers.cloudflare.com/d1/)
- [R2 Storage](https://developers.cloudflare.com/r2/)
