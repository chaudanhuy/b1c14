# Tổng hợp hoạt động - Cloudflare Pages

Website nộp ảnh minh chứng dành cho 3 tiểu đội, có khu vực cán bộ để xem thống kê và ảnh theo từng tiểu đội.

## Chức năng

- Học viên chọn Tiểu đội 1 / 2 / 3, nhập họ tên và tải 1 ảnh minh chứng.
- Ảnh hỗ trợ PNG, JPG/JPEG, WEBP; tối đa 8 MB.
- Mỗi cặp `Họ tên + Tiểu đội` chỉ có 1 bản nộp hiện hành. Nộp lại sẽ thay ảnh cũ.
- Trang học viên chỉ công khai số lượng đã nộp của từng tiểu đội và toàn lớp.
- Trang `/admin.html` yêu cầu mật khẩu cán bộ.
- Cán bộ xem tổng số, số theo từng tiểu đội, tìm tên, xem ảnh lớn và xóa bản nộp sai.
- Danh sách tự làm mới mỗi 15 giây; trang học viên cập nhật thống kê mỗi 20 giây.

## Kiến trúc

- Frontend: HTML + CSS + JavaScript thuần trong `public/`.
- API: Cloudflare Pages Functions trong `functions/`.
- Metadata: Cloudflare D1, binding tên `DB`.
- Ảnh: Cloudflare R2, binding tên `UPLOADS`.
- Phiên cán bộ: cookie HttpOnly ký bằng HMAC; mật khẩu và khóa ký lưu trong biến môi trường.

## Cấu trúc

```text
activity-submission-cloudflare/
├── public/
│   ├── index.html
│   ├── admin.html
│   └── assets/
│       ├── css/main.css
│       └── js/
│           ├── app.js
│           └── admin.js
├── functions/
│   ├── _lib/
│   └── api/
├── schema.sql
├── package.json
└── README.md
```

# Deploy lên Cloudflare Pages

> Vì dự án có Pages Functions, không nên dùng kiểu kéo-thả thư mục trực tiếp trên Dashboard. Hãy dùng GitHub/Git integration hoặc Wrangler.

## Bước 1 - Đưa source lên GitHub

Tạo một repository mới, sau đó đưa toàn bộ nội dung của thư mục này lên repository.

## Bước 2 - Tạo Cloudflare Pages project

Trong Cloudflare Dashboard:

1. `Workers & Pages` → tạo Pages project từ Git repository.
2. Chọn repository vừa tạo.
3. Framework preset: `None`.
4. Build command: `exit 0`.
5. Build output directory: `public`.
6. Deploy.

Sau bước này bạn sẽ có địa chỉ kiểu:

```text
https://ten-du-an.pages.dev
```

Lần deploy đầu API có thể chưa hoạt động vì ta chưa tạo D1/R2 và bindings. Tiếp tục các bước dưới.

## Bước 3 - Tạo D1 database

Trong Cloudflare Dashboard tạo một D1 database, ví dụ:

```text
activity-submission-db
```

Mở D1 Console và chạy toàn bộ nội dung trong file `schema.sql`.

Sau đó vào Pages project:

`Settings` → `Bindings` → `Add` → `D1 database`

- Variable name: `DB`
- Database: chọn database vừa tạo.

## Bước 4 - Tạo R2 bucket

Tạo R2 bucket, ví dụ:

```text
activity-submission-images
```

Sau đó vào Pages project:

`Settings` → `Bindings` → `Add` → `R2 bucket`

- Variable name: `UPLOADS`
- Bucket: chọn bucket vừa tạo.

Không cần public R2 bucket. Ảnh được đọc qua API dành cho cán bộ.

## Bước 5 - Cấu hình mật khẩu cán bộ

Trong Pages project, thêm hai biến môi trường cho Production:

```text
ADMIN_PASSWORD = mật-khẩu-cán-bộ-của-bạn
ADMIN_SECRET   = một-chuỗi-bí-mật-dài-ngẫu-nhiên
```

Ví dụ `ADMIN_SECRET` nên là một chuỗi ngẫu nhiên dài ít nhất khoảng 32 ký tự. Không đưa hai giá trị thật này lên GitHub.

## Bước 6 - Redeploy

Bindings và environment variables chỉ có hiệu lực sau khi deploy lại.

Vào `Deployments` → tạo deployment mới, hoặc push một commit mới lên GitHub.

Sau khi redeploy:

- Học viên: `https://ten-du-an.pages.dev/`
- Cán bộ: `https://ten-du-an.pages.dev/admin.html`

# Kiểm tra nhanh

1. Mở trang chính.
2. Chọn Tiểu đội 1.
3. Nhập tên thử nghiệm.
4. Chọn một ảnh PNG/JPG/WEBP và bấm Gửi minh chứng.
5. Số Tiểu đội 1 và tổng lớp phải tăng lên 1.
6. Vào `/admin.html`, nhập `ADMIN_PASSWORD`.
7. Kiểm tra tên, ảnh và thời gian nộp.
8. Nộp lại cùng tên + cùng tiểu đội với ảnh khác: số lượng không tăng, ảnh cũ được thay.

# Lưu ý dữ liệu

Tên học viên và ảnh minh chứng là dữ liệu nội bộ. Trang công khai chỉ trả về số lượng; danh sách tên và ảnh chỉ có thể truy cập sau khi đăng nhập khu vực cán bộ.
