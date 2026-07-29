import { Form, useNavigation } from "react-router";

import { issueInvite, listInvites, requireAdmin } from "~/features/auth/service.server";
import { getCloudflare } from "~/lib/cloudflare.server";
import { errorMessage, text } from "~/lib/forms.server";

import type { Route } from "./+types/admin-invites";

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = getCloudflare(context);
  await requireAdmin(env.DB, request);
  return { invites: await listInvites(env.DB) };
}

export async function action({ request, context }: Route.ActionArgs) {
  const { env } = getCloudflare(context);
  const actor = await requireAdmin(env.DB, request);
  const form = await request.formData();
  const maxUses = Number(text(form, "maxUses"));
  const expiresInDaysValue = text(form, "expiresInDays");
  if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 1000) return { error: "可用次数必须是 1–1000 的整数" };
  try {
    const code = await issueInvite(env.DB, { label: text(form, "label").slice(0, 80), createdBy: actor.id, maxUses, expiresInDays: expiresInDaysValue ? Number(expiresInDaysValue) : null });
    return { success: "邀请码只显示这一次，请立即安全保存。", code };
  } catch (error) {
    return { error: errorMessage(error) };
  }
}

export default function AdminInvites({ loaderData, actionData }: Route.ComponentProps) {
  const busy = useNavigation().state === "submitting";
  return <section className="dashboard-shell"><header className="page-heading"><p className="eyebrow">INVITATIONS</p><h1>邀请码</h1></header>
    <div className="dashboard-grid"><div className="panel"><h2>生成邀请码</h2><Form method="post" className="form-stack">{actionData?.error ? <p className="form-error">{actionData.error}</p> : null}{actionData?.code ? <p className="form-success">{actionData.success}<br /><strong>{actionData.code}</strong></p> : null}<label><span>用途备注</span><input name="label" maxLength={80} /></label><label><span>最大使用次数</span><input name="maxUses" type="number" min={1} max={1000} defaultValue={1} required /></label><label><span>有效天数（留空为长期）</span><input name="expiresInDays" type="number" min={1} max={3650} /></label><button className="button button-primary" disabled={busy} type="submit">生成</button></Form></div>
      <div className="panel"><h2>最近记录</h2>{loaderData.invites.length ? loaderData.invites.map((invite) => <div className="status-row" key={invite.codeHash}><span>{invite.label || "未备注"}</span><span>{invite.useCount}/{invite.maxUses}</span></div>) : <p>暂无邀请码。</p>}</div>
    </div>
  </section>;
}
