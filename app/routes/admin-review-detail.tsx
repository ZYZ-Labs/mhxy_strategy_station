import { Form, redirect, useNavigation } from "react-router";

import { requireAdmin } from "~/features/auth/service.server";
import {
  getReviewItem,
  listAuthorReviewHistory,
} from "~/features/content/repository.server";
import { decideReview } from "~/features/content/service.server";
import {
  MODERATION_CATEGORIES,
  normalizeForModeration,
} from "~/features/moderation/rules";
import { getCloudflare } from "~/lib/cloudflare.server";
import { errorMessage, text } from "~/lib/forms.server";

import type { Route } from "./+types/admin-review-detail";

export async function loader({ request, context, params }: Route.LoaderArgs) {
  const { env } = getCloudflare(context);
  await requireAdmin(env.DB, request);
  const review = await getReviewItem(env.DB, params.revisionId);
  if (!review) throw new Response("审核项不存在", { status: 404 });
  return {
    review,
    history: await listAuthorReviewHistory(
      env.DB,
      review.authorId,
      review.revisionId,
    ),
    normalizedTitle: normalizeForModeration(review.title),
    normalizedBody: normalizeForModeration(review.body),
  };
}

export async function action({ request, context, params }: Route.ActionArgs) {
  const { env } = getCloudflare(context);
  const reviewer = await requireAdmin(env.DB, request);
  const form = await request.formData();
  const decision = text(form, "decision");
  if (decision !== "approve" && decision !== "reject") return { error: "审核决定无效" };
  try {
    await decideReview(env.DB, {
      revisionId: params.revisionId,
      reviewerId: reviewer.id,
      decision,
      categories: form.getAll("category").filter((value): value is string => typeof value === "string"),
      reason: text(form, "reason"),
    });
    return redirect("/admin/reviews");
  } catch (error) {
    return { error: errorMessage(error) };
  }
}

export default function AdminReviewDetail({ loaderData, actionData }: Route.ComponentProps) {
  const { review } = loaderData;
  const busy = useNavigation().state === "submitting";
  return <section className="article-shell">
    <div><header className="article-header"><p className="eyebrow">投稿人：{review.authorName}</p><h1>{review.title}</h1><p className="article-summary">{review.summary}</p></header><div className="article-body"><p>{review.body}</p></div></div>
    <aside className="article-aside"><div className="panel"><h3>规则预审</h3>
      <p><span className="status-badge" data-risk={review.riskLevel}>{review.riskLevel ?? "无结果"}</span></p>
      {review.moderationError ? <p className="form-error">{review.moderationError}</p> : null}
      {review.ruleMatches.length ? review.ruleMatches.map((match, index) => <div className="rule-match" key={`${match.ruleId}-${index}`}><strong>{match.reason}</strong><span>{match.field}：{match.excerpt}</span></div>) : <p>未命中确定性规则。仍须人工阅读全文。</p>}
      {(loaderData.normalizedTitle !== review.title || loaderData.normalizedBody !== review.body) ? <details><summary>查看规范化文本差异</summary><p><strong>标题：</strong>{loaderData.normalizedTitle}</p><p>{loaderData.normalizedBody}</p></details> : null}
      <h3>违规分类</h3>
      <Form method="post" className="form-stack">
        {actionData?.error ? <p className="form-error">{actionData.error}</p> : null}
        <div className="tag-row">{MODERATION_CATEGORIES.map((category) => <label className="tag" key={category.value}><input name="category" type="checkbox" value={category.value} /> {category.label}</label>)}</div>
        <label><span>审核理由（必填）</span><textarea name="reason" minLength={2} rows={4} required /></label>
        <div className="decision-grid">
          <button className="button button-primary" name="decision" value="approve" disabled={busy} type="submit">批准并发布</button>
          <button className="button button-danger" name="decision" value="reject" disabled={busy} type="submit">退回修改</button>
        </div>
      </Form>
      <h3>作者最近审核</h3>
      {loaderData.history.length ? loaderData.history.map((item) => <div className="rule-match" key={`${item.title}-${item.createdAt}`}><strong>{item.decision === "approve" ? "已批准" : "已退回"}：{item.title}</strong><span>{item.reason}</span></div>) : <p>没有更早的人工审核记录。</p>}
    </div></aside>
  </section>;
}
