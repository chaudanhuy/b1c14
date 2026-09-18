# B1C14 — Cổng nội bộ lớp học

Vanilla JS/CSS + Cloudflare Pages Functions, D1, R2; LQA-Message và Smart Class dùng các Worker Durable Object riêng.

Bắt đầu bằng **[HUONG-DAN-CAP-NHAT.md](HUONG-DAN-CAP-NHAT.md)**. Đây là bản nâng cấp cho database/website hiện có trong ZIP nguồn, không phải bộ khởi tạo tài khoản production mới.

## Các thư mục

| Đường dẫn | Vai trò |
|---|---|
| public/ | Giao diện thành viên/cán sự, CSS, JS và tài nguyên |
| functions/ | API Pages, phiên đăng nhập, phân quyền, D1/R2 |
| chat-worker/ | LQA-Message 1v1 đang dùng, giữ nguyên |
| smart-class-worker/ | Room realtime, FSM, sáu chế độ, chấm điểm và đồng bộ D1 |
| scripts/ | Đồng bộ admin.html, đóng gói source |
| tests/ | Kiểm thử Node, JSDOM và Cloudflare workerd/Miniflare; dữ liệu tổng hợp |
| migration-avatar.sql | Thêm members.avatar_url, chạy một lần |
| migration-smart-class.sql | Hai bảng điểm/phiên và index, chạy lặp an toàn |

## Lệnh

```sh
npm ci
npm test
npm run build
npm run build:smart
npm run build:chat
npm run pack
```

`build` đồng bộ `public/admin.html` từ `public/index.html` rồi biên dịch Pages Functions. `build:smart`/`build:chat` là dry-run. Website chính dùng thư mục `public` cùng Functions ở gốc repo; các Worker được deploy riêng.

Không đưa secret hoặc bản xuất database production vào repo. Database ID trong Wrangler là định danh cấu hình, không phải khóa truy cập. Xem báo cáo thay đổi và kiểm thử trong các tệp `.md` đi kèm.
