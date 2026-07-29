import { parseTags } from "~/features/content/validation";

export function text(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export function checked(form: FormData, name: string): boolean {
  return form.get(name) === "on" || form.get(name) === "true";
}

export function guideFormInput(form: FormData) {
  return {
    title: text(form, "title"),
    summary: text(form, "summary"),
    body: text(form, "body"),
    categoryId: text(form, "categoryId") || null,
    tags: parseTags(text(form, "tags")),
  };
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "操作失败，请稍后重试";
}
