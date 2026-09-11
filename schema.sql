CREATE TABLE IF NOT EXISTS submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  squad INTEGER NOT NULL CHECK (squad BETWEEN 1 AND 3),
  name TEXT NOT NULL,
  name_key TEXT NOT NULL,
  image_key TEXT NOT NULL,
  image_type TEXT NOT NULL,
  image_name TEXT,
  image_size INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_submissions_squad_name_key
ON submissions (squad, name_key);

CREATE INDEX IF NOT EXISTS idx_submissions_squad
ON submissions (squad);

CREATE INDEX IF NOT EXISTS idx_submissions_updated_at
ON submissions (updated_at DESC);
