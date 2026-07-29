PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL COLLATE NOCASE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_iterations INTEGER NOT NULL CHECK (password_iterations >= 600000),
  role TEXT NOT NULL CHECK (role IN ('member', 'admin', 'super_admin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  failed_login_count INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX users_username_unique ON users(username);
CREATE INDEX users_status_role_idx ON users(status, role);
CREATE UNIQUE INDEX users_single_super_admin
  ON users(role)
  WHERE role = 'super_admin';

CREATE TABLE registration_settings (
  id TEXT PRIMARY KEY CHECK (id = 'global'),
  manual_mode TEXT NOT NULL DEFAULT 'open'
    CHECK (manual_mode IN ('open', 'invite_only')),
  threshold_step INTEGER NOT NULL DEFAULT 100
    CHECK (threshold_step BETWEEN 10 AND 100000),
  next_threshold INTEGER NOT NULL DEFAULT 100 CHECK (next_threshold > 0),
  threshold_locked INTEGER NOT NULL DEFAULT 0 CHECK (threshold_locked IN (0, 1)),
  timezone TEXT NOT NULL DEFAULT 'Asia/Shanghai',
  updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO registration_settings (
  id, manual_mode, threshold_step, next_threshold, threshold_locked,
  timezone, updated_at
) VALUES (
  'global', 'open', 100, 100, 0, 'Asia/Shanghai', CURRENT_TIMESTAMP
);

CREATE TABLE registration_schedules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  schedule_type TEXT NOT NULL CHECK (schedule_type IN ('one_time', 'weekly')),
  starts_at TEXT,
  ends_at TEXT,
  weekdays_json TEXT CHECK (weekdays_json IS NULL OR json_valid(weekdays_json)),
  local_start_time TEXT,
  local_end_time TEXT,
  threshold_guard INTEGER NOT NULL DEFAULT 1 CHECK (threshold_guard IN (0, 1)),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (
    (
      schedule_type = 'one_time'
      AND starts_at IS NOT NULL
      AND ends_at IS NOT NULL
      AND weekdays_json IS NULL
      AND local_start_time IS NULL
      AND local_end_time IS NULL
    )
    OR
    (
      schedule_type = 'weekly'
      AND starts_at IS NULL
      AND ends_at IS NULL
      AND weekdays_json IS NOT NULL
      AND local_start_time IS NOT NULL
      AND local_end_time IS NOT NULL
    )
  )
);

CREATE INDEX registration_schedules_enabled_idx
  ON registration_schedules(enabled, schedule_type);

CREATE TABLE registration_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  non_super_user_count INTEGER NOT NULL,
  details_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(details_json)),
  created_at TEXT NOT NULL
);

CREATE INDEX registration_events_created_idx
  ON registration_events(created_at DESC);

CREATE TABLE invite_codes (
  code_hash TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  max_uses INTEGER NOT NULL DEFAULT 1 CHECK (max_uses > 0),
  use_count INTEGER NOT NULL DEFAULT 0 CHECK (use_count >= 0),
  expires_at TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX invite_codes_created_by_idx ON invite_codes(created_by, created_at DESC);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);

CREATE INDEX sessions_user_id_idx ON sessions(user_id);
CREATE INDEX sessions_expires_at_idx ON sessions(expires_at);

CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'hidden')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX categories_slug_unique ON categories(slug);
CREATE UNIQUE INDEX categories_name_unique ON categories(name);
CREATE INDEX categories_status_sort_idx ON categories(status, sort_order, name);

CREATE TABLE content_entries (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  author_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  published_revision_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX content_entries_slug_unique ON content_entries(slug);
CREATE INDEX content_entries_author_idx ON content_entries(author_id, updated_at DESC);
CREATE INDEX content_entries_published_idx ON content_entries(published_revision_id, updated_at DESC);

CREATE TABLE content_revisions (
  id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL REFERENCES content_entries(id) ON DELETE CASCADE,
  revision_no INTEGER NOT NULL CHECK (revision_no > 0),
  title TEXT NOT NULL CHECK (length(title) BETWEEN 4 AND 80),
  summary TEXT NOT NULL CHECK (length(summary) BETWEEN 10 AND 240),
  body TEXT NOT NULL CHECK (length(body) BETWEEN 50 AND 30000),
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  tags_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(tags_json)),
  content_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (
    status IN (
      'draft',
      'submitted',
      'rule_checking',
      'manual_review',
      'approved',
      'rejected',
      'published'
    )
  ),
  submitted_at TEXT,
  reviewed_at TEXT,
  reviewer_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
  rejection_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(entry_id, revision_no)
);

CREATE INDEX content_revisions_entry_idx ON content_revisions(entry_id, revision_no DESC);
CREATE INDEX content_revisions_status_idx ON content_revisions(status, submitted_at);
CREATE INDEX content_revisions_content_hash_idx ON content_revisions(content_hash);
CREATE INDEX content_revisions_category_idx ON content_revisions(category_id, status);

CREATE TABLE moderation_results (
  id TEXT PRIMARY KEY,
  revision_id TEXT NOT NULL UNIQUE REFERENCES content_revisions(id) ON DELETE CASCADE,
  policy_version TEXT NOT NULL,
  rule_version TEXT NOT NULL,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('clear', 'warning', 'critical', 'error')),
  matches_json TEXT NOT NULL CHECK (json_valid(matches_json)),
  checked_at TEXT NOT NULL,
  error_message TEXT
);

CREATE INDEX moderation_results_risk_idx ON moderation_results(risk_level, checked_at);

CREATE TABLE moderation_decisions (
  id TEXT PRIMARY KEY,
  revision_id TEXT NOT NULL REFERENCES content_revisions(id) ON DELETE CASCADE,
  reviewer_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  decision TEXT NOT NULL CHECK (decision IN ('approve', 'reject')),
  categories_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(categories_json)),
  reason TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (revision_id)
);

CREATE INDEX moderation_decisions_revision_idx
  ON moderation_decisions(revision_id, created_at DESC);
CREATE INDEX moderation_decisions_reviewer_idx
  ON moderation_decisions(reviewer_id, created_at DESC);

CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  details_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(details_json)),
  created_at TEXT NOT NULL
);

CREATE INDEX audit_logs_target_idx ON audit_logs(target_type, target_id, created_at DESC);
CREATE INDEX audit_logs_actor_idx ON audit_logs(actor_id, created_at DESC);
