-- Chạy một lần trên D1 hiện tại trước khi deploy Pages.
ALTER TABLE members ADD COLUMN avatar_url TEXT DEFAULT NULL;
