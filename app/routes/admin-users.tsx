import { Form } from "react-router";

import {
  changeUserRole,
  changeUserStatus,
  listUsers,
  requireSuperAdmin,
} from "~/features/auth/service.server";
import { getCloudflare } from "~/lib/cloudflare.server";
import { errorMessage, text } from "~/lib/forms.server";

import type { Route } from "./+types/admin-users";

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = getCloudflare(context);
  await requireSuperAdmin(env.DB, request);
  return { users: await listUsers(env.DB) };
}

export async function action({ request, context }: Route.ActionArgs) {
  const { env } = getCloudflare(context);
  const actor = await requireSuperAdmin(env.DB, request);
  const form = await request.formData();
  const userId = text(form, "userId");
  const intent = text(form, "intent");
  try {
    if (intent === "grant_admin") await changeUserRole(env.DB, actor, userId, "admin");
    else if (intent === "revoke_admin") await changeUserRole(env.DB, actor, userId, "member");
    else if (intent === "disable") await changeUserStatus(env.DB, actor, userId, "disabled");
    else if (intent === "enable") await changeUserStatus(env.DB, actor, userId, "active");
    else return { error: "操作类型无效" };
    return { success: "用户权限已更新" };
  } catch (error) {
    return { error: errorMessage(error) };
  }
}

export default function AdminUsers({ loaderData, actionData }: Route.ComponentProps) {
  return <section className="dashboard-shell"><header className="page-heading"><p className="eyebrow">SUPER ADMIN ONLY</p><h1>用户与管理员权限</h1><p>超管唯一且不可在此降级或停用；普通管理员无权访问本页。</p></header>
    {actionData?.error ? <p className="form-error">{actionData.error}</p> : null}{actionData?.success ? <p className="form-success">{actionData.success}</p> : null}
    <div className="review-list">{loaderData.users.map((user) => <article className="review-card" key={user.id}>
      <div className="status-row"><div><strong>{user.displayName}</strong> <span>@{user.username}</span></div><span className="status-badge" data-status={user.status}>{user.role} · {user.status}</span></div>
      {user.role !== "super_admin" ? <Form method="post" className="page-actions"><input type="hidden" name="userId" value={user.id} />
        {user.role === "admin" ? <button className="button button-small" name="intent" value="revoke_admin" type="submit">撤销管理员</button> : <button className="button button-small" name="intent" value="grant_admin" type="submit">赋予管理员</button>}
        {user.status === "active" ? <button className="button button-danger button-small" name="intent" value="disable" type="submit">停用</button> : <button className="button button-small" name="intent" value="enable" type="submit">恢复</button>}
      </Form> : null}
    </article>)}</div>
  </section>;
}
