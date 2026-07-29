import { Link } from "react-router";

import { requireUser } from "~/features/auth/service.server";
import { listAuthorDrafts } from "~/features/content/repository.server";
import { getCloudflare } from "~/lib/cloudflare.server";

import type { Route } from "./+types/dashboard";

const statusLabels: Record<string, string> = {
  draft: "草稿",
  submitted: "已提交",
  rule_checking: "规则检查中",
  manual_review: "等待人工审核",
  approved: "已批准",
  rejected: "已退回",
  published: "已发布",
};

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = getCloudflare(context);
  const user = await requireUser(env.DB, request);
  return { user, drafts: await listAuthorDrafts(env.DB, user.id) };
}

export default function Dashboard({ loaderData }: Route.ComponentProps) {
  return (
    <section className="dashboard-shell">
      <header className="section-heading">
        <div><p className="eyebrow">CREATOR DESK</p><h2>{loaderData.user.displayName} 的攻略</h2></div>
        <Link className="button button-primary" to="/dashboard/guides/new">新建攻略</Link>
      </header>
      {loaderData.drafts.length ? <div className="review-list">
        {loaderData.drafts.map((draft) => (
          <article className="review-card" key={draft.entryId}>
            <div className="status-row">
              <span className="status-badge" data-status={draft.status}>{statusLabels[draft.status] ?? draft.status}</span>
              <time>{new Date(draft.updatedAt).toLocaleString("zh-CN")}</time>
            </div>
            <h2>{draft.title}</h2><p>{draft.summary}</p>
            {draft.rejectionReason ? <p className="form-error">退回理由：{draft.rejectionReason}</p> : null}
            <div className="page-actions">
              {(draft.status === "draft" || draft.status === "rejected" || draft.status === "published") ? <Link className="button" to={`/dashboard/guides/${draft.entryId}/edit`}>编辑</Link> : null}
              {draft.status === "draft" ? <Link className="button button-primary" to={`/dashboard/guides/${draft.entryId}/submit`}>提交审核</Link> : null}
              {draft.status === "published" ? <Link className="text-link" to={`/guides/${draft.slug}`}>查看公开版本</Link> : null}
            </div>
          </article>
        ))}
      </div> : <div className="empty-state">还没有草稿。第一期仅支持纯文本攻略。</div>}
    </section>
  );
}
