import { createId } from "~/lib/ids";
import { nowIso } from "~/lib/time";
import { writeAuditLog } from "~/features/auth/repository.server";

import {
  countNonSuperUsers,
  getRegistrationSettings,
  insertRegistrationSchedule,
  listRegistrationSchedules,
  lockAtThreshold,
  setRegistrationScheduleEnabled,
  updateRegistrationSettings,
} from "./repository.server";
import type {
  RegistrationAvailability,
  RegistrationMode,
  RegistrationSchedule,
} from "./types";

const weekdayIndexes: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function zonedClock(date: Date, timeZone: string): {
  weekday: number;
  minutes: number;
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    weekday: weekdayIndexes[values.weekday ?? "Sun"] ?? 0,
    minutes: Number(values.hour ?? 0) * 60 + Number(values.minute ?? 0),
  };
}

function timeToMinutes(value: string): number {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/u.exec(value);
  if (!match) throw new Error("时间必须使用 HH:mm 格式");
  return Number(match[1]) * 60 + Number(match[2]);
}

function shanghaiLocalDateTimeToIso(value: string): string {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d)$/u.exec(value);
  if (!match) {
    throw new Error("日期时间格式无效");
  }
  const parsed = new Date(`${value}:00+08:00`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("日期时间无效");
  }
  return parsed.toISOString();
}

export function isScheduleActive(
  schedule: RegistrationSchedule,
  date: Date,
  timeZone: string,
): boolean {
  if (!schedule.enabled) return false;
  if (schedule.scheduleType === "one_time") {
    if (!schedule.startsAt || !schedule.endsAt) return false;
    const timestamp = date.getTime();
    return (
      timestamp >= new Date(schedule.startsAt).getTime() &&
      timestamp < new Date(schedule.endsAt).getTime()
    );
  }

  if (!schedule.localStartTime || !schedule.localEndTime) return false;
  const { weekday, minutes } = zonedClock(date, timeZone);
  const start = timeToMinutes(schedule.localStartTime);
  const end = timeToMinutes(schedule.localEndTime);
  if (start === end) {
    return schedule.weekdays.includes(weekday);
  }
  if (start < end) {
    return (
      schedule.weekdays.includes(weekday) && minutes >= start && minutes < end
    );
  }
  const previousDay = (weekday + 6) % 7;
  return (
    (schedule.weekdays.includes(weekday) && minutes >= start) ||
    (schedule.weekdays.includes(previousDay) && minutes < end)
  );
}

async function reconcileThreshold(
  db: D1Database,
  count: number,
): Promise<void> {
  const settings = await getRegistrationSettings(db);
  if (count < settings.nextThreshold) return;

  const crossed: number[] = [];
  let nextThreshold = settings.nextThreshold;
  while (count >= nextThreshold) {
    crossed.push(nextThreshold);
    nextThreshold += settings.thresholdStep;
  }
  await lockAtThreshold(db, {
    nextThreshold,
    count,
    crossed,
    eventId: createId(),
    now: nowIso(),
  });
}

export async function getRegistrationAvailability(
  db: D1Database,
  date = new Date(),
): Promise<RegistrationAvailability> {
  let settings = await getRegistrationSettings(db);
  const count = await countNonSuperUsers(db);
  const schedules = await listRegistrationSchedules(db, true);
  const activeSchedules = schedules.filter((schedule) =>
    isScheduleActive(schedule, date, settings.timezone),
  );
  const unguardedSchedule = activeSchedules.find(
    (schedule) => !schedule.thresholdGuard,
  );

  if (unguardedSchedule) {
    return {
      mode: "open",
      reason: "schedule",
      nonSuperUserCount: count,
      nextThreshold: settings.nextThreshold,
      thresholdStep: settings.thresholdStep,
      activeSchedule: unguardedSchedule,
      thresholdGuard: false,
    };
  }

  await reconcileThreshold(db, count);
  settings = await getRegistrationSettings(db);
  const guardedSchedule = activeSchedules[0] ?? null;
  if (guardedSchedule && !settings.thresholdLocked) {
    return {
      mode: "open",
      reason: "schedule",
      nonSuperUserCount: count,
      nextThreshold: settings.nextThreshold,
      thresholdStep: settings.thresholdStep,
      activeSchedule: guardedSchedule,
      thresholdGuard: true,
    };
  }

  const open =
    settings.manualMode === "open" && !settings.thresholdLocked;
  return {
    mode: open ? "open" : "invite_only",
    reason: settings.thresholdLocked
      ? "threshold"
      : open
        ? "manual_open"
        : "manual_closed",
    nonSuperUserCount: count,
    nextThreshold: settings.nextThreshold,
    thresholdStep: settings.thresholdStep,
    activeSchedule: guardedSchedule,
    thresholdGuard: true,
  };
}

export async function reconcileRegistrationAfterSignup(
  db: D1Database,
  ignoredThreshold: boolean,
): Promise<void> {
  if (ignoredThreshold) return;
  await reconcileThreshold(db, await countNonSuperUsers(db));
}

export async function changeRegistrationSettings(
  db: D1Database,
  input: {
    actorId: string;
    manualMode: RegistrationMode;
    thresholdStep: number;
  },
): Promise<void> {
  if (
    !Number.isInteger(input.thresholdStep) ||
    input.thresholdStep < 10 ||
    input.thresholdStep > 100_000
  ) {
    throw new Error("阈值步长必须是 10–100000 之间的整数");
  }
  const count = await countNonSuperUsers(db);
  const nextThreshold =
    (Math.floor(count / input.thresholdStep) + 1) * input.thresholdStep;
  await updateRegistrationSettings(db, {
    manualMode: input.manualMode,
    thresholdStep: input.thresholdStep,
    nextThreshold,
    thresholdLocked: false,
    actorId: input.actorId,
    eventId: createId(),
    count,
    now: nowIso(),
  });
  await writeAuditLog(db, {
    id: createId(),
    actorId: input.actorId,
    action: "registration.settings_changed",
    targetType: "registration_settings",
    targetId: "global",
    details: {
      manualMode: input.manualMode,
      thresholdStep: input.thresholdStep,
      nextThreshold,
    },
    now: nowIso(),
  });
}

export async function createRegistrationSchedule(
  db: D1Database,
  input: {
    actorId: string;
    name: string;
    scheduleType: "one_time" | "weekly";
    startsAt?: string;
    endsAt?: string;
    weekdays?: number[];
    localStartTime?: string;
    localEndTime?: string;
    thresholdGuard: boolean;
  },
): Promise<void> {
  const name = input.name.trim();
  if (name.length < 2 || name.length > 50) {
    throw new Error("计划名称需为 2–50 个字符");
  }
  const now = nowIso();
  const scheduleId = createId();
  if (input.scheduleType === "one_time") {
    if (!input.startsAt || !input.endsAt) {
      throw new Error("一次性窗口需要开始和结束时间");
    }
    const startsAt = shanghaiLocalDateTimeToIso(input.startsAt);
    const endsAt = shanghaiLocalDateTimeToIso(input.endsAt);
    if (startsAt >= endsAt) {
      throw new Error("结束时间必须晚于开始时间");
    }
    await insertRegistrationSchedule(db, {
      id: scheduleId,
      name,
      scheduleType: "one_time",
      startsAt,
      endsAt,
      weekdays: [],
      localStartTime: null,
      localEndTime: null,
      thresholdGuard: input.thresholdGuard,
      enabled: true,
      createdAt: now,
      updatedAt: now,
      createdBy: input.actorId,
    });
    await writeAuditLog(db, {
      id: createId(),
      actorId: input.actorId,
      action: "registration.schedule_created",
      targetType: "registration_schedule",
      targetId: scheduleId,
      details: { scheduleType: "one_time", thresholdGuard: input.thresholdGuard },
      now,
    });
    return;
  }

  const weekdays = [...new Set(input.weekdays ?? [])].sort();
  if (
    weekdays.length === 0 ||
    weekdays.some((day) => !Number.isInteger(day) || day < 0 || day > 6)
  ) {
    throw new Error("每周计划至少选择一个有效星期");
  }
  if (!input.localStartTime || !input.localEndTime) {
    throw new Error("每周计划需要开始和结束时间");
  }
  timeToMinutes(input.localStartTime);
  timeToMinutes(input.localEndTime);
  await insertRegistrationSchedule(db, {
    id: scheduleId,
    name,
    scheduleType: "weekly",
    startsAt: null,
    endsAt: null,
    weekdays,
    localStartTime: input.localStartTime,
    localEndTime: input.localEndTime,
    thresholdGuard: input.thresholdGuard,
    enabled: true,
    createdAt: now,
    updatedAt: now,
    createdBy: input.actorId,
  });
  await writeAuditLog(db, {
    id: createId(),
    actorId: input.actorId,
    action: "registration.schedule_created",
    targetType: "registration_schedule",
    targetId: scheduleId,
    details: { scheduleType: "weekly", thresholdGuard: input.thresholdGuard },
    now,
  });
}

export async function toggleRegistrationSchedule(
  db: D1Database,
  scheduleId: string,
  enabled: boolean,
  actorId: string,
): Promise<void> {
  const changed = await setRegistrationScheduleEnabled(
    db,
    scheduleId,
    enabled,
    actorId,
    nowIso(),
  );
  if (!changed) throw new Error("定时计划不存在");
  await writeAuditLog(db, {
    id: createId(),
    actorId,
    action: "registration.schedule_toggled",
    targetType: "registration_schedule",
    targetId: scheduleId,
    details: { enabled },
    now: nowIso(),
  });
}
