export function nowIso(): string {
  return new Date().toISOString();
}

export function addDaysIso(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}
