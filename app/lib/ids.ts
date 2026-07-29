export function createId(): string {
  return crypto.randomUUID();
}

export function createGuideSlug(): string {
  return `guide-${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
}
