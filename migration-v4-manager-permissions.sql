-- v4.1: Cấp quyền quản lý cho nhóm học viên được chỉ định.
-- File này chỉ cần chạy nếu muốn đồng bộ can_manage trong D1 ngay lập tức.
-- Source v4.1 cũng tự nhận diện và đồng bộ quyền khi người dùng đăng nhập.

UPDATE members
SET can_manage = 1,
    updated_at = datetime('now')
WHERE name_key IN (
  'chau dan huy',
  'nguyen duc an',
  'nguyen quang dieu',
  'thai thanh phong',
  'tran le loi',
  'tran hoang kien',
  'trinh long vu'
);
