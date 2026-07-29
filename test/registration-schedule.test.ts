import { describe, expect, it } from "vitest";

import { isScheduleActive } from "~/features/registration/service.server";
import type { RegistrationSchedule } from "~/features/registration/types";

function weekly(overrides: Partial<RegistrationSchedule> = {}): RegistrationSchedule {
  return {
    id: "weekly-contract",
    name: "每周窗口",
    scheduleType: "weekly",
    startsAt: null,
    endsAt: null,
    weekdays: [1],
    localStartTime: "20:00",
    localEndTime: "22:00",
    thresholdGuard: true,
    enabled: true,
    createdAt: "2026-07-29T00:00:00.000Z",
    updatedAt: "2026-07-29T00:00:00.000Z",
    ...overrides,
  };
}

describe("registration schedules", () => {
  it("evaluates a weekly window in Asia/Shanghai", () => {
    expect(isScheduleActive(weekly(), new Date("2026-08-03T12:30:00.000Z"), "Asia/Shanghai")).toBe(true);
    expect(isScheduleActive(weekly(), new Date("2026-08-03T14:30:00.000Z"), "Asia/Shanghai")).toBe(false);
  });

  it("supports weekly windows crossing midnight", () => {
    const schedule = weekly({ localStartTime: "23:00", localEndTime: "02:00" });
    expect(isScheduleActive(schedule, new Date("2026-08-03T16:30:00.000Z"), "Asia/Shanghai")).toBe(true);
    expect(isScheduleActive(schedule, new Date("2026-08-03T18:30:00.000Z"), "Asia/Shanghai")).toBe(false);
  });

  it("expires one-time windows at the end boundary", () => {
    const schedule = weekly({
      scheduleType: "one_time",
      startsAt: "2026-08-01T00:00:00.000Z",
      endsAt: "2026-08-02T00:00:00.000Z",
    });
    expect(isScheduleActive(schedule, new Date("2026-08-01T12:00:00.000Z"), "Asia/Shanghai")).toBe(true);
    expect(isScheduleActive(schedule, new Date("2026-08-02T00:00:00.000Z"), "Asia/Shanghai")).toBe(false);
  });
});
