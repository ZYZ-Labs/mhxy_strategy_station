import type {
  RegistrationMode,
  RegistrationSchedule,
  RegistrationSettings,
  ScheduleType,
} from "./types";

export async function countNonSuperUsers(db: D1Database): Promise<number> {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS count
       FROM users
       WHERE role <> 'super_admin'`,
    )
    .first<{ count: number }>();
  return row?.count ?? 0;
}

export async function getRegistrationSettings(
  db: D1Database,
): Promise<RegistrationSettings> {
  const row = await db
    .prepare(
      `SELECT manual_mode, threshold_step, next_threshold, threshold_locked,
              timezone, updated_at
       FROM registration_settings
       WHERE id = 'global'`,
    )
    .first<{
      manual_mode: RegistrationMode;
      threshold_step: number;
      next_threshold: number;
      threshold_locked: number;
      timezone: string;
      updated_at: string;
    }>();
  if (!row) {
    throw new Error("注册策略尚未初始化");
  }
  return {
    manualMode: row.manual_mode,
    thresholdStep: row.threshold_step,
    nextThreshold: row.next_threshold,
    thresholdLocked: row.threshold_locked === 1,
    timezone: row.timezone,
    updatedAt: row.updated_at,
  };
}

export async function listRegistrationSchedules(
  db: D1Database,
  enabledOnly = false,
): Promise<RegistrationSchedule[]> {
  const result = await db
    .prepare(
      `SELECT id, name, schedule_type, starts_at, ends_at, weekdays_json,
              local_start_time, local_end_time, threshold_guard, enabled,
              created_at, updated_at
       FROM registration_schedules
       ${enabledOnly ? "WHERE enabled = 1" : ""}
       ORDER BY enabled DESC, created_at DESC`,
    )
    .all<{
      id: string;
      name: string;
      schedule_type: ScheduleType;
      starts_at: string | null;
      ends_at: string | null;
      weekdays_json: string | null;
      local_start_time: string | null;
      local_end_time: string | null;
      threshold_guard: number;
      enabled: number;
      created_at: string;
      updated_at: string;
    }>();
  return result.results.map((row) => {
    let weekdays: number[] = [];
    try {
      const parsed: unknown = JSON.parse(row.weekdays_json ?? "[]");
      if (Array.isArray(parsed)) {
        weekdays = parsed.filter(
          (day): day is number =>
            typeof day === "number" && Number.isInteger(day) && day >= 0 && day <= 6,
        );
      }
    } catch {
      weekdays = [];
    }
    return {
      id: row.id,
      name: row.name,
      scheduleType: row.schedule_type,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      weekdays,
      localStartTime: row.local_start_time,
      localEndTime: row.local_end_time,
      thresholdGuard: row.threshold_guard === 1,
      enabled: row.enabled === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  });
}

export async function lockAtThreshold(
  db: D1Database,
  input: {
    nextThreshold: number;
    count: number;
    crossed: number[];
    eventId: string;
    now: string;
  },
): Promise<void> {
  await db.batch([
    db
      .prepare(
        `UPDATE registration_settings
         SET manual_mode = 'invite_only',
             threshold_locked = 1,
             next_threshold = ?1,
             updated_at = ?2
         WHERE id = 'global'`,
      )
      .bind(input.nextThreshold, input.now),
    db
      .prepare(
        `INSERT INTO registration_events (
           id, event_type, actor_id, non_super_user_count, details_json, created_at
         ) VALUES (?1, 'threshold_reached', NULL, ?2, ?3, ?4)`,
      )
      .bind(
        input.eventId,
        input.count,
        JSON.stringify({
          crossedThresholds: input.crossed,
          nextThreshold: input.nextThreshold,
        }),
        input.now,
      ),
  ]);
}

export async function updateRegistrationSettings(
  db: D1Database,
  input: {
    manualMode: RegistrationMode;
    thresholdStep: number;
    nextThreshold: number;
    thresholdLocked: boolean;
    actorId: string;
    eventId: string;
    count: number;
    now: string;
  },
): Promise<void> {
  await db.batch([
    db
      .prepare(
        `UPDATE registration_settings
         SET manual_mode = ?1, threshold_step = ?2, next_threshold = ?3,
             threshold_locked = ?4, updated_by = ?5, updated_at = ?6
         WHERE id = 'global'`,
      )
      .bind(
        input.manualMode,
        input.thresholdStep,
        input.nextThreshold,
        input.thresholdLocked ? 1 : 0,
        input.actorId,
        input.now,
      ),
    db
      .prepare(
        `INSERT INTO registration_events (
           id, event_type, actor_id, non_super_user_count, details_json, created_at
         ) VALUES (?1, 'settings_changed', ?2, ?3, ?4, ?5)`,
      )
      .bind(
        input.eventId,
        input.actorId,
        input.count,
        JSON.stringify({
          manualMode: input.manualMode,
          thresholdStep: input.thresholdStep,
          nextThreshold: input.nextThreshold,
          thresholdLocked: input.thresholdLocked,
        }),
        input.now,
      ),
  ]);
}

export async function insertRegistrationSchedule(
  db: D1Database,
  input: RegistrationSchedule & { createdBy: string },
): Promise<void> {
  await db.batch([
    db.prepare(
      `INSERT INTO registration_schedules (
         id, name, schedule_type, starts_at, ends_at, weekdays_json,
         local_start_time, local_end_time, threshold_guard, enabled,
         created_by, created_at, updated_at
       ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)`,
    ).bind(
      input.id,
      input.name,
      input.scheduleType,
      input.startsAt,
      input.endsAt,
      input.scheduleType === "weekly" ? JSON.stringify(input.weekdays) : null,
      input.localStartTime,
      input.localEndTime,
      input.thresholdGuard ? 1 : 0,
      input.enabled ? 1 : 0,
      input.createdBy,
      input.createdAt,
      input.updatedAt,
    ),
    db.prepare(
      `INSERT INTO registration_events (
         id, event_type, actor_id, non_super_user_count, details_json, created_at
       ) VALUES (
         ?1, 'schedule_created', ?2,
         (SELECT COUNT(*) FROM users WHERE role <> 'super_admin'),
         ?3, ?4
       )`,
    ).bind(
      crypto.randomUUID(),
      input.createdBy,
      JSON.stringify({
        scheduleId: input.id,
        scheduleType: input.scheduleType,
        thresholdGuard: input.thresholdGuard,
      }),
      input.createdAt,
    ),
  ]);
}

export async function setRegistrationScheduleEnabled(
  db: D1Database,
  scheduleId: string,
  enabled: boolean,
  actorId: string,
  now: string,
): Promise<boolean> {
  const result = await db.batch([
    db.prepare(
      `UPDATE registration_schedules
       SET enabled = ?2, updated_at = ?3
       WHERE id = ?1`,
    ).bind(scheduleId, enabled ? 1 : 0, now),
    db.prepare(
      `INSERT INTO registration_events (
         id, event_type, actor_id, non_super_user_count, details_json, created_at
       )
       SELECT ?1, 'schedule_toggled', ?2,
              (SELECT COUNT(*) FROM users WHERE role <> 'super_admin'),
              ?3, ?4
       WHERE EXISTS (SELECT 1 FROM registration_schedules WHERE id = ?5)`,
    ).bind(
      crypto.randomUUID(),
      actorId,
      JSON.stringify({ scheduleId, enabled }),
      now,
      scheduleId,
    ),
  ]);
  return result[0].meta.changes === 1;
}
