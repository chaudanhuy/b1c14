PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  title_key TEXT NOT NULL UNIQUE,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS task_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL,
  squad INTEGER NOT NULL CHECK (squad BETWEEN 1 AND 3),
  name TEXT NOT NULL,
  name_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (task_id, squad, name_key),
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS submission_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id INTEGER NOT NULL,
  image_key TEXT NOT NULL UNIQUE,
  image_type TEXT NOT NULL,
  image_name TEXT,
  image_size INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (submission_id) REFERENCES task_submissions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tasks_active_created
ON tasks (is_active, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_task_submissions_task_squad
ON task_submissions (task_id, squad, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_submission_images_submission
ON submission_images (submission_id, created_at ASC);
