import { redirect } from "react-router";

import { GuideForm } from "~/components/guide-form";
import { requireUser } from "~/features/auth/service.server";
import { listCategories } from "~/features/content/repository.server";
import { ensureEditableDraft, updateDraft } from "~/features/content/service.server";
import { getCloudflare } from "~/lib/cloudflare.server";
import { errorMessage, guideFormInput } from "~/lib/forms.server";

import type { Route } from "./+types/draft-edit";

export async function loader({ request, context, params }: Route.LoaderArgs) {
  const { env } = getCloudflare(context);
  const user = await requireUser(env.DB, request);
  return {
    draft: await ensureEditableDraft(env.DB, params.entryId, user.id),
    categories: await listCategories(env.DB),
  };
}

export async function action({ request, context, params }: Route.ActionArgs) {
  const { env } = getCloudflare(context);
  const user = await requireUser(env.DB, request);
  const draft = await ensureEditableDraft(env.DB, params.entryId, user.id);
  try {
    await updateDraft(env.DB, draft.revisionId, user.id, guideFormInput(await request.formData()));
    return redirect("/dashboard");
  } catch (error) {
    return { error: errorMessage(error) };
  }
}

export default function DraftEdit({ loaderData, actionData }: Route.ComponentProps) {
  const editable = loaderData.draft.status === "draft";
  return <section className="dashboard-shell"><header className="page-heading"><p className="eyebrow">REVISION {loaderData.draft.revisionNo}</p><h1>编辑攻略</h1></header><div className="panel">{editable ? <GuideForm categories={loaderData.categories} draft={loaderData.draft} error={actionData?.error} /> : <p className="form-error">当前版本正在审核，暂时不能修改。</p>}</div></section>;
}
