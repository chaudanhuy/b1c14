# Tổng hợp hoạt động lớp · v3 Accounts

Bản này đã build lại theo đúng yêu cầu:

- Không còn nhập tên tự do.
- Ngay trên giao diện chính sẽ chọn **Nhóm → Họ và tên → Mật khẩu**.
- Danh sách tên hiển thị theo đúng nhóm:
  - Cán bộ trung đội
  - Tiểu đội 1
  - Tiểu đội 2
  - Tiểu đội 3
- Mật khẩu mặc định ban đầu của toàn lớp: `123456`.
- Mỗi người có thể tự đổi mật khẩu của mình.
- Chỉ chính người đang đăng nhập mới có thể xóa ảnh của bản thân.
- Cán bộ **không có quyền xóa** ảnh của người khác.
- Cán bộ có quyền tạo task, đóng/mở nhận bài, xem toàn lớp, xuất ZIP.
- Giao diện sáng, nhiều màu, tránh tông đen.

---

## 1) Cloudflare cần có những gì

Trong **Settings → Bindings** của Pages project:

- `DB` → D1 database
- `UPLOADS` → R2 bucket

Biến bí mật dùng ký session:

- Có thể dùng luôn `ADMIN_SECRET` cũ của bạn.
- Hoặc tự thêm `SESSION_SECRET` mới.

Code sẽ tự ưu tiên `SESSION_SECRET`, nếu không có thì dùng `ADMIN_SECRET`.

---

## 2) Nếu bạn đang dùng project v2 / v2.1

Chạy file SQL này trong D1 Console trước:

```text
migration-v3-accounts.sql
```

File này sẽ:

- đổi cấu trúc dữ liệu sang kiểu tài khoản cố định;
- seed danh sách lớp theo ảnh bạn đã gửi;
- giữ lại task và ảnh minh chứng cũ;
- chuyển dữ liệu cũ sang account tương ứng theo **tiểu đội + name_key**.

> Sau migration, các bảng backup cũ vẫn còn:
>
> - `task_submissions_v2_backup`
> - `submission_images_v2_backup`

---

## 3) Nếu làm mới hoàn toàn từ đầu

Chạy:

```text
schema.sql
```

File này sẽ tạo đầy đủ bảng + seed sẵn toàn bộ danh sách tài khoản lớp.

---

## 4) Source cần đẩy lên GitHub

Các phần quan trọng:

```text
public/
functions/
package.json
schema.sql
migration-v3-accounts.sql
README.md
```

---

## 5) Luồng sử dụng

### Học viên

1. Chọn tiểu đội.
2. Chọn tên trong danh sách.
3. Nhập mật khẩu.
4. Chọn task.
5. Tải ảnh minh chứng.
6. Vào mục **Ảnh của tôi** để xem hoặc xóa ảnh của chính mình.
7. Có thể đổi mật khẩu ở khung **Đổi mật khẩu**.

### Cán bộ trung đội

1. Chọn **Cán bộ trung đội**.
2. Chọn tên cán bộ.
3. Nhập mật khẩu.
4. Vẫn có thể nộp ảnh cho chính mình.
5. Đồng thời có thêm khu **Bảng kiểm tra toàn lớp**:
   - xem toàn bộ danh sách;
   - tạo task;
   - đóng / mở task;
   - xuất ZIP.

---

## 6) Cấu trúc ZIP xuất ra

```text
Ten task/
├── Cán bộ trung đội/
│   └── Tên người/
│       ├── 01-...
│       └── 02-...
├── Tiểu đội 1/
├── Tiểu đội 2/
└── Tiểu đội 3/
```

---

## 7) Ghi chú bảo mật

- Tài khoản mặc định ban đầu đều là `123456`.
- Khuyên mỗi người đổi sớm để tránh người khác biết mật khẩu chung.
- Server chỉ cho phép xóa ảnh khi ảnh đó thuộc đúng `member_id` đang đăng nhập.
- Cán bộ chỉ có quyền xem / tổng hợp / xuất file, **không có DELETE API cho admin**.
deploy trigger
