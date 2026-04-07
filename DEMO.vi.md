# Tài liệu học tập: Hướng dẫn xây dựng dự án (tập trung CLI)

Tài liệu này tổng hợp quy trình chạy command để xây dựng demo sử dụng Cloudflare Worker + KV / D1 / R2. Chi tiết xem thêm tại [README.vi.md](./README.vi.md).

---

## Yêu cầu tiên quyết

| Yêu cầu | Ghi chú |
|------------|------|
| Node.js 18+ / npm 9+ | |
| Tài khoản Cloudflare miễn phí | [Đăng ký](https://dash.cloudflare.com/sign-up) |
| Wrangler | Cài đặt bên dưới |

---

## 1. Cài đặt Wrangler và đăng nhập

```bash
npm install -g wrangler
wrangler login
```

Cho phép truy cập Cloudflare qua browser được mở ra.

---

## 2. Clone repository và cài đặt dependencies

```bash
git clone <URL repository>
cd cloudflare-demo-project
npm install
```

---

## 3. Tạo tài nguyên Cloudflare (command)

Sau khi tạo, cập nhật **ID và tên hiển thị trong output command** vào `wrangler.toml`.

### KV Namespace (Production + Preview)

```bash
npx wrangler kv namespace create "DEMO_KV_V2"
```

### D1 Database

```bash
wrangler d1 create demo-database-v2
```

### R2 Bucket (Production + Preview)

```bash
npx wrangler r2 bucket create demo-bucket-v2
```

### Kiểm tra Account ID

```bash
npx wrangler whoami
```

Bạn cũng có thể xem Account ID trong thanh bên phải của Dashboard.

### Các mục tối thiểu cần có trong `wrangler.toml`

- `account_id`
- `id` / `preview_id` của `[[kv_namespaces]]`
- `database_id` của `[[d1_databases]]`
- `bucket_name` / `preview_bucket_name` của `[[r2_buckets]]`

---

## 4. D1 Migration (Schema & Seed)

**`--local`**: Database cho phát triển cục bộ (gần `.wrangler/state/`)  
**`--remote`**: Database production trên Cloudflare (**API sẽ gọi cái này sau khi deploy**)

### Khi chỉ test cục bộ

```bash
wrangler d1 execute demo-database-v2 --local --file=./schema.sql
# Tùy chọn
wrangler d1 execute demo-database-v2 --local --file=./seed.sql
```

### Khi áp dụng vào production (remote)

```bash
wrangler d1 execute demo-database-v2 --remote --file=./schema.sql
wrangler d1 execute demo-database-v2 --remote --file=./seed.sql
```

(README có hướng dẫn dùng `migrate.sh`. Để chắc chắn áp dụng vào database production, dùng command `--remote` bên trên.)

### Kiểm tra hoạt động (ví dụ)

```bash
# Cục bộ
wrangler d1 execute demo-database --local --command="SELECT name FROM sqlite_master WHERE type='table';"

# Remote
wrangler d1 execute demo-database-v2 --remote --command="SELECT * FROM users;"
```

---

## 5. Khởi động Worker cục bộ

```bash
npm run dev
```

Browser: `http://localhost:8787`

### Test (tùy chọn)

```bash
npm test
npm run test:watch
npm run test:coverage
```

---

## 6. Deploy

**Kiểm tra tiên quyết**

1. Đã tạo KV / D1 / R2 và cập nhật `wrangler.toml`
2. **Đã áp dụng schema (và seed nếu cần) với `--remote` cho D1**

```bash
npm run deploy
# hoặc
wrangler deploy
```

Khi thành công, bạn sẽ thấy URL `*.workers.dev`.

### Ví dụ kiểm tra hoạt động

```bash
curl https://<subdomain>.workers.dev/health
curl https://<subdomain>.workers.dev/d1/users
```

### Deploy theo môi trường (tùy chọn)

```bash
wrangler deploy --env development
wrangler deploy --env staging
```

(Các `[env.development]` trong `wrangler.toml` cần được cấu hình ID cho dev.)

### Kiểm tra log (tùy chọn)

```bash
wrangler tail
```

---

## 7. Deploy UI kiểm tra (`demo-ui-pages`) lên Cloudflare Pages

UI để test API Worker từ browser có sẵn trong **[demo-ui-pages](./demo-ui-pages/)** (static site chỉ với `index.html`, không cần build command).

### Yêu cầu tiên quyết

- **Đã deploy Worker ở [§6](#6-deploy)** và giữ URL `https://<subdomain>.workers.dev`
- Worker đã cho phép CORS để gọi API từ browser. API `fetch` hoạt động từ domain khác (chi tiết trong README).

### Deploy bằng CLI (Wrangler)

Từ root repository:

```bash
npx wrangler pages deploy ./demo-ui-pages --project-name=<tên Pages project>
```

- **Lần đầu**: Nếu chưa có Pages project cùng tên trên Cloudflare, sẽ có prompt xác nhận tạo. Làm theo hướng dẫn để tạo.
- Sau khi deploy hoàn tất, terminal sẽ hiển thị **URL `*.pages.dev`**.

`<tên Pages project>` khó đổi sau này trên dashboard, nên đặt tên dễ nhớ như `cloudflare-demo-ui`.

### Thao tác sau khi deploy (phía UI)

1. Mở URL Pages trong browser (vd: `https://cloudflare-demo-ui.pages.dev`)
2. Nhập URL Worker từ §6 vào **「API Base URL」** ở đầu trang (**không thêm `/` ở cuối**, vd: `https://cloudflare-demo-project-xxxx.workers.dev`)
3. Nhập **Master Key** và **D1/R2 API Key** nếu cần, kiểm tra hoạt động với Health Check hoặc các tab

API Base URL được lưu vào `localStorage`, nên lần truy cập sau không cần nhập lại.

### Deploy từ Dashboard (tùy chọn)

[Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → **Create** → **Pages** → **Direct Upload**, upload thư mục `demo-ui-pages` (hoặc zip) để host tương tự. Xem thêm chi tiết trong [tài liệu Cloudflare Pages](https://developers.cloudflare.com/pages/get-started/direct-upload/).

---

## Tham khảo nhanh: Command thường dùng

| Mục đích | Command |
|------|----------|
| Đăng nhập | `wrangler login` |
| Kiểm tra account | `npx wrangler whoami` |
| Phát triển cục bộ | `npm run dev` |
| Áp dụng SQL file vào D1 (database production) | `wrangler d1 execute demo-database --remote --file=./schema.sql` |
| Deploy | `npm run deploy` hoặc `wrangler deploy` |
| Deploy UI lên Pages | `npx wrangler pages deploy ./demo-ui-pages --project-name=<tên>` |
| Log production | `wrangler tail` |

---

## 8. Xóa dự án (cleanup)

Hướng dẫn khi cần dọn dẹp **tài nguyên trên Cloudflare và artifacts cục bộ** sau khi học tập hoặc kiểm tra xong. Thay thế tên theo `name` trong `wrangler.toml` và tên KV / D1 / R2 / Pages đã tạo thực tế.

### Thứ tự khuyến nghị

1. Dừng **Worker** (nếu đang deploy)
2. Xóa **Pages** (nếu đã deploy UI kiểm tra)
3. Xóa **KV namespace** (bao gồm cả preview nếu đã tạo)
4. Xóa **D1 database**
5. Xóa **R2 bucket** (nếu có object bên trong → cần xóa object trước)

### Xóa Worker

Khớp với `name` trong `wrangler.toml` (vd: `cloudflare-demo-project-v2`).

```bash
npx wrangler delete --name=<tên Worker>
```

Hoặc nếu chạy từ thư mục dự án có `wrangler.toml`:

```bash
npx wrangler delete
```

### Xóa Pages Project

Dùng `<tên Pages project>` đã đặt ở §7.

```bash
npx wrangler pages project delete <tên Pages project> --yes
```

### Xóa KV Namespace

Xem namespace ID từ `id` trong `wrangler.toml` hoặc kiểm tra bằng:

```bash
npx wrangler kv namespace list
```

```bash
npx wrangler kv namespace delete --namespace-id=<KV namespace id>
```

Nếu đã tạo namespace preview, xóa tương tự với `--preview`.

### Xóa D1 Database

```bash
npx wrangler d1 delete <tên database>
```

Ví dụ (khớp với `database_name` trong repository):

```bash
npx wrangler d1 delete demo-database-v2
```

Làm theo prompt xác nhận. Nếu muốn bỏ qua: `--skip-confirmation` (lưu ý không hoàn tác được).

### Xóa R2 Bucket

Nếu còn object trong bucket có thể không xóa được. Khi đó xóa object từ R2 trên Dashboard hoặc dùng CLI xóa object trước khi xóa bucket.

```bash
npx wrangler r2 bucket delete <tên bucket>
```

Ví dụ:

```bash
npx wrangler r2 bucket delete demo-bucket-v2
```

Nếu đã tạo bucket preview (vd: `demo-bucket-preview`), xóa tương tự.

### Cục bộ

Ngay cả khi giữ repository, thường có thể xóa các thứ sau (backup nếu cần):

```bash
rm -rf node_modules .wrangler
```

Nếu không cần repository, xóa thư mục đã clone.

---

Xem thêm danh sách API đầy đủ và lưu ý bảo mật trong **README.vi.md**.
