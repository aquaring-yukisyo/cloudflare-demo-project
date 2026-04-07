# Cloudflare Demo Project

Ứng dụng demo tích hợp 3 dịch vụ lưu trữ KV (Key-Value storage), D1 (SQL database), và R2 (Object storage) trên Cloudflare Workers. Triển khai REST API nhẹ và nhanh bằng framework Hono.

## Mục lục

- [Yêu cầu tiên quyết](#yêu-cầu-tiên-quyết)
- [Tổng quan dự án](#tổng-quan-dự-án)
- [Thiết lập môi trường phát triển cục bộ](#thiết-lập-môi-trường-phát-triển-cục-bộ)
- [Tạo tài nguyên Cloudflare](#tạo-tài-nguyên-cloudflare)
- [Di trú cơ sở dữ liệu D1](#di-trú-cơ-sở-dữ-liệu-d1)
- [Khởi động máy chủ phát triển cục bộ](#khởi-động-máy-chủ-phát-triển-cục-bộ)
- [Hướng dẫn triển khai](#hướng-dẫn-triển-khai)
- [Các endpoint API](#các-endpoint-api)
- [Thực hành bảo mật tốt nhất](#thực-hành-bảo-mật-tốt-nhất)

## Yêu cầu tiên quyết

Để chạy dự án này, bạn cần các công cụ và tài khoản sau:

- **Node.js**: v18.0.0 trở lên
- **npm**: v9.0.0 trở lên
- **Tài khoản Cloudflare**: [Đăng ký miễn phí](https://dash.cloudflare.com/sign-up)
- **Wrangler CLI**: Công cụ dòng lệnh cho Cloudflare Workers

| Cloudflare             | AWS tương đương gần nhất           |
| ---------------------- | ---------------------------------- |
| **Cloudflare KV**      | **Amazon DynamoDB**                |
| **Cloudflare D1**      | **Amazon Aurora Serverless v2**    |
| **Cloudflare R2**      | **Amazon S3**                      |
| **Cloudflare Workers** | **AWS Lambda**                     |
| **Cloudflare Pages**   | **Amazon S3**                      |

### Cài đặt Wrangler CLI

```bash
npm install -g wrangler
```

### Đăng nhập tài khoản Cloudflare

```bash
wrangler login
```

Trình duyệt sẽ mở ra và yêu cầu bạn cho phép truy cập vào tài khoản Cloudflare.

## Tổng quan dự án

Dự án này chạy trên môi trường edge computing của Cloudflare và cung cấp các tính năng sau:

### Stack công nghệ

- **Cloudflare Workers**: Môi trường edge runtime
- **Hono**: Framework web nhẹ
- **TypeScript**: Cung cấp kiểu an toàn
- **Wrangler**: CLI tool cho deployment và phát triển cục bộ

### Dịch vụ lưu trữ

1. **KV (Key-Value Storage)**: Lưu trữ key-value đơn giản
2. **D1 (SQLite Database)**: Cơ sở dữ liệu SQL cho dữ liệu có cấu trúc
3. **R2 (Object Storage)**: Lưu trữ tệp nhị phân/tệp

## Thiết lập môi trường phát triển cục bộ

### 1. Clone repository

```bash
git clone <repository-url>
cd cloudflare-demo-project
```

### 2. Cài đặt dependencies

```bash
npm install
```

### 3. Cấu trúc dự án

```
cloudflare-demo-project/
├── src/
│   ├── index.ts          # Entry point Worker chính
│   ├── env.d.ts          # Định nghĩa kiểu TypeScript
│   └── utils/            # Các hàm tiện ích
├── schema.sql            # Schema cơ sở dữ liệu D1
├── migrate.sh            # Script thực thi di trú
├── seed.sql              # Dữ liệu mẫu
├── seed.sh               # Script nạp dữ liệu mẫu
├── wrangler.toml         # Cấu hình Cloudflare Workers
├── tsconfig.json         # Cấu hình TypeScript
└── package.json          # Dependencies dự án
```

## Tạo tài nguyên Cloudflare

Trước khi deploy, bạn cần tạo các tài nguyên Cloudflare sau.

### 1. Tạo KV Namespace

```bash
# KV Namespace cho production
npx wrangler kv:namespace create "DEMO_KV"

# KV Namespace cho preview
npx wrangler kv:namespace create "DEMO_KV" --preview
```

Đặt ID đã xuất ra vào `wrangler.toml` tại vị trí tương ứng:

```toml
[[kv_namespaces]]
binding = "DEMO_KV"
id = "your-kv-namespace-id"          # Đặt ID production vào đây
preview_id = "your-preview-kv-namespace-id"  # Đặt ID preview vào đây
```

### 2. Tạo D1 Database

```bash
# Tạo database D1
wrangler d1 create demo-database
```

Đặt database_id đã xuất ra vào `wrangler.toml` tại vị trí tương ứng:

```toml
[[d1_databases]]
binding = "DEMO_DB"
database_name = "demo-database"
database_id = "your-d1-database-id"  # Đặt ID vào đây
```

### 3. Tạo R2 Bucket

```bash
# Tạo R2 bucket
npx wrangler r2 bucket create demo-bucket

# Tạo R2 bucket cho preview
wrangler r2 bucket create demo-bucket-preview
```

Đặt tên bucket vào `wrangler.toml` tại vị trí tương ứng:

```toml
[[r2_buckets]]
binding = "DEMO_BUCKET"
bucket_name = "demo-bucket"
preview_bucket_name = "demo-bucket-preview"
```

### 4. Cấu hình Account ID

Lấy Account ID của bạn từ Cloudflare Dashboard và đặt vào `wrangler.toml`:

```bash
# Tra cứu ID của bạn
npx wrangler whoami
```

```toml
account_id = "your-account-id"  # Đặt Account ID vào đây
```

Bạn có thể xem Account ID trong [Cloudflare Dashboard](https://dash.cloudflare.com/) ở thanh bên phải.

## Di trú cơ sở dữ liệu D1

Tạo các bảng trong cơ sở dữ liệu D1.

### Quan trọng: Sự khác biệt giữa cục bộ và remote

- `--local`: Cơ sở dữ liệu môi trường phát triển cục bộ (trong `.wrangler/state/`)
- `--remote`: Cơ sở dữ liệu production trên Cloudflare

**Khi deploy, luôn sử dụng flag `--remote`.**

### 1. Áp dụng schema

#### Môi trường cục bộ (cho phát triển)

```bash
wrangler d1 execute demo-database --local --file=./schema.sql
```

#### Môi trường production (deploy lên Cloudflare)

```bash
# 1. Đầu tiên áp dụng schema (tạo bảng)
wrangler d1 execute demo-database --remote --file=./schema.sql

# 2. Sau đó nạp dữ liệu mẫu (tùy chọn)
wrangler d1 execute demo-database --remote --file=./seed.sql
```

**Lưu ý**: Nếu không có flag `--remote`, schema chỉ được áp dụng cho môi trường cục bộ và sẽ không hoạt động khi deploy lên Cloudflare.

Hoặc sử dụng shell script được cung cấp:

```bash
# Cấp quyền thực thi cho script
chmod +x migrate.sh

# Thực thi di trú
./migrate.sh
```

### 2. Xác minh cơ sở dữ liệu

#### Xác minh môi trường cục bộ

```bash
# Xem danh sách bảng
wrangler d1 execute demo-database --local --command="SELECT name FROM sqlite_master WHERE type='table';"

# Xem dữ liệu người dùng
wrangler d1 execute demo-database --local --command="SELECT * FROM users;"
```

#### Xác minh môi trường production

```bash
# Xem danh sách bảng
wrangler d1 execute demo-database --remote --command="SELECT name FROM sqlite_master WHERE type='table';"

# Xem dữ liệu người dùng
wrangler d1 execute demo-database --remote --command="SELECT * FROM users;"
```

## Khởi động máy chủ phát triển cục bộ

Chạy Worker trong môi trường cục bộ để phát triển và kiểm tra.

```bash
npm run dev
```

Khi máy chủ khởi động, bạn có thể truy cập qua URL:

```
http://localhost:8787
```

### Đặc điểm phát triển cục bộ

- **Hot reload**: Tự động tải lại khi thay đổi code
- **Local storage**: Sử dụng emulation cho KV, D1, R2
- **Debug**: Output của `console.log()` hiển thị trong terminal

### Chạy test

```bash
# Chạy tất cả test
npm test

# Chế độ watch (cho phát triển)
npm run test:watch

# Tạo báo cáo coverage
npm run test:coverage
```

## Hướng dẫn triển khai

### Kiểm tra tiên quyết

Trước khi deploy, đảm bảo đã hoàn thành:

1. ✅ Tạo tài nguyên Cloudflare (KV, D1, R2)
2. ✅ Cấu hình `wrangler.toml` (account_id, các ID)
3. ✅ **Di trú remote cơ sở dữ liệu D1 (quan trọng!)**

### 1. Di trú remote cơ sở dữ liệu D1 (bắt buộc)

**Luôn thực hiện trước khi deploy. Môi trường cục bộ (`--local`) và remote (`--remote`) là riêng biệt.**

```bash
# 1. Áp dụng schema (tạo bảng)
wrangler d1 execute demo-database --remote --file=./schema.sql

# 2. Nạp dữ liệu mẫu (tùy chọn)
wrangler d1 execute demo-database --remote --file=./seed.sql

# 3. Xác minh
wrangler d1 execute demo-database --remote --command="SELECT * FROM users;"
```

### 2. Kiểm tra cấu hình

Đảm bảo các mục sau trong `wrangler.toml` đã được cấu hình đúng:

- `account_id`: Cloudflare Account ID
- KV Namespace ID
- D1 Database ID
- R2 Bucket name

### 3. Deploy lên production

```bash
npm run deploy
```

Hoặc:

```bash
wrangler deploy
```

### 4. Xác minh deployment

Khi deploy thành công, bạn sẽ thấy URL như:

```
https://cloudflare-demo-project.<your-subdomain>.workers.dev
```

Kiểm tra hoạt động bằng browser hoặc curl:

```bash
# Health check
curl https://cloudflare-demo-project.<your-subdomain>.workers.dev/health

# Kiểm tra D1 database
curl https://cloudflare-demo-project.<your-subdomain>.workers.dev/d1/users
```

### 5. Deploy theo môi trường

Khi deploy cho môi trường development hoặc staging:

```bash
# Môi trường development
wrangler deploy --env development

# Môi trường staging
wrangler deploy --env staging
```

### 6. Xem log deployment

```bash
# Xem log real-time
wrangler tail

# Xem log cho môi trường cụ thể
wrangler tail --env production
```

## API endpoints

### Về xác thực

API này sử dụng 2 loại xác thực:

- **Xác thực Master Key**: Cần cho thao tác KV và quản lý API key (`X-API-Key: Aquaring@74`)
- **Xác thực API Key**: Cần cho thao tác D1 và R2 (`X-API-Key: <API key đã đăng ký>`

### Base URL

- **Cục bộ**: `http://localhost:8787`
- **Production**: `https://cloudflare-demo-project.<your-subdomain>.workers.dev`

### 1. Root endpoint

#### Lấy thông tin API

```bash
curl http://localhost:8787/
```

**Ví dụ response**:
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

### 2. Health check

#### Kiểm tra trạng thái hệ thống

```bash
curl http://localhost:8787/health
```

**Ví dụ response**:
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

### 3. Endpoint quản lý API key (yêu cầu master key)

#### Đăng ký API key

```bash
curl -X POST http://localhost:8787/kv/api-keys/my-api-key \
  -H "Content-Type: application/json" \
  -H "X-API-Key: Aquaring@74" \
  -d '{"description": "My application API key"}'
```

**Ví dụ response**:
```json
{
  "success": true,
  "message": "API key \"my-api-key\" registered successfully",
  "description": "My application API key",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### Lấy danh sách API key đã đăng ký

```bash
curl http://localhost:8787/kv/api-keys \
  -H "X-API-Key: Aquaring@74"
```

**Ví dụ response**:
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

#### Xóa API key

```bash
curl -X DELETE http://localhost:8787/kv/api-keys/my-api-key \
  -H "X-API-Key: Aquaring@74"
```

**Ví dụ response**:
```json
{
  "success": true,
  "message": "API key \"my-api-key\" revoked successfully",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### 4. Endpoint KV Storage (yêu cầu master key)

#### Lưu key-value

```bash
curl -X POST http://localhost:8787/kv/mykey \
  -H "Content-Type: application/json" \
  -H "X-API-Key: Aquaring@74" \
  -d '{"value": "Hello, Cloudflare!"}'
```

**Ví dụ response**:
```json
{
  "success": true,
  "message": "Key \"mykey\" stored successfully",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### Lấy giá trị

```bash
curl http://localhost:8787/kv/mykey \
  -H "X-API-Key: Aquaring@74"
```

**Ví dụ response**:
```json
{
  "key": "mykey",
  "value": "Hello, Cloudflare!",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### Xóa key

```bash
curl -X DELETE http://localhost:8787/kv/mykey \
  -H "X-API-Key: Aquaring@74"
```

**Ví dụ response**:
```json
{
  "success": true,
  "message": "Key \"mykey\" deleted successfully",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### Lấy danh sách tất cả keys

```bash
curl http://localhost:8787/kv \
  -H "X-API-Key: Aquaring@74"
```

**Ví dụ response**:
```json
{
  "keys": ["mykey", "anotherkey"],
  "count": 2,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### 5. Endpoint D1 Database (yêu cầu API key)

#### Tạo người dùng

```bash
curl -X POST http://localhost:8787/d1/users \
  -H "Content-Type: application/json" \
  -H "X-API-Key: my-api-key" \
  -d '{"name": "Tanaka Taro", "email": "tanaka@example.com"}'
```

**Ví dụ response**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Tanaka Taro",
    "email": "tanaka@example.com",
    "created_at": "2024-01-15 10:30:00"
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### Lấy tất cả người dùng

```bash
curl http://localhost:8787/d1/users \
  -H "X-API-Key: my-api-key"
```

**Ví dụ response**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Tanaka Taro",
      "email": "tanaka@example.com",
      "created_at": "2024-01-15 10:30:00"
    }
  ],
  "count": 1,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### Lấy người dùng cụ thể

```bash
curl http://localhost:8787/d1/users/1 \
  -H "X-API-Key: my-api-key"
```

**Ví dụ response**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Tanaka Taro",
    "email": "tanaka@example.com",
    "created_at": "2024-01-15 10:30:00"
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### Cập nhật người dùng

```bash
curl -X PUT http://localhost:8787/d1/users/1 \
  -H "Content-Type: application/json" \
  -H "X-API-Key: my-api-key" \
  -d '{"name": "Tanaka Jiro", "email": "tanaka.jiro@example.com"}'
```

**Ví dụ response**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Tanaka Jiro",
    "email": "tanaka.jiro@example.com",
    "created_at": "2024-01-15 10:30:00"
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### Xóa người dùng

```bash
curl -X DELETE http://localhost:8787/d1/users/1 \
  -H "X-API-Key: my-api-key"
```

**Ví dụ response**:
```json
{
  "success": true,
  "message": "User with id 1 deleted successfully",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### 6. Endpoint R2 Object Storage (yêu cầu API key)

#### Upload tệp

```bash
# Upload tệp text
curl -X POST http://localhost:8787/r2/myfile.txt \
  -H "Content-Type: text/plain" \
  -H "X-API-Key: my-api-key" \
  -d "Hello, R2 Storage!"

# Upload tệp hình ảnh
curl -X POST http://localhost:8787/r2/image.jpg \
  -H "Content-Type: image/jpeg" \
  -H "X-API-Key: my-api-key" \
  --data-binary @/path/to/image.jpg
```

**Ví dụ response**:
```json
{
  "success": true,
  "message": "File \"myfile.txt\" uploaded successfully",
  "contentType": "text/plain",
  "size": 18,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### Download tệp

```bash
curl http://localhost:8787/r2/myfile.txt \
  -H "X-API-Key: my-api-key"

# Lưu thành tệp
curl http://localhost:8787/r2/image.jpg \
  -H "X-API-Key: my-api-key" \
  -o downloaded-image.jpg
```

#### Xóa tệp

```bash
curl -X DELETE http://localhost:8787/r2/myfile.txt \
  -H "X-API-Key: my-api-key"
```

**Ví dụ response**:
```json
{
  "success": true,
  "message": "File \"myfile.txt\" deleted successfully",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### Lấy danh sách tất cả objects

```bash
curl http://localhost:8787/r2 \
  -H "X-API-Key: my-api-key"
```

**Ví dụ response**:
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

### Response lỗi

Tất cả lỗi được trả về dưới dạng JSON thống nhất:

```json
{
  "error": "Unauthorized",
  "message": "Invalid or missing API key",
  "status": 401,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Mã lỗi phổ biến**:
- `400 Bad Request`: Request body không hợp lệ, lỗi validation
- `401 Unauthorized`: Lỗi xác thực, API key không hợp lệ
- `404 Not Found`: Resource không tồn tại, endpoint không tồn tại
- `409 Conflict`: Resource trùng lặp (vd: user có cùng email)
- `500 Internal Server Error`: Lỗi phía server

## Thực hành bảo mật tốt nhất

### Hệ thống xác thực

Dự án này triển khai hệ thống xác thực 2 lớp:

#### 1. Xác thực thao tác KV (Master Key)

Tất cả thao tác vào KV storage yêu cầu master key cố định `Aquaring@74`.

```bash
# Ví dụ thao tác KV với master key
curl -X POST http://localhost:8787/kv/mykey \
  -H "Content-Type: application/json" \
  -H "X-API-Key: Aquaring@74" \
  -d '{"value": "Hello, Cloudflare!"}'
```

**Thao tác có thể thực hiện với master key**:
- Lưu/lấy/xóa key-value trong KV
- Đăng ký/xem danh sách/xóa API key

#### 2. Xác thực thao tác D1/R2 (API Key)

Thao tác D1 database và R2 storage yêu cầu API key đã đăng ký trong KV.

**Đăng ký API key**:
```bash
# Đăng ký API key bằng master key
curl -X POST http://localhost:8787/kv/api-keys/my-api-key \
  -H "Content-Type: application/json" \
  -H "X-API-Key: Aquaring@74" \
  -d '{"description": "My application API key"}'
```

**Xem danh sách API key đã đăng ký**:
```bash
curl http://localhost:8787/kv/api-keys \
  -H "X-API-Key: Aquaring@74"
```

**Xóa API key**:
```bash
curl -X DELETE http://localhost:8787/kv/api-keys/my-api-key \
  -H "X-API-Key: Aquaring@74"
```

**Ví dụ thao tác D1/R2 với API key**:
```bash
# Thao tác D1 database
curl http://localhost:8787/d1/users \
  -H "X-API-Key: my-api-key"

# Thao tác R2 storage
curl http://localhost:8787/r2 \
  -H "X-API-Key: my-api-key"
```

#### Lỗi xác thực

Khi xác thực thất bại, response lỗi sẽ được trả về:

```json
{
  "error": "Unauthorized",
  "message": "Invalid or missing API key",
  "status": 401,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### 1. Làm sạch input

Dự án này triển khai làm sạch cho tất cả input:

```typescript
// src/utils/sanitize.ts
export function sanitizeString(input: string): string {
  return input
    .replace(/[<>]/g, '')  // Loại bỏ HTML tags
    .trim();
}

export function sanitizeKey(input: string): string {
  return input
    .replace(/[^a-zA-Z0-9_\-\.]/g, '')  // Chỉ cho phép ký tự an toàn
    .trim();
}
```

### 2. Phòng chống SQL Injection

Tất cả query vào D1 database đều sử dụng prepared statements:

```typescript
// Triển khai an toàn
const result = await env.DEMO_DB.prepare(
  'SELECT * FROM users WHERE id = ?'
).bind(userId).first();

// Triển khai nguy hiểm (không sử dụng)
// const result = await env.DEMO_DB.prepare(
//   `SELECT * FROM users WHERE id = ${userId}`
// ).first();
```

### 3. Ví dụ triển khai rate limiting

Khuyến nghị mạnh mẽ triển khai rate limiting trong production:

```typescript
// Ví dụ middleware rate limiting
import { Hono } from 'hono';

const app = new Hono<{ Bindings: Env }>();

// Middleware rate limiting
app.use('*', async (c, next) => {
  const clientIP = c.req.header('CF-Connecting-IP') || 'unknown';
  const rateLimitKey = `rate_limit:${clientIP}`;
  
  // Lấy số request hiện tại từ KV
  const currentCount = await c.env.DEMO_KV.get(rateLimitKey);
  const count = currentCount ? parseInt(currentCount, 10) : 0;
  
  // Cho phép 100 request mỗi phút
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
  
  // Tăng đếm
  await c.env.DEMO_KV.put(
    rateLimitKey,
    (count + 1).toString(),
    { expirationTtl: WINDOW_SECONDS }
  );
  
  await next();
});
```

### 4. Cấu hình CORS

Trong production, điều chỉnh CORS để chỉ cho phép specific origins:

```typescript
// Môi trường development (cấu hình hiện tại)
app.use('*', cors({
  origin: '*',  // Cho phép tất cả origins
  // ...
}));

// Môi trường production (khuyến nghị)
app.use('*', cors({
  origin: ['https://yourdomain.com', 'https://app.yourdomain.com'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));
```

### 5. Xác thực và phân quyền

Khuyến nghị thêm xác thực cho API endpoints trong production:

```typescript
// Ví dụ middleware xác thực
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
  
  // Xác minh token (triển khai tùy môi trường)
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

### 6. Biến môi trường và secrets

Quản lý thông tin nhạy cảm qua biến môi trường, không hardcode trong code:

```bash
// Cấu hình secrets
wrangler secret put API_SECRET_KEY
wrangler secret put DATABASE_ENCRYPTION_KEY
```

```typescript
// Sử dụng trong code
const secretKey = c.env.API_SECRET_KEY;
```

### 7. Logging và monitoring

Trong production, thiết lập logging và monitoring phù hợp:

```typescript
// Ghi log lỗi
app.onError((err, c) => {
  console.error('Error:', {
    message: err.message,
    stack: err.stack,
    path: c.req.path,
    method: c.req.method,
    timestamp: new Date().toISOString(),
  });
  
  // Trả về response lỗi
  return c.json({
    error: err.name || 'InternalServerError',
    message: err.message || 'An unexpected error occurred',
    status: 500,
    timestamp: new Date().toISOString(),
  }, 500);
});
```

## Xóa môi trường Cloudflare

Khi muốn xóa dự án hoặc clean up tài nguyên, sử dụng các lệnh sau.

### 1. Xóa Worker

```bash
# Xóa Worker đã deploy
wrangler delete cloudflare-demo-project

# Nhập yes khi được yêu cầu xác nhận
```

### 2. Xóa D1 Database

```bash
# Xóa database D1
wrangler d1 delete demo-database

# Nhập yes khi được yêu cầu xác nhận
```

### 3. Xóa KV Namespace

```bash
# Xem danh sách KV Namespace
wrangler kv:namespace list

# Xóa KV Namespace (chỉ định ID)
wrangler kv:namespace delete --namespace-id=your-kv-namespace-id

# Xóa KV Namespace preview
wrangler kv:namespace delete --namespace-id=your-preview-kv-namespace-id
```

### 4. Xóa R2 Bucket

```bash
# Xem danh sách R2 Bucket
wrangler r2 bucket list

# Xóa R2 bucket
wrangler r2 bucket delete demo-bucket

# Xóa R2 bucket preview
wrangler r2 bucket delete demo-bucket-preview

# Lưu ý: Cần xóa objects trong bucket trước khi xóa bucket
```

### 5. Script xóa tất cả tài nguyên cùng lúc

Tạo `cleanup.sh` trong root dự án để xóa tất cả tài nguyên:

```bash
#!/bin/bash

echo "⚠️  Cảnh báo: Thao tác này sẽ xóa tất cả tài nguyên Cloudflare của dự án!"
echo "Bạn có chắc chắn muốn tiếp tục không? (yes/no)"
read -r confirmation

if [ "$confirmation" != "yes" ]; then
    echo "Đã hủy cleanup."
    exit 0
fi

echo "🗑️  Đang xóa tài nguyên Cloudflare..."

# Xóa Worker
echo "Đang xóa Worker..."
wrangler delete cloudflare-demo-project --force 2>/dev/null || echo "Worker không tồn tại hoặc đã bị xóa"

# Xóa database D1
echo "Đang xóa database D1..."
wrangler d1 delete demo-database --skip-confirmation 2>/dev/null || echo "Database D1 không tồn tại hoặc đã bị xóa"

# Xóa R2 buckets
echo "Đang xóa R2 buckets..."
wrangler r2 bucket delete demo-bucket --force 2>/dev/null || echo "R2 bucket không tồn tại hoặc đã bị xóa"
wrangler r2 bucket delete demo-bucket-preview --force 2>/dev/null || echo "R2 preview bucket không tồn tại hoặc đã bị xóa"

# Xóa KV Namespace (cần ID từ wrangler.toml)
echo "Đang xóa KV namespaces..."
if [ -f "wrangler.toml" ]; then
    KV_ID=$(grep -A 2 'binding = "DEMO_KV"' wrangler.toml | grep '^id' | head -1 | cut -d'"' -f2)
    PREVIEW_KV_ID=$(grep -A 2 'binding = "DEMO_KV"' wrangler.toml | grep 'preview_id' | cut -d'"' -f2)
    
    if [ -n "$KV_ID" ]; then
        wrangler kv:namespace delete --namespace-id="$KV_ID" --force 2>/dev/null || echo "KV namespace không tồn tại hoặc đã bị xóa"
    fi
    
    if [ -n "$PREVIEW_KV_ID" ]; then
        wrangler kv:namespace delete --namespace-id="$PREVIEW_KV_ID" --force 2>/dev/null || echo "Preview KV namespace không tồn tại hoặc đã bị xóa"
    fi
fi

# Xóa cache cục bộ
echo "Đang xóa cache cục bộ..."
rm -rf .wrangler

echo "✅ Cleanup hoàn tất!"
```

Cấp quyền thực thi và chạy script:

```bash
chmod +x cleanup.sh
./cleanup.sh
```

### 6. Lệnh kiểm tra tài nguyên riêng lẻ

Kiểm tra tài nguyên hiện tại trước khi xóa:

```bash
# Danh sách Worker đã deploy
wrangler deployments list

# Danh sách database D1
wrangler d1 list

# Danh sách KV Namespace
wrangler kv:namespace list

# Danh sách R2 Bucket
wrangler r2 bucket list
```

### Lưu ý

- **Xóa không thể hoàn tác**: Tài nguyên đã xóa không thể khôi phục, hãy thận trọng
- **Kiểm tra production**: Đặc biệt lưu ý khi xóa tài nguyên production
- **Sao lưu**: Sao lưu dữ liệu quan trọng trước khi xóa
- **Objects R2**: Cần xóa tất cả objects trong bucket trước khi xóa R2 bucket

## Troubleshooting

### Sự cố thường gặp và cách khắc phục

#### 1. Lỗi `no such table: users` (D1)

**Thông báo lỗi**:
```
✘ [ERROR] no such table: users: SQLITE_ERROR
```

**Nguyên nhân**: Schema chưa được áp dụng cho remote. Môi trường cục bộ (`--local`) và remote (`--remote`) là database riêng biệt.

**Cách khắc phục**:
```bash
# 1. Áp dụng schema cho remote
wrangler d1 execute demo-database --remote --file=./schema.sql

# 2. Nạp dữ liệu mẫu
wrangler d1 execute demo-database --remote --file=./seed.sql

# 3. Xác minh
wrangler d1 execute demo-database --remote --command="SELECT * FROM users;"
```

#### 2. `wrangler login` thất bại

```bash
# Xóa cache và thử lại
wrangler logout
wrangler login
```

#### 3. Lỗi kích hoạt R2

**Thông báo lỗi**:
```
✘ [ERROR] Please enable R2 through the Cloudflare Dashboard. [code: 10042]
```

**Cách khắc phục**: 
1. Đăng nhập [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Chọn "R2" từ menu bên trái
3. Click nút "Enable R2"
4. Đồng ý điều khoản và kích hoạt
5. Chạy lại `wrangler r2 bucket create demo-bucket`

#### 4. D1 migration thất bại

```bash
# Kiểm tra trạng thái database
wrangler d1 execute demo-database --remote --command="SELECT name FROM sqlite_master WHERE type='table';"

# Tạo lại database nếu cần
wrangler d1 delete demo-database
wrangler d1 create demo-database
# Đặt database_id mới vào wrangler.toml rồi migration lại
```

#### 5. Local development server không khởi động

```bash
# Chỉ định port khác nếu port đang bị chiếm
wrangler dev --port 8788

# Xóa cache
rm -rf .wrangler
npm run dev
```

#### 6. Lỗi binding khi deploy

Kiểm tra `wrangler.toml`, đảm bảo tất cả ID đã được cấu hình đúng.

#### 7. Không thể xóa R2 bucket

```bash
# Xóa tất cả objects trong bucket trước, sau đó xóa bucket
# Đầu tiên, lấy danh sách objects
wrangler r2 object list demo-bucket

# Xóa objects riêng lẻ
wrangler r2 object delete demo-bucket/object-key

# Hoặc dùng script xóa tất cả objects
# (Nếu có nhiều objects, khuyến nghị xóa từ Cloudflare Dashboard)
```

## Deploy Demo UI

`demo-ui.html` có thể được deploy dễ dàng bằng Cloudflare Pages.

### Phương pháp 1: Deploy với Cloudflare Pages (khuyến nghị)

1. **Đăng nhập Cloudflare Dashboard**
   - Truy cập [Cloudflare Dashboard](https://dash.cloudflare.com/)

2. **Tạo Pages project**
   ```bash
   # Tạo thư mục Pages
   mkdir demo-ui-pages
   cp demo-ui.html demo-ui-pages/index.html
   cd demo-ui-pages
   
   # Deploy lên Pages
   npx wrangler pages deploy . --project-name=cloudflare-demo-ui
   ```

3. **Hoàn tất deploy**
   - Khi deploy hoàn tất, bạn sẽ thấy URL:
   - `https://cloudflare-demo-ui.pages.dev`

### Phương pháp 2: Deploy với Cloudflare Workers

Cũng có thể tạo Worker trả về HTML trực tiếp.

1. **Tạo Worker cho UI deploy**
   ```bash
   # Tạo thư mục mới
   mkdir demo-ui-worker
   cd demo-ui-worker
   
   # Khởi tạo package.json
   npm init -y
   npm install wrangler --save-dev
   ```

2. **Tạo wrangler.toml**
   ```toml
   name = "cloudflare-demo-ui"
   main = "index.js"
   compatibility_date = "2024-01-15"
   workers_dev = true
   account_id = "your-account-id"
   ```

3. **Tạo index.js**
   ```javascript
   export default {
     async fetch(request) {
       const html = `<!DOCTYPE html>
       <!-- Dán nội dung demo-ui.html vào đây -->
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

4. **Deploy**
   ```bash
   npx wrangler deploy
   ```

### Phương pháp 3: Sử dụng cục bộ

Cách đơn giản nhất là mở `demo-ui.html` trực tiếp trong browser:

```bash
# Mở trong browser (macOS)
open demo-ui.html

# Mở trong browser (Linux)
xdg-open demo-ui.html

# Mở trong browser (Windows)
start demo-ui.html
```

Nhập URL Worker đã deploy vào "API Base URL" ở header:
- Cục bộ: `http://localhost:8787`
- Production: `https://cloudflare-demo-project.<your-subdomain>.workers.dev`

### Cấu hình sau khi deploy

1. **Cấu hình API Base URL**
   - Mở Demo UI
   - Nhập URL API production vào "API Base URL" ở header
   - Ví dụ: `https://cloudflare-demo-project.youqi-nie.workers.dev`

2. **Cấu hình API Key**
   - Nhập `Aquaring@74` vào "Master Key (KV)"
   - Đăng ký API key cho D1/R2 trong tab "API Keys"
   - Nhập API key đã đăng ký vào "API Key (D1/R2)"

3. **Kiểm tra hoạt động**
   - Click nút "Health Check" để xác minh kết nối
   - Test các thao tác trong từng tab

## Giấy phép

MIT

## Link tham khảo

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Hono Framework](https://hono.dev/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)
- [KV Storage](https://developers.cloudflare.com/workers/runtime-apis/kv/)
- [D1 Database](https://developers.cloudflare.com/d1/)
- [R2 Storage](https://developers.cloudflare.com/r2/)
