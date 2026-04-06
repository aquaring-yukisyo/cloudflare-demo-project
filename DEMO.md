# 勉強会用：プロジェクト構築手順（CLI中心）

Cloudflare Worker + KV / D1 / R2 を使うデモを、**コマンドの流れだけ**で追えるようにまとめたものです。詳細は [README.md](./README.md) を参照してください。

---

## 前提

| 必要なもの | メモ |
|------------|------|
| Node.js 18+ / npm 9+ | |
| Cloudflare 無料アカウント | [サインアップ](https://dash.cloudflare.com/sign-up) |
| Wrangler | 下記でインストール |

---

## 1. Wrangler とログイン

```bash
npm install -g wrangler
wrangler login
```

ブラウザで Cloudflare へのアクセスを許可します。

---

## 2. リポジトリと依存関係

```bash
git clone <リポジトリURL>
cd cloudflare-demo-project
npm install
```

---

## 3. Cloudflare リソース作成（コマンド）

作成後、**コマンド出力に表示される ID や名前**を `wrangler.toml` に反映します。

### KV Namespace（本番用 + プレビュー用）

```bash
npx wrangler kv namespace create "DEMO_KV_V2"
```

### D1 データベース

```bash
wrangler d1 create demo-database-v2
```

### R2 バケット（本番用 + プレビュー用）

```bash
npx wrangler r2 bucket create demo-bucket-v2
```

### Account ID の確認

```bash
npx wrangler whoami
```

ダッシュボード右サイドバーでも Account ID を確認できます。

### `wrangler.toml` で最低限そろえる項目

- `account_id`
- `[[kv_namespaces]]` の `id` / `preview_id`
- `[[d1_databases]]` の `database_id`
- `[[r2_buckets]]` の `bucket_name` / `preview_bucket_name`

---

## 4. D1 マイグレーション（スキーマ・シード）

**`--local`** … ローカル開発用 DB（`.wrangler/state/` 付近）  
**`--remote`** … Cloudflare 上の本番 DB（**デプロイ後に API が触るのはこちら**）

### ローカルだけ試すとき

```bash
wrangler d1 execute demo-database-v2 --local --file=./schema.sql
# 任意
wrangler d1 execute demo-database-v2 --local --file=./seed.sql
```

### 本番（リモート）に反映するとき

```bash
wrangler d1 execute demo-database-v2 --remote --file=./schema.sql
wrangler d1 execute demo-database-v2 --remote --file=./seed.sql
```

（`migrate.sh` で流す方法は README にあります。本番 DB へ確実に当てるなら上記の `--remote` コマンドを使います。）

### 動作確認（例）

```bash
# ローカル
wrangler d1 execute demo-database --local --command="SELECT name FROM sqlite_master WHERE type='table';"

# リモート
wrangler d1 execute demo-database-v2 --remote --command="SELECT * FROM users;"
```

---

## 5. ローカルで Worker を起動

```bash
npm run dev
```

ブラウザ: `http://localhost:8787`

### テスト（任意）

```bash
npm test
npm run test:watch
npm run test:coverage
```

---

## 6. デプロイ

**前提チェック**

1. KV / D1 / R2 作成済みで `wrangler.toml` 更新済み  
2. **D1 は `--remote` でスキーマ（と必要なら seed）適用済み**

```bash
npm run deploy
# または
wrangler deploy
```

成功すると `*.workers.dev` の URL が表示されます。

### 動作確認の例

```bash
curl https://<表示されたサブドメイン>.workers.dev/health
curl https://<表示されたサブドメイン>.workers.dev/d1/users
```

### 環境別デプロイ（任意）

```bash
wrangler deploy --env development
wrangler deploy --env staging
```

（`wrangler.toml` の `[env.development]` 等に dev 用 ID が設定されている必要があります。）

### ログ確認（任意）

```bash
wrangler tail
```

---

## 7. 検証用 UI（`demo-ui-pages`）を Cloudflare Pages にデプロイ

Worker API をブラウザから試すための UI は **[demo-ui-pages](./demo-ui-pages/)** にあります（`index.html` のみの静的サイト。ビルドコマンドは不要）。

### 前提

- **先に [§6](#6-デプロイ) で Worker をデプロイ**し、`https://<サブドメイン>.workers.dev` の URL を控えておく。
- Worker 側でブラウザからの API 呼び出し（CORS）が許可されていること。別ドメインの Pages から `fetch` できる前提です（詳細は README）。

### CLI でデプロイ（Wrangler）

リポジトリルートから:

```bash
npx wrangler pages deploy ./demo-ui-pages --project-name=<Pagesのプロジェクト名>
```

- **初回**は Cloudflare 上に同名の Pages プロジェクトが無い場合、対話プロンプトで作成確認が出ることがあります。指示に従って作成してください。
- デプロイ完了後、ターミナルに **`*.pages.dev` の URL** が表示されます。

`<Pagesのプロジェクト名>` はダッシュボードで後から変えにくいので、例として `cloudflare-demo-ui` のように分かりやすい名前にするとよいです。

### デプロイ後の操作（UI 側）

1. ブラウザで Pages の URL（例: `https://cloudflare-demo-ui.pages.dev`）を開く。
2. 画面上部の **「API Base URL」** に、§6 の Worker URL を入力する（**末尾に `/` は付けない**想定。例: `https://cloudflare-demo-project-xxxx.workers.dev`）。
3. 必要に応じて **Master Key** および **D1/R2 用 API Key** を入力し、Health Check や各タブで動作確認する。

API Base URL は `localStorage` に保存されるため、次回アクセス時も入力が残ります。

### ダッシュボードからデプロイする場合（任意）

[Cloudflare ダッシュボード](https://dash.cloudflare.com/) → **Workers & Pages** → **Create** → **Pages** → **Direct Upload** で `demo-ui-pages` フォルダ（または zip）をアップロードしても同様にホスティングできます。手順の詳細は [Cloudflare Pages のドキュメント](https://developers.cloudflare.com/pages/get-started/direct-upload/) を参照してください。

---

## クイック参照：よく使うコマンド

| 目的 | コマンド |
|------|----------|
| ログイン | `wrangler login` |
| アカウント確認 | `npx wrangler whoami` |
| ローカル開発 | `npm run dev` |
| D1 に SQL ファイル適用（本番 DB） | `wrangler d1 execute demo-database --remote --file=./schema.sql` |
| デプロイ | `npm run deploy` または `wrangler deploy` |
| 検証 UI を Pages に載せる | `npx wrangler pages deploy ./demo-ui-pages --project-name=<名前>` |
| 本番ログ | `wrangler tail` |

---

## 8. プロジェクトの削除（クリーンアップ）

勉強会や検証が終わったあと、**Cloudflare 上のリソースとローカル成果物**を片付けるときの目安です。名前は `wrangler.toml` の `name` や、実際に作成した KV / D1 / R2 / Pages の名前に読み替えてください。

### 推奨する順序

1. **Worker** を止める（まだデプロイしている場合）  
2. **Pages**（検証 UI を載せた場合）  
3. **KV 名前空間**（プレビュー用を作っていればそれも）  
4. **D1 データベース**  
5. **R2 バケット**（中身があると削除できないことがある → 先にオブジェクトを空にする）

### Worker の削除

`wrangler.toml` の `name`（例: `cloudflare-demo-project-v2`）に合わせる。

```bash
npx wrangler delete --name=<Worker名>
```

プロジェクト直下で `wrangler.toml` を読ませるなら、名前省略で次でも可です。

```bash
npx wrangler delete
```

### Pages プロジェクトの削除

§7 で指定した `<Pagesのプロジェクト名>` を使う。

```bash
npx wrangler pages project delete <Pagesのプロジェクト名> --yes
```

### KV Namespace の削除

名前空間 ID は `wrangler.toml` の `id`、または次で確認する。

```bash
npx wrangler kv namespace list
```

```bash
npx wrangler kv namespace delete --namespace-id=<KVのnamespace id>
```

プレビュー用名前空間を作っている場合は `--preview` を付けて同様に削除する。

### D1 データベースの削除

```bash
npx wrangler d1 delete <データベース名>
```

例（このリポジトリの `database_name` に合わせる場合）:

```bash
npx wrangler d1 delete demo-database-v2
```

確認プロンプトが出るので、指示に従う。省略したい場合は `--skip-confirmation`（取り消しが効かないので注意）。

### R2 バケットの削除

バケット内にオブジェクトが残っていると削除できないことがある。その場合はダッシュボードの R2 からオブジェクトを削除するか、CLI でオブジェクトを消してからバケットを削除する。

```bash
npx wrangler r2 bucket delete <バケット名>
```

例:

```bash
npx wrangler r2 bucket delete demo-bucket-v2
```

プレビュー用バケット（例: `demo-bucket-preview`）を作っている場合は、同様に削除する。

### ローカル

リポジトリを残す場合でも、次を消してよいことが多い（必要ならバックアップを取ってから）。

```bash
rm -rf node_modules .wrangler
```

リポジトリごと不要なら、クローンしたディレクトリを削除すればよい。

---

詳しい API 一覧やセキュリティの注意は **README.md** を参照してください。
