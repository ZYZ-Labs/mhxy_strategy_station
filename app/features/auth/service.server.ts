import { createId } from "~/lib/ids";
import {
  base64ToBytes,
  constantTimeEqual,
  randomToken,
  sha256,
} from "~/lib/crypto";
import { addDaysIso, nowIso } from "~/lib/time";

import {
  clearLoginFailures,
  createInvite,
  createPrivilegedUser,
  createSession,
  createUserDuringOpenRegistration,
  createUserWithInvite,
  deleteSession,
  findCredentialsByUsername,
  findUserBySession,
  listInvites,
  listUsers,
  markLoginFailure,
  updateNonSuperAdminRole,
  updateNonSuperAdminStatus,
  writeAuditLog,
} from "./repository.server";
import { hashPassword, verifyPassword } from "./password.server";
import type { AuthenticatedUser } from "./types";
import {
  getRegistrationAvailability,
  reconcileRegistrationAfterSignup,
} from "~/features/registration/service.server";

export const SESSION_COOKIE_NAME = "mhxy_session";
const SESSION_DAYS = 14;

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export function validateUsername(username: string): string | null {
  if (!/^[a-z0-9_]{4,24}$/.test(username)) {
    return "用户名需为 4–24 位小写字母、数字或下划线";
  }
  return null;
}

export function validateDisplayName(displayName: string): string | null {
  if (displayName.length < 2 || displayName.length > 24) {
    return "显示名称需为 2–24 个字符";
  }
  return null;
}

export async function registerUser(
  db: D1Database,
  input: {
    username: string;
    displayName: string;
    password: string;
    inviteCode?: string;
  },
): Promise<string> {
  const username = normalizeUsername(input.username);
  const usernameError = validateUsername(username);
  const displayNameError = validateDisplayName(input.displayName);
  if (usernameError || displayNameError) {
    throw new Error(usernameError ?? displayNameError ?? "注册信息无效");
  }

  const password = await hashPassword(input.password);
  const now = nowIso();
  const availability = await getRegistrationAvailability(db);
  const inviteCode = input.inviteCode?.trim() ?? "";
  if (availability.mode === "invite_only") {
    if (!inviteCode) {
      throw new Error("当前仅接受邀请码注册");
    }
    await createUserWithInvite(db, {
      id: createId(),
      username,
      displayName: input.displayName,
      passwordHash: password.hash,
      passwordSalt: password.salt,
      passwordIterations: password.iterations,
      inviteHash: await sha256(inviteCode),
      now,
    });
    await reconcileRegistrationAfterSignup(db, false);
    return username;
  }

  const ignoreThreshold =
    availability.reason === "schedule" && !availability.thresholdGuard;
  const created = await createUserDuringOpenRegistration(db, {
    id: createId(),
    username,
    displayName: input.displayName,
    passwordHash: password.hash,
    passwordSalt: password.salt,
    passwordIterations: password.iterations,
    ignoreThreshold,
    now,
  });
  if (!created) {
    throw new Error("开放注册刚刚达到人数阈值，请使用邀请码注册");
  }
  await reconcileRegistrationAfterSignup(db, ignoreThreshold);
  return username;
}

export async function login(
  db: D1Database,
  usernameInput: string,
  password: string,
): Promise<{ token: string; user: AuthenticatedUser }> {
  const username = normalizeUsername(usernameInput);
  const credentials = await findCredentialsByUsername(db, username);
  const now = nowIso();
  if (!credentials || credentials.status !== "active") {
    throw new Error("用户名或密码错误");
  }
  if (credentials.locked_until && credentials.locked_until > now) {
    throw new Error("登录失败次数过多，请稍后重试");
  }

  const valid = await verifyPassword(
    password,
    credentials.password_hash,
    credentials.password_salt,
    credentials.password_iterations,
  );
  if (!valid) {
    const failures = credentials.failed_login_count + 1;
    const lockedUntil =
      failures >= 5 ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null;
    await markLoginFailure(db, credentials.id, failures, lockedUntil, now);
    throw new Error("用户名或密码错误");
  }

  await clearLoginFailures(db, credentials.id, now);
  const token = randomToken();
  const tokenHash = await sha256(token);
  await createSession(db, {
    tokenHash,
    userId: credentials.id,
    expiresAt: addDaysIso(SESSION_DAYS),
    now,
  });

  const user = await findUserBySession(db, tokenHash, now);
  if (!user) {
    throw new Error("会话创建失败");
  }
  return { token, user };
}

function parseCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) {
      return decodeURIComponent(rest.join("="));
    }
  }
  return null;
}

export function sessionCookie(token: string, secure: boolean): string {
  return [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    `Max-Age=${SESSION_DAYS * 24 * 60 * 60}`,
    "HttpOnly",
    "SameSite=Lax",
    secure ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

export function expiredSessionCookie(secure: boolean): string {
  return [
    `${SESSION_COOKIE_NAME}=`,
    "Path=/",
    "Max-Age=0",
    "HttpOnly",
    "SameSite=Lax",
    secure ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

export async function getCurrentUser(
  db: D1Database,
  request: Request,
): Promise<AuthenticatedUser | null> {
  const token = parseCookie(
    request.headers.get("Cookie"),
    SESSION_COOKIE_NAME,
  );
  if (!token) return null;
  return findUserBySession(db, await sha256(token), nowIso());
}

export async function logout(db: D1Database, request: Request): Promise<void> {
  const token = parseCookie(
    request.headers.get("Cookie"),
    SESSION_COOKIE_NAME,
  );
  if (token) {
    await deleteSession(db, await sha256(token));
  }
}

export async function requireUser(
  db: D1Database,
  request: Request,
): Promise<AuthenticatedUser> {
  const user = await getCurrentUser(db, request);
  if (!user) {
    throw new Response("请先登录", {
      status: 302,
      headers: { Location: `/login?next=${encodeURIComponent(new URL(request.url).pathname)}` },
    });
  }
  return user;
}

export async function requireAdmin(
  db: D1Database,
  request: Request,
): Promise<AuthenticatedUser> {
  const user = await requireUser(db, request);
  if (user.role !== "admin" && user.role !== "super_admin") {
    throw new Response("无权访问", { status: 403 });
  }
  return user;
}

export async function requireSuperAdmin(
  db: D1Database,
  request: Request,
): Promise<AuthenticatedUser> {
  const user = await requireUser(db, request);
  if (user.role !== "super_admin") {
    throw new Response("此操作仅限超管", { status: 403 });
  }
  return user;
}

export async function issueInvite(
  db: D1Database,
  input: {
    label: string;
    createdBy: string;
    maxUses: number;
    expiresInDays: number | null;
  },
): Promise<string> {
  const code = `MHXY-${randomToken(18)}`;
  await createInvite(db, {
    codeHash: await sha256(code),
    label: input.label,
    createdBy: input.createdBy,
    maxUses: input.maxUses,
    expiresAt:
      input.expiresInDays === null ? null : addDaysIso(input.expiresInDays),
    now: nowIso(),
  });
  return code;
}

export { listInvites };

export async function bootstrapSuperAdmin(
  env: CloudflareEnvironment,
  input: {
    bootstrapToken: string;
    username: string;
    displayName: string;
    password: string;
  },
): Promise<void> {
  if (!env.BOOTSTRAP_TOKEN) {
    throw new Error("服务器尚未配置 BOOTSTRAP_TOKEN");
  }
  const [actualTokenHash, expectedTokenHash] = await Promise.all([
    sha256(input.bootstrapToken),
    sha256(env.BOOTSTRAP_TOKEN),
  ]);
  if (
    !constantTimeEqual(
      base64ToBytes(actualTokenHash),
      base64ToBytes(expectedTokenHash),
    )
  ) {
    throw new Error("初始化密钥无效");
  }

  const username = normalizeUsername(input.username);
  const usernameError = validateUsername(username);
  const displayNameError = validateDisplayName(input.displayName);
  if (usernameError || displayNameError) {
    throw new Error(usernameError ?? displayNameError ?? "初始化信息无效");
  }

  const password = await hashPassword(input.password);
  const now = nowIso();
  const userId = createId();
  const created = await createPrivilegedUser(env.DB, {
    id: userId,
    username,
    displayName: input.displayName,
    passwordHash: password.hash,
    passwordSalt: password.salt,
    passwordIterations: password.iterations,
    role: "super_admin",
    now,
  });
  if (!created) {
    throw new Error("站点已经完成初始化");
  }

  await writeAuditLog(env.DB, {
    id: createId(),
    actorId: userId,
    action: "system.bootstrap_super_admin",
    targetType: "user",
    targetId: userId,
    details: { username },
    now,
  });
}

export async function changeUserRole(
  db: D1Database,
  actor: AuthenticatedUser,
  targetUserId: string,
  role: "member" | "admin",
): Promise<void> {
  if (actor.role !== "super_admin") {
    throw new Error("此操作仅限超管");
  }
  const now = nowIso();
  const changed = await updateNonSuperAdminRole(db, targetUserId, role, now);
  if (!changed) {
    throw new Error("目标用户不存在或不能变更");
  }
  await writeAuditLog(db, {
    id: createId(),
    actorId: actor.id,
    action: "user.role_changed",
    targetType: "user",
    targetId: targetUserId,
    details: { role },
    now,
  });
}

export async function changeUserStatus(
  db: D1Database,
  actor: AuthenticatedUser,
  targetUserId: string,
  status: "active" | "disabled",
): Promise<void> {
  if (actor.role !== "super_admin") {
    throw new Error("此操作仅限超管");
  }
  const now = nowIso();
  const changed = await updateNonSuperAdminStatus(
    db,
    targetUserId,
    status,
    now,
  );
  if (!changed) {
    throw new Error("目标用户不存在或不能变更");
  }
  await writeAuditLog(db, {
    id: createId(),
    actorId: actor.id,
    action: "user.status_changed",
    targetType: "user",
    targetId: targetUserId,
    details: { status },
    now,
  });
}

export { listUsers };
