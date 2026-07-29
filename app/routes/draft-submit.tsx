import { Form, redirect, useNavigation } from "react-router";

import { ProhibitedNotice } from "~/components/prohibited-notice";
import { requireUser } from "~/features/auth/service.server";
import { ensureEditableDraft, submitDraft } from "~/features/content/service.server";
import { getCloudflare } from "~/lib/cloudflare.server";
import { errorMessage } from "~/lib/forms.server";

import type { Route } from "./+types/draft-submit";

export async function loader({ request, context, params }: Route.LoaderArgs) {
  const { env } = getCloudflare(context);
  const user = await requireUser(env.DB, request);
  return { draft: await ensureEditableDraft(env.DB, params.entryId, user.id) };
}

export async function action({ request, context, params }: Route.ActionArgs) {
  const { env } = getCloudflare(context);
  const user = await requireUser(env.DB, request);
  const revision = await ensureEditableDraft(env.DB, params.entryId, user.id);
  if (revision.status !== "draft") return { error: "当前版本不能提交" };
  try {
    await submitDraft(env.DB, revision, user.id);
    return redirect("/dashboard");
  } catch (error) {
    return { error: errorMessage(error) };
  }
}

export default function DraftSubmit({ loaderData, actionData }: Route.ComponentProps) {
  const busy = useNavigation().state === "submitting";
  return <section className="dashboard-shell"><header className="page-heading"><p className="eyebrow">FINAL CHECK</p><h1>提交人工审核</h1><p>{loaderData.draft.title}</p></header>
    <ProhibitedNotice compact />
    <div className="panel">{actionData?.error ? <p className="form-error">{actionData.error}</p> : null}<p>提交后内容先经过规则预审，再进入管理员人工审核队列；任何规则结果都不会自动发布。</p><Form method="post"><button className="button button-primary" disabled={busy} type="submit">{busy ? "正在预审…" : "确认提交"}</button></Form></div>
  </section>;
}
