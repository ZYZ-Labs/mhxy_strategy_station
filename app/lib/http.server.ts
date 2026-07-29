export function assertSameOrigin(request: Request): void {
  const url = new URL(request.url);
  const origin = request.headers.get("Origin");
  if (request.headers.get("Sec-Fetch-Site") === "cross-site") {
    throw new Response("请求来源无效", { status: 403 });
  }
  if (origin) {
    try {
      if (new URL(origin).origin !== url.origin) {
        throw new Response("请求来源无效", { status: 403 });
      }
    } catch (error) {
      if (error instanceof Response) throw error;
      throw new Response("请求来源无效", { status: 403 });
    }
  }
}

export function getFormString(
  formData: FormData,
  name: string,
  options: { required?: boolean; maxLength?: number } = {},
): string {
  const value = formData.get(name);
  if (typeof value !== "string") {
    if (options.required) {
      throw new Response(`缺少字段：${name}`, { status: 400 });
    }
    return "";
  }

  const trimmed = value.trim();
  if (options.required && !trimmed) {
    throw new Response(`字段不能为空：${name}`, { status: 400 });
  }
  if (options.maxLength && trimmed.length > options.maxLength) {
    throw new Response(`字段过长：${name}`, { status: 400 });
  }
  return trimmed;
}
