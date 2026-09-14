# ĐH31LQA Internal Portal · v4 Dashboard

Bản v4 nâng cấp giao diện và luồng sử dụng từ website nộp minh chứng thành một **cổng nội bộ có Dashboard + Sidebar**, trong đó module minh chứng chỉ là một chức năng độc lập.

## Những thay đổi chính

- Màn hình đầu tiên chỉ còn **Đăng nhập**: chọn Tiểu đội/nhóm → Họ tên → Mật khẩu.
- Đăng nhập thành công mới mở **Dashboard**.
- Sidebar đóng/mở gồm:
  - Dashboard
  - Gửi minh chứng
  - Tài liệu của tôi
  - Quản lý minh chứng (chỉ tài khoản có quyền quản lý)
  - Tài khoản
- Giao diện được thiết kế lại sáng, hiện đại, nhiều màu nhưng từng màn hình chỉ tập trung vào một nhiệm vụ.
- Danh sách tài liệu dùng giao diện **Tiles kiểu File Explorer**.
- Mỗi định dạng có icon riêng: Image, PDF, Word, Excel, PowerPoint.
- Danh sách Tiles chỉ tải metadata; nội dung ảnh thật chỉ tải khi người dùng bấm xem, giảm việc tải hàng loạt file lớn.
- PDF có thể mở ở tab mới; Word/Excel/PowerPoint hiển thị đúng loại file và tải về bằng ứng dụng tương ứng.
- `/api/image` hỗ trợ hai chế độ:
  - mặc định: mở/preview file;
  - `download=1`: tải file với **đúng tên và phần mở rộng gốc**.
- Xuất ZIP đã sửa lỗi cũ ép file không phải JPEG/WebP thành `.png`; v4 giữ đúng `.pdf`, `.docx`, `.xlsx`, `.pptx`, v.v.
- Không cần migration database mới. D1 và R2 hiện tại tiếp tục sử dụng được.

## Cloudflare bindings

Cloudflare Pages cần:

- `DB` → D1 database
- `UPLOADS` → R2 bucket
- `SESSION_SECRET` hoặc `ADMIN_SECRET` → secret dùng ký phiên đăng nhập

## Giới hạn upload

- Tối đa 10 file/lần
- Tối đa 20 MB/file
- Tối đa 100 MB/lần gửi
- Hỗ trợ: PNG, JPG/JPEG, WEBP, PDF, DOC/DOCX, XLS/XLSX, PPT/PPTX

## Deploy

Giữ nguyên cấu trúc:

```text
public/
functions/
package.json
schema.sql
migration-v3-accounts.sql
README.md
```

Push toàn bộ source lên repository đang liên kết với Cloudflare Pages. Không cần chạy lại `schema.sql` hay migration nếu database hiện tại đang hoạt động bình thường.
