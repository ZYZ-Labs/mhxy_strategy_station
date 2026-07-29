import type {
  AuthenticatedUser,
  User,
  UserCredentialsRow,
  UserRole,
} from "./types";

function mapUser(row: {
  id: string;
  username: string;
  display_name: string;
  role: UserRole;
  status: "active" | "disabled";
  created_at: string;
}): User {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
  };
}

export async function findCredentialsByUsername(
  db: D1Database,
  username: string,
): Promise<UserCredentialsRow | null> {
  return db
    .prepare(
      `SELECT id, username, display_name, password_hash, password_salt,
              password_iterations, role, status, failed_login_count,
              locked_until, created_at
       FROM users
       WHERE username = ?1 COLLATE NOCASE
       LIMIT 1`,
    )
    .bind(username)
    .first<UserCredentialsRow>();
}

export async function hasAnyUsers(db: D1Database): Promise<boolean> {
  const row = await db
    .prepare("SELECT EXISTS(SELECT 1 FROM users LIMIT 1) AS present")
    .first<{ present: number }>();
  return row?.present === 1;
}

export async function createUserWithInvite(
  db: D1Database,
  input: {
    id: string;
    username: string;
    displayName: string;
    passwordHash: string;
    passwordSalt: string;
    passwordIterations: number;
    inviteHash: string;
    now: string;
  },
): Promise<void> {
  const insert = db
    .prepare(
      `INSERT INTO users (
         id, username, display_name, password_hash, password_salt,
         password_iterations, role, status, created_at, updated_at
       )
       SELECT ?1, ?2, ?3, ?4, ?5, ?6, 'member', 'active', ?8, ?8
       FROM invite_codes
       WHERE code_hash = ?7
         AND revoked_at IS NULL
         AND (expires_at IS NULL OR expires_at > ?8)
         AND use_count < max_uses
       LIMIT 1`,
    )
    .bind(
      input.id,
      input.username,
      input.displayName,
      input.passwordHash,
      input.passwordSalt,
      input.passwordIterations,
      input.inviteHash,
      input.now,
    );
  const consume = db
    .prepare(
      `UPDATE invite_codes
       SET use_count = use_count + 1
       WHERE code_hash = ?1
         AND revoked_at IS NULL
         AND (expires_at IS NULL OR expires_at > ?2)
         AND use_count < max_uses`,
    )
    .bind(input.inviteHash, input.now);

  const [insertResult, consumeResult] = await db.batch([insert, consume]);
  if (insertResult.meta.changes !== 1 || consumeResult.meta.changes !== 1) {
    throw new Error("邀请码无效、已过期或已用完");
  }
}

export async function createUserDuringOpenRegistration(
  db: D1Database,
  input: {
    id: string;
    username: string;
    displayName: string;
    passwordHash: string;
    passwordSalt: string;
    passwordIterations: number;
    ignoreThreshold: boolean;
    now: string;
  },
): Promise<boolean> {
  const result = await db
    .prepare(
      `INSERT INTO users (
         id, username, display_name, password_hash, password_salt,
         password_iterations, role, status, created_at, updated_at
       )
       SELECT ?1, ?2, ?3, ?4, ?5, ?6, 'member', 'active', ?8, ?8
       WHERE ?7 = 1
          OR EXISTS (
            SELECT 1
            FROM registration_settings settings
            WHERE settings.id = 'global'
              AND settings.threshold_locked = 0
              AND (
                SELECT COUNT(*)
                FROM users
                WHERE role <> 'super_admin'
              ) < settings.next_threshold
          )`,
    )
    .bind(
      input.id,
      input.username,
      input.displayName,
      input.passwordHash,
      input.passwordSalt,
      input.passwordIterations,
      input.ignoreThreshold ? 1 : 0,
      input.now,
    )
    .run();
  return result.meta.changes === 1;
}

export async function createPrivilegedUser(
  db: D1Database,
  input: {
    id: string;
    username: string;
    displayName: string;
    passwordHash: string;
    passwordSalt: string;
    passwordIterations: number;
    role: UserRole;
    now: string;
  },
): Promise<boolean> {
  const result = await db
    .prepare(
      `INSERT INTO users (
         id, username, display_name, password_hash, password_salt,
         password_iterations, role, status, created_at, updated_at
       )
       SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, 'active', ?8, ?8
       WHERE NOT EXISTS (SELECT 1 FROM users)`,
    )
    .bind(
      input.id,
      input.username,
      input.displayName,
      input.passwordHash,
      input.passwordSalt,
      input.passwordIterations,
      input.role,
      input.now,
    )
    .run();
  return result.meta.changes === 1;
}

export async function markLoginFailure(
  db: D1Database,
  userId: string,
  failedCount: number,
  lockedUntil: string | null,
  now: string,
): Promise<void> {
  await db
    .prepare(
      `UPDATE users
       SET failed_login_count = ?2, locked_until = ?3, updated_at = ?4
       WHERE id = ?1`,
    )
    .bind(userId, failedCount, lockedUntil, now)
    .run();
}

export async function clearLoginFailures(
  db: D1Database,
  userId: string,
  now: string,
): Promise<void> {
  await db
    .prepare(
      `UPDATE users
       SET failed_login_count = 0, locked_until = NULL, updated_at = ?2
       WHERE id = ?1`,
    )
    .bind(userId, now)
    .run();
}

export async function createSession(
  db: D1Database,
  input: {
    tokenHash: string;
    userId: string;
    expiresAt: string;
    now: string;
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO sessions (
         token_hash, user_id, expires_at, created_at, last_seen_at
       ) VALUES (?1, ?2, ?3, ?4, ?4)`,
    )
    .bind(input.tokenHash, input.userId, input.expiresAt, input.now)
    .run();
}

export async function findUserBySession(
  db: D1Database,
  tokenHash: string,
  now: string,
): Promise<AuthenticatedUser | null> {
  const row = await db
    .prepare(
      `SELECT u.id, u.username, u.display_name, u.role, u.status, u.created_at
       FROM sessions s
       INNER JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ?1
         AND s.expires_at > ?2
         AND u.status = 'active'
       LIMIT 1`,
    )
    .bind(tokenHash, now)
    .first<{
      id: string;
      username: string;
      display_name: string;
      role: UserRole;
      status: "active";
      created_at: string;
    }>();

  return row ? { ...mapUser(row), sessionTokenHash: tokenHash } : null;
}

export async function deleteSession(
  db: D1Database,
  tokenHash: string,
): Promise<void> {
  await db
    .prepare("DELETE FROM sessions WHERE token_hash = ?1")
    .bind(tokenHash)
    .run();
}

export async function createInvite(
  db: D1Database,
  input: {
    codeHash: string;
    label: string;
    createdBy: string;
    maxUses: number;
    expiresAt: string | null;
    now: string;
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO invite_codes (
         code_hash, label, created_by, max_uses, expires_at, created_at
       ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
    )
    .bind(
      input.codeHash,
      input.label,
      input.createdBy,
      input.maxUses,
      input.expiresAt,
      input.now,
    )
    .run();
}

export interface InviteSummary {
  codeHash: string;
  label: string;
  maxUses: number;
  useCount: number;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export async function listInvites(db: D1Database): Promise<InviteSummary[]> {
  const result = await db
    .prepare(
      `SELECT code_hash, label, max_uses, use_count, expires_at, revoked_at, created_at
       FROM invite_codes
       ORDER BY created_at DESC
       LIMIT 100`,
    )
    .all<{
      code_hash: string;
      label: string;
      max_uses: number;
      use_count: number;
      expires_at: string | null;
      revoked_at: string | null;
      created_at: string;
    }>();
  return result.results.map((row) => ({
    codeHash: row.code_hash,
    label: row.label,
    maxUses: row.max_uses,
    useCount: row.use_count,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
  }));
}

export interface UserSummary extends User {
  failedLoginCount: number;
  lockedUntil: string | null;
}

export async function listUsers(db: D1Database): Promise<UserSummary[]> {
  const result = await db
    .prepare(
      `SELECT id, username, display_name, role, status, failed_login_count,
              locked_until, created_at
       FROM users
       ORDER BY
         CASE role
           WHEN 'super_admin' THEN 0
           WHEN 'admin' THEN 1
           ELSE 2
         END,
         created_at ASC
       LIMIT 500`,
    )
    .all<{
      id: string;
      username: string;
      display_name: string;
      role: UserRole;
      status: "active" | "disabled";
      failed_login_count: number;
      locked_until: string | null;
      created_at: string;
    }>();
  return result.results.map((row) => ({
    ...mapUser(row),
    failedLoginCount: row.failed_login_count,
    lockedUntil: row.locked_until,
  }));
}

export async function updateNonSuperAdminRole(
  db: D1Database,
  userId: string,
  role: "member" | "admin",
  now: string,
): Promise<boolean> {
  const result = await db
    .prepare(
      `UPDATE users
       SET role = ?2, updated_at = ?3
       WHERE id = ?1
         AND role <> 'super_admin'`,
    )
    .bind(userId, role, now)
    .run();
  return result.meta.changes === 1;
}

export async function updateNonSuperAdminStatus(
  db: D1Database,
  userId: string,
  status: "active" | "disabled",
  now: string,
): Promise<boolean> {
  const result = await db.batch([
    db
      .prepare(
        `UPDATE users
         SET status = ?2, updated_at = ?3
         WHERE id = ?1
           AND role <> 'super_admin'`,
      )
      .bind(userId, status, now),
    db
      .prepare(
        `DELETE FROM sessions
         WHERE user_id = ?1
           AND ?2 = 'disabled'`,
      )
      .bind(userId, status),
  ]);
  return result[0].meta.changes === 1;
}

export async function writeAuditLog(
  db: D1Database,
  input: {
    id: string;
    actorId: string | null;
    action: string;
    targetType: string;
    targetId: string;
    details: Record<string, unknown>;
    now: string;
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO audit_logs (
         id, actor_id, action, target_type, target_id, details_json, created_at
       ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
    )
    .bind(
      input.id,
      input.actorId,
      input.action,
      input.targetType,
      input.targetId,
      JSON.stringify(input.details),
      input.now,
    )
    .run();
}
