PRAGMA defer_foreign_keys = ON;

CREATE TABLE users_workers_pbkdf2 (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL COLLATE NOCASE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_iterations INTEGER NOT NULL CHECK (password_iterations = 100000),
  role TEXT NOT NULL CHECK (role IN ('member', 'admin', 'super_admin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  failed_login_count INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO users_workers_pbkdf2 (
  id,
  username,
  display_name,
  password_hash,
  password_salt,
  password_iterations,
  role,
  status,
  failed_login_count,
  locked_until,
  created_at,
  updated_at
)
SELECT
  id,
  username,
  display_name,
  password_hash,
  password_salt,
  password_iterations,
  role,
  status,
  failed_login_count,
  locked_until,
  created_at,
  updated_at
FROM users;

DROP TABLE users;
ALTER TABLE users_workers_pbkdf2 RENAME TO users;

CREATE UNIQUE INDEX users_username_unique ON users(username);
CREATE INDEX users_status_role_idx ON users(status, role);
CREATE UNIQUE INDEX users_single_super_admin
  ON users(role)
  WHERE role = 'super_admin';

PRAGMA defer_foreign_keys = OFF;
PRAGMA foreign_key_check;
