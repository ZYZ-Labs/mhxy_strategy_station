export type RegistrationMode = "open" | "invite_only";
export type ScheduleType = "one_time" | "weekly";

export interface RegistrationSettings {
  manualMode: RegistrationMode;
  thresholdStep: number;
  nextThreshold: number;
  thresholdLocked: boolean;
  timezone: string;
  updatedAt: string;
}

export interface RegistrationSchedule {
  id: string;
  name: string;
  scheduleType: ScheduleType;
  startsAt: string | null;
  endsAt: string | null;
  weekdays: number[];
  localStartTime: string | null;
  localEndTime: string | null;
  thresholdGuard: boolean;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RegistrationAvailability {
  mode: RegistrationMode;
  reason: "manual_open" | "manual_closed" | "threshold" | "schedule";
  nonSuperUserCount: number;
  nextThreshold: number;
  thresholdStep: number;
  activeSchedule: RegistrationSchedule | null;
  thresholdGuard: boolean;
}
