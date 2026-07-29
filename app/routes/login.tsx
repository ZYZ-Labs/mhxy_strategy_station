import { Form, redirect, useNavigation } from "react-router";

import { getCurrentUser, login, sessionCookie } from "~/features/auth/service.server";
import { getCloudflare } from "~/lib/cloudflare.server";
import { errorMessage, text } from "~/lib/forms.server";

import type { Route } from "./+types/login";

export function meta() {
  return [{ title: "登录｜梦幻策略站" }];
}

function safeNext(request: Request): string {
  const next = new URL(request.url).searchParams.get("next");
  return next?.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = getCloudflare(context);
  if (await getCurrentUser(env.DB, request)) return redirect("/dashboard");
  return {};
}

export async function action({ request, context }: Route.ActionArgs) {
  const { env } = getCloudflare(context);
  const form = await request.formData();
  try {
    const result = await login(env.DB, text(form, "username"), text(form, "password"));
    return redirect(safeNext(request), {
      headers: { "Set-Cookie": sessionCookie(result.token, new URL(request.url).protocol === "https:") },
    });
  } catch (error) {
    return { error: errorMessage(error) };
  }
}

export default function Login({ actionData }: Route.ComponentProps) {
  const busy = useNavigation().state === "submitting";
  return (
    <section className="auth-shell"><div className="auth-card">
      <p className="eyebrow">WELCOME BACK</p><h1>登录</h1>
      <p>登录后可维护自己的攻略草稿和查看审核状态。</p>
      <Form method="post" className="form-stack">
        {actionData?.error ? <p className="form-error">{actionData.error}</p> : null}
        <label><span>用户名</span><input autoComplete="username" name="username" required /></label>
        <label><span>密码</span><input autoComplete="current-password" name="password" type="password" required /></label>
        <button className="button button-primary" disabled={busy} type="submit">{busy ? "正在登录…" : "登录"}</button>
      </Form>
    </div></section>
  );
}
