import { Form, redirect, useNavigation } from "react-router";

import { registerUser } from "~/features/auth/service.server";
import { getRegistrationAvailability } from "~/features/registration/service.server";
import { getCloudflare } from "~/lib/cloudflare.server";
import { errorMessage, text } from "~/lib/forms.server";

import type { Route } from "./+types/register";

export function meta() {
  return [{ title: "注册｜梦幻策略站" }];
}

export async function loader({ context }: Route.LoaderArgs) {
  const { env } = getCloudflare(context);
  return { availability: await getRegistrationAvailability(env.DB) };
}

export async function action({ request, context }: Route.ActionArgs) {
  const { env } = getCloudflare(context);
  const form = await request.formData();
  try {
    await registerUser(env.DB, {
      username: text(form, "username"),
      displayName: text(form, "displayName"),
      password: text(form, "password"),
      inviteCode: text(form, "inviteCode"),
    });
    return redirect("/login?registered=1");
  } catch (error) {
    return { error: errorMessage(error) };
  }
}

export default function Register({ loaderData, actionData }: Route.ComponentProps) {
  const busy = useNavigation().state === "submitting";
  const inviteOnly = loaderData.availability.mode === "invite_only";
  return (
    <section className="auth-shell"><div className="auth-card">
      <p className="eyebrow">CREATE ACCOUNT</p><h1>{inviteOnly ? "邀请码注册" : "开放注册"}</h1>
      <p>{inviteOnly ? "当前已达到人数阈值或被超管关闭，需要有效邀请码。" : `当前开放注册；非超管用户达到 ${loaderData.availability.nextThreshold} 人时自动切换为邀请码制。`}</p>
      <Form method="post" className="form-stack">
        {actionData?.error ? <p className="form-error">{actionData.error}</p> : null}
        <label><span>用户名</span><input autoComplete="username" name="username" pattern="[a-z0-9_]{4,24}" required /></label>
        <label><span>显示名称</span><input name="displayName" minLength={2} maxLength={24} required /></label>
        <label><span>密码</span><input autoComplete="new-password" name="password" type="password" minLength={12} maxLength={128} required /></label>
        <label><span>邀请码{inviteOnly ? "" : "（可留空）"}</span><input name="inviteCode" required={inviteOnly} /></label>
        <button className="button button-primary" disabled={busy} type="submit">{busy ? "正在注册…" : "创建账户"}</button>
      </Form>
    </div></section>
  );
}
