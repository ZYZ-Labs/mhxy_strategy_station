import { redirect } from "react-router";

import { GuideForm } from "~/components/guide-form";
import { requireUser } from "~/features/auth/service.server";
import { listCategories } from "~/features/content/repository.server";
import { createDraft } from "~/features/content/service.server";
import { getCloudflare } from "~/lib/cloudflare.server";
import { errorMessage, guideFormInput } from "~/lib/forms.server";

import type { Route } from "./+types/draft-new";

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = getCloudflare(context);
  await requireUser(env.DB, request);
  return { categories: await listCategories(env.DB) };
}

export async function action({ request, context }: Route.ActionArgs) {
  const { env } = getCloudflare(context);
  const user = await requireUser(env.DB, request);
  try {
    const entryId = await createDraft(env.DB, user.id, guideFormInput(await request.formData()));
    return redirect(`/dashboard/guides/${entryId}/edit`);
  } catch (error) {
    return { error: errorMessage(error) };
  }
}

export default function DraftNew({ loaderData, actionData }: Route.ComponentProps) {
  return <section className="dashboard-shell"><header className="page-heading"><p className="eyebrow">NEW GUIDE</p><h1>新建纯文本攻略</h1></header><div className="panel"><GuideForm categories={loaderData.categories} error={actionData?.error} /></div></section>;
}
