-- Ngân hàng câu hỏi Smart Class. Có thể chạy lại, không xóa dữ liệu hiện có.
CREATE TABLE IF NOT EXISTS smart_class_questions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Chung',
  mode TEXT NOT NULL,
  prompt TEXT NOT NULL,
  duration INTEGER NOT NULL,
  payload_json TEXT NOT NULL,
  created_by INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_smart_questions_category_mode
  ON smart_class_questions(category, mode, updated_at DESC);

CREATE TABLE IF NOT EXISTS smart_class_question_sets (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_by INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS smart_class_question_set_items (
  set_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  PRIMARY KEY(set_id, question_id),
  UNIQUE(set_id, position)
);
CREATE INDEX IF NOT EXISTS idx_smart_set_items_question
  ON smart_class_question_set_items(question_id, set_id);

-- Lưu nguồn câu hỏi theo từng vòng để thống kê ngân hàng câu hỏi.
CREATE TABLE IF NOT EXISTS smart_class_rounds (
  session_id TEXT NOT NULL,
  round_id TEXT NOT NULL,
  question_id TEXT,
  mode TEXT NOT NULL,
  prompt TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY(session_id, round_id)
);
CREATE INDEX IF NOT EXISTS idx_smart_rounds_question
  ON smart_class_rounds(question_id, created_at DESC);
