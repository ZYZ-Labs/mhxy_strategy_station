import { Form, redirect, useNavigation } from "react-router";

import { hasAnyUsers } from "~/features/auth/repository.server";
import { bootstrapSuperAdmin } from "~/features/auth/service.server";
import { getCloudflare } from "~/lib/cloudflare.server";
import { errorMessage, text } from "~/lib/forms.server";

import type { Route } from "./+types/setup";

export function meta() {
  return [{ title: "初始化站点｜梦幻策略站" }];
}

export async function loader({ context }: Route.LoaderArgs) {
  const { env } = getCloudflare(context);
  return { initialized: await hasAnyUsers(env.DB) };
}

export async function action({ request, context }: Route.ActionArgs) {
  const { env } = getCloudflare(context);
  const form = await request.formData();
  try {
    await bootstrapSuperAdmin(env, {
      bootstrapToken: text(form, "bootstrapToken"),
      username: text(form, "username"),
      displayName: text(form, "displayName"),
      password: text(form, "password"),
    });
    return redirect("/login?setup=1");
  } catch (error) {
    return { error: errorMessage(error) };
  }
}

export default function Setup({ loaderData, actionData }: Route.ComponentProps) {
  const busy = useNavigation().state === "submitting";
  if (loaderData.initialized) {
    return <section className="auth-shell"><div className="auth-card"><p className="eyebrow">INITIALIZED</p><h1>站点已完成初始化</h1><p>唯一超管已经存在，此入口不能再创建用户。</p></div></section>;
  }
  return (
    <section className="auth-shell"><div className="auth-card">
      <p className="eyebrow">SECURE BOOTSTRAP</p><h1>创建唯一超管</h1>
      <p>仅在数据库没有任何用户时有效，并且必须提供 Worker Secret 中配置的初始化密钥。</p>
      <Form method="post" className="form-stack">
        {actionData?.error ? <p className="form-error">{actionData.error}</p> : null}
        <label><span>初始化密钥</span><input name="bootstrapToken" type="password" required /></label>
        <label><span>用户名</span><input name="username" pattern="[a-z0-9_]{4,24}" required /></label>
        <label><span>显示名称</span><input name="displayName" minLength={2} maxLength={24} required /></label>
        <label><span>密码</span><input autoComplete="new-password" name="password" type="password" minLength={12} maxLength={128} required /></label>
        <button className="button button-primary" type="submit" disabled={busy}>{busy ? "正在初始化…" : "创建唯一超管"}</button>
      </Form>
    </div></section>
  );
}
