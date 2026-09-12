PRAGMA foreign_keys = OFF;

-- 1) Sao lưu bảng cũ nếu đang ở bản v2.
ALTER TABLE task_submissions RENAME TO task_submissions_v2_backup;
ALTER TABLE submission_images RENAME TO submission_images_v2_backup;

-- 2) Tạo cấu trúc mới theo tài khoản cố định của lớp.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  unit_code TEXT NOT NULL CHECK (unit_code IN ('cadre', '1', '2', '3')),
  unit_label TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  name TEXT NOT NULL,
  name_key TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  is_default_password INTEGER NOT NULL DEFAULT 1 CHECK (is_default_password IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (unit_code, name_key)
);

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
  member_id INTEGER NOT NULL,
  unit_code TEXT NOT NULL CHECK (unit_code IN ('cadre', '1', '2', '3')),
  unit_label TEXT NOT NULL,
  name TEXT NOT NULL,
  name_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (task_id, member_id),
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
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

CREATE INDEX IF NOT EXISTS idx_members_unit_display ON members (unit_code, display_order, name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_tasks_active_created ON tasks (is_active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_submissions_task_unit ON task_submissions (task_id, unit_code, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_submission_images_submission ON submission_images (submission_id, created_at DESC);

INSERT OR IGNORE INTO members (unit_code, unit_label, display_order, name, name_key, password_salt, password_hash, is_default_password, created_at, updated_at) VALUES ('cadre','Cán bộ trung đội',1,'Vũ Trọng Thắng','vu trong thang','f0NXBX5X9pFaPatZ','29UUB_WClRfNjH-1fQvcBVY4DdEb7GdvRjXfCYNf2_Y',1,datetime('now'),datetime('now'));
INSERT OR IGNORE INTO members (unit_code, unit_label, display_order, name, name_key, password_salt, password_hash, is_default_password, created_at, updated_at) VALUES ('cadre','Cán bộ trung đội',2,'Nguyễn Sở Trường','nguyen so truong','qb4GI0ME9iuV3NCO','xQXAjEWFP_YpWW9PfiQ-p3OYC0Dtc-6O47SP4IuzbnU',1,datetime('now'),datetime('now'));
INSERT OR IGNORE INTO members (unit_code, unit_label, display_order, name, name_key, password_salt, password_hash, is_default_password, created_at, updated_at) VALUES ('1','Tiểu đội 1',1,'Cao Hoàng Nam','cao hoang nam','uCRKW7BoMMfH_EuQ','KlPwLF1aJkiZk2StnRq5zN44-UWBS-E01YgAOFqvaik',1,datetime('now'),datetime('now'));
INSERT OR IGNORE INTO members (unit_code, unit_label, display_order, name, name_key, password_salt, password_hash, is_default_password, created_at, updated_at) VALUES ('1','Tiểu đội 1',2,'Trần Phan Xuân Tú','tran phan xuan tu','74csfUIy4_PGRqzP','pKCxIJjoP5ZDvnf2Y1oCriZytcphO-9fzQdUIbwQjKE',1,datetime('now'),datetime('now'));
INSERT OR IGNORE INTO members (unit_code, unit_label, display_order, name, name_key, password_salt, password_hash, is_default_password, created_at, updated_at) VALUES ('1','Tiểu đội 1',3,'Nguyễn Đức Mạnh','nguyen duc manh','WCbscd1iMhiYfhYm','5dRh0nWqPXxilpnr6W79Zb30Y_J-vmw_flUH289G4pc',1,datetime('now'),datetime('now'));
INSERT OR IGNORE INTO members (unit_code, unit_label, display_order, name, name_key, password_salt, password_hash, is_default_password, created_at, updated_at) VALUES ('1','Tiểu đội 1',4,'Nguyễn Đức Trọng','nguyen duc trong','G4j8rD0IsdKTFa7o','kJeqOEOCDD44NQ6f_35AKT_1_n93vK-HZlZTDVotACA',1,datetime('now'),datetime('now'));
INSERT OR IGNORE INTO members (unit_code, unit_label, display_order, name, name_key, password_salt, password_hash, is_default_password, created_at, updated_at) VALUES ('1','Tiểu đội 1',5,'Mai Tiến Dũng','mai tien dung','Aq8slDeAUa2HeDRT','eWc0lpFhiT2vRsHYqLm3OEocEE0XEGKQDhz0qpkGe8s',1,datetime('now'),datetime('now'));
INSERT OR IGNORE INTO members (unit_code, unit_label, display_order, name, name_key, password_salt, password_hash, is_default_password, created_at, updated_at) VALUES ('1','Tiểu đội 1',6,'Triệu Hoàng Thương','trieu hoang thuong','E4sxB2cLLGXmdTE-','1prl64nd6vDf6DxIKTGqR6vmTIfmlMdM9MGi5KoYsZE',1,datetime('now'),datetime('now'));
INSERT OR IGNORE INTO members (unit_code, unit_label, display_order, name, name_key, password_salt, password_hash, is_default_password, created_at, updated_at) VALUES ('1','Tiểu đội 1',7,'Châu Đan Huy','chau dan huy','N48S1g2JChjbcEsd','VSWBgx2c50-FqCWltlYwjSh5rop1gAGFjDxwO0-pOC0',1,datetime('now'),datetime('now'));
INSERT OR IGNORE INTO members (unit_code, unit_label, display_order, name, name_key, password_salt, password_hash, is_default_password, created_at, updated_at) VALUES ('1','Tiểu đội 1',8,'Nguyễn Đức An','nguyen duc an','pq4enIRACsuQ2EwV','vhYTCxUGoU78UsPjBbEMgTREKXAgHDYpAnjyWOcK0UY',1,datetime('now'),datetime('now'));
INSERT OR IGNORE INTO members (unit_code, unit_label, display_order, name, name_key, password_salt, password_hash, is_default_password, created_at, updated_at) VALUES ('1','Tiểu đội 1',9,'Nguyễn Quang Diệu','nguyen quang dieu','0X9tQmE7uM0k-SHx','n5qkTAaeSPDoDyuqKJz265LroPLZfIJwJ70ljiRoTmw',1,datetime('now'),datetime('now'));
INSERT OR IGNORE INTO members (unit_code, unit_label, display_order, name, name_key, password_salt, password_hash, is_default_password, created_at, updated_at) VALUES ('2','Tiểu đội 2',1,'Thái Thanh Phong','thai thanh phong','ex4H5znxHwxWEEwQ','i-QBc2T6oWerK7TPLIZtxU5waLdljO7WNlxOO04GAzU',1,datetime('now'),datetime('now'));
INSERT OR IGNORE INTO members (unit_code, unit_label, display_order, name, name_key, password_salt, password_hash, is_default_password, created_at, updated_at) VALUES ('2','Tiểu đội 2',2,'Trần Lê Lợi','tran le loi','AGzrBFBBBhJhz4TX','cxZRNmL62QFkAObRKon9u9J6IGdLjTZ_5T3bXH0fByY',1,datetime('now'),datetime('now'));
INSERT OR IGNORE INTO members (unit_code, unit_label, display_order, name, name_key, password_salt, password_hash, is_default_password, created_at, updated_at) VALUES ('2','Tiểu đội 2',3,'Nguyễn Văn Quyết','nguyen van quyet','dUlzrCn8Cs58k7wQ','FC_Yg1JkkWd62Evpisf_EO9NhU6FFrx1J4fsfAwKG04',1,datetime('now'),datetime('now'));
INSERT OR IGNORE INTO members (unit_code, unit_label, display_order, name, name_key, password_salt, password_hash, is_default_password, created_at, updated_at) VALUES ('2','Tiểu đội 2',4,'Ma Hà Đông','ma ha dong','IrLw-3zNZ0wGIOab','5Z3xYyq9tCAnH40BoIcrsLgkD-GjEGLvOFZNKeYu7z4',1,datetime('now'),datetime('now'));
INSERT OR IGNORE INTO members (unit_code, unit_label, display_order, name, name_key, password_salt, password_hash, is_default_password, created_at, updated_at) VALUES ('2','Tiểu đội 2',5,'Trần Trọng Hiếu','tran trong hieu','U-AVLXEN8xPSvRln','5JDWggC-MEofw9NiEjW3I9DiOE_eOfUNnqAlyMbMaK4',1,datetime('now'),datetime('now'));
INSERT OR IGNORE INTO members (unit_code, unit_label, display_order, name, name_key, password_salt, password_hash, is_default_password, created_at, updated_at) VALUES ('2','Tiểu đội 2',6,'Phan Thanh Tùng','phan thanh tung','KYhInxds8_EDIm6B','56-2kaENFnbHwocVZIF9cy7OLOXK8BrDf7MZZw8jjUw',1,datetime('now'),datetime('now'));
INSERT OR IGNORE INTO members (unit_code, unit_label, display_order, name, name_key, password_salt, password_hash, is_default_password, created_at, updated_at) VALUES ('2','Tiểu đội 2',7,'Hoàng Hồng Phúc','hoang hong phuc','nmvWI6DbinrThIOB','N2iOP6ILj9xBL-AotaFdKwDGeQ3CD7xTtwjPuVQOiWc',1,datetime('now'),datetime('now'));
INSERT OR IGNORE INTO members (unit_code, unit_label, display_order, name, name_key, password_salt, password_hash, is_default_password, created_at, updated_at) VALUES ('2','Tiểu đội 2',8,'Nguyễn Thái Vinh','nguyen thai vinh','uX0QEh7DdP0NYDeE','xBVCAsUbZtfzbcc1I0Jo1GA2NnUhZ_6XFZTuOQRD-RQ',1,datetime('now'),datetime('now'));
INSERT OR IGNORE INTO members (unit_code, unit_label, display_order, name, name_key, password_salt, password_hash, is_default_password, created_at, updated_at) VALUES ('2','Tiểu đội 2',9,'Nguyễn Hồng Đức','nguyen hong duc','agLtIM1lIBvcjEFn','z_6m26566-a1FWltJKSvkEdsnNGPWPSs1l8r22gUgj4',1,datetime('now'),datetime('now'));
INSERT OR IGNORE INTO members (unit_code, unit_label, display_order, name, name_key, password_salt, password_hash, is_default_password, created_at, updated_at) VALUES ('3','Tiểu đội 3',1,'Trần Hoàng Kiên','tran hoang kien','Mu9HspCZxxelLPdk','IRgWE0Rw_rXMw65afLs6HbyFVhOsDskl2Rs8tXR2ZfE',1,datetime('now'),datetime('now'));
INSERT OR IGNORE INTO members (unit_code, unit_label, display_order, name, name_key, password_salt, password_hash, is_default_password, created_at, updated_at) VALUES ('3','Tiểu đội 3',2,'Trịnh Long Vũ','trinh long vu','0mnhp-zPkgErgShu','dG-_PH2CF-9pnte_vh5YaIWbMchTPehCgg-LcykJMKI',1,datetime('now'),datetime('now'));
INSERT OR IGNORE INTO members (unit_code, unit_label, display_order, name, name_key, password_salt, password_hash, is_default_password, created_at, updated_at) VALUES ('3','Tiểu đội 3',3,'Nguyễn Thái An','nguyen thai an','Z59Jk9DEEG-zCF8p','eHtFwN6yXVEcvbmy1aU_kxgv9i29_EbvT6YWiOCZH2Y',1,datetime('now'),datetime('now'));
INSERT OR IGNORE INTO members (unit_code, unit_label, display_order, name, name_key, password_salt, password_hash, is_default_password, created_at, updated_at) VALUES ('3','Tiểu đội 3',4,'Nguyễn Quang Thành','nguyen quang thanh','f64UpGQ7C4DGGxy8','oHMw__vdrAqmTNJ9lrVd48mRIZQhYyYAoWBZknTT6dk',1,datetime('now'),datetime('now'));
INSERT OR IGNORE INTO members (unit_code, unit_label, display_order, name, name_key, password_salt, password_hash, is_default_password, created_at, updated_at) VALUES ('3','Tiểu đội 3',5,'Vũ Tiến Anh','vu tien anh','YEc4T1_gRkEcKLvi','ilZsbMXBaQxWDvZ6ZSiPH890Fg218rpUCiXoyiqxBYc',1,datetime('now'),datetime('now'));
INSERT OR IGNORE INTO members (unit_code, unit_label, display_order, name, name_key, password_salt, password_hash, is_default_password, created_at, updated_at) VALUES ('3','Tiểu đội 3',6,'Lê Minh Thảo','le minh thao','FbpZQvoapjo3s8mE','PwNWMr4Y6pRJUrrEZAt9AmnjjCgc2_Yqfi9A7cSESb4',1,datetime('now'),datetime('now'));
INSERT OR IGNORE INTO members (unit_code, unit_label, display_order, name, name_key, password_salt, password_hash, is_default_password, created_at, updated_at) VALUES ('3','Tiểu đội 3',7,'Phan Tấn Duy','phan tan duy','caqYkHvJ4cfZAHdj','YhOD5fNP2IA2EI5JzpRGRKlhOCCSAiWRD4toELpRFk0',1,datetime('now'),datetime('now'));
INSERT OR IGNORE INTO members (unit_code, unit_label, display_order, name, name_key, password_salt, password_hash, is_default_password, created_at, updated_at) VALUES ('3','Tiểu đội 3',8,'Hồ Đình Hoàng Thắng','ho dinh hoang thang','B9nEldHTj1i1Z734','uqeyItDMGhx0IEEP0-wjteyzHe7maHVQ0LwJQowzcGA',1,datetime('now'),datetime('now'));


-- 3) Nếu có tên lạ từng tồn tại ở v2 mà không nằm trong roster chính thức, vẫn thêm vào members để không mất dữ liệu cũ.
INSERT OR IGNORE INTO members (unit_code, unit_label, display_order, name, name_key, password_salt, password_hash, is_default_password, created_at, updated_at)
SELECT
  CAST(b.squad AS TEXT) AS unit_code,
  CASE b.squad WHEN 1 THEN 'Tiểu đội 1' WHEN 2 THEN 'Tiểu đội 2' WHEN 3 THEN 'Tiểu đội 3' ELSE 'Tiểu đội lạ' END AS unit_label,
  1000 + b.id AS display_order,
  b.name,
  b.name_key,
  'legacyDefaultSalt',
  'Wk6m8KV5IPAnVwGJnr5to2r6_C8AlrxlQHR8g6pdGpA',
  1,
  COALESCE(b.created_at, datetime('now')),
  COALESCE(b.updated_at, datetime('now'))
FROM task_submissions_v2_backup b
LEFT JOIN members m
  ON m.unit_code = CAST(b.squad AS TEXT)
 AND m.name_key = b.name_key
WHERE m.id IS NULL;

-- 4) Chuyển submissions cũ sang submissions mới, giữ nguyên id để hình ảnh copy theo ổn định.
INSERT INTO task_submissions (id, task_id, member_id, unit_code, unit_label, name, name_key, created_at, updated_at)
SELECT
  b.id,
  b.task_id,
  m.id,
  m.unit_code,
  m.unit_label,
  m.name,
  m.name_key,
  COALESCE(b.created_at, datetime('now')),
  COALESCE(b.updated_at, datetime('now'))
FROM task_submissions_v2_backup b
JOIN members m
  ON m.unit_code = CAST(b.squad AS TEXT)
 AND m.name_key = b.name_key;

-- 5) Chuyển hình ảnh cũ sang bảng mới.
INSERT INTO submission_images (id, submission_id, image_key, image_type, image_name, image_size, created_at)
SELECT
  id,
  submission_id,
  image_key,
  image_type,
  image_name,
  image_size,
  created_at
FROM submission_images_v2_backup;

PRAGMA foreign_keys = ON;
