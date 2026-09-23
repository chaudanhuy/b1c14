-- Có thể chạy lại; không sửa hoặc xóa dữ liệu hiện có.
CREATE TABLE IF NOT EXISTS smart_class_sessions (
 id TEXT PRIMARY KEY, host_id INTEGER NOT NULL, started_at INTEGER NOT NULL,
 ended_at INTEGER, title TEXT NOT NULL DEFAULT 'Smart Class'
);
CREATE TABLE IF NOT EXISTS smart_class_results (
 session_id TEXT NOT NULL, round_id TEXT NOT NULL, member_id INTEGER NOT NULL,
 mode TEXT NOT NULL, score INTEGER NOT NULL DEFAULT 0, accuracy REAL NOT NULL DEFAULT 0,
 elapsed_ms INTEGER, responded INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL,
 PRIMARY KEY(session_id, round_id, member_id)
);
CREATE INDEX IF NOT EXISTS idx_smart_results_member ON smart_class_results(member_id, session_id);
