import { Form, useNavigation } from "react-router";

import { requireAdmin } from "~/features/auth/service.server";
import { createCategory, listCategories } from "~/features/content/repository.server";
import { createId } from "~/lib/ids";
import { nowIso } from "~/lib/time";
import { getCloudflare } from "~/lib/cloudflare.server";
import { errorMessage, text } from "~/lib/forms.server";

import type { Route } from "./+types/admin-categories";

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = getCloudflare(context);
  await requireAdmin(env.DB, request);
  return { categories: await listCategories(env.DB) };
}

export async function action({ request, context }: Route.ActionArgs) {
  const { env } = getCloudflare(context);
  await requireAdmin(env.DB, request);
  const form = await request.formData();
  const name = text(form, "name");
  const slug = text(form, "slug").toLowerCase();
  if (name.length < 2 || name.length > 30 || !/^[a-z0-9-]{2,40}$/u.test(slug)) {
    return { error: "分类名称需 2–30 字，标识需为 2–40 位小写字母、数字或连字符" };
  }
  try {
    await createCategory(env.DB, { id: createId(), name, slug, description: text(form, "description").slice(0, 200), now: nowIso() });
    return { success: "分类已创建" };
  } catch (error) {
    return { error: errorMessage(error) };
  }
}

export default function AdminCategories({ loaderData, actionData }: Route.ComponentProps) {
  const busy = useNavigation().state === "submitting";
  return <section className="dashboard-shell"><header className="page-heading"><p className="eyebrow">TAXONOMY</p><h1>攻略分类</h1></header>
    <div className="dashboard-grid"><div className="panel"><h2>现有分类</h2>{loaderData.categories.length ? loaderData.categories.map((category) => <div className="status-row" key={category.id}><strong>{category.name}</strong><span>{category.slug}</span></div>) : <p>暂无分类。</p>}</div>
      <div className="panel"><h2>创建分类</h2><Form method="post" className="form-stack">{actionData?.error ? <p className="form-error">{actionData.error}</p> : null}{actionData?.success ? <p className="form-success">{actionData.success}</p> : null}<label><span>名称</span><input name="name" required /></label><label><span>英文标识</span><input name="slug" pattern="[a-z0-9-]{2,40}" required /></label><label><span>说明</span><textarea name="description" maxLength={200} rows={3} /></label><button className="button button-primary" disabled={busy} type="submit">创建</button></Form></div>
    </div>
  </section>;
}
