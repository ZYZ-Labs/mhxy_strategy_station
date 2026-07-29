import { Link } from "react-router";

import { requireAdmin } from "~/features/auth/service.server";
import { listReviewQueue } from "~/features/content/repository.server";
import { getCloudflare } from "~/lib/cloudflare.server";

import type { Route } from "./+types/admin-reviews";

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = getCloudflare(context);
  const user = await requireAdmin(env.DB, request);
  return { user, reviews: await listReviewQueue(env.DB) };
}

export default function AdminReviews({ loaderData }: Route.ComponentProps) {
  return <section className="dashboard-shell">
    <header className="section-heading"><div><p className="eyebrow">MANUAL REVIEW</p><h2>人工审核队列</h2></div>
      <div className="page-actions"><Link className="button button-small" to="/admin/categories">分类</Link><Link className="button button-small" to="/admin/invites">邀请码</Link>{loaderData.user.role === "super_admin" ? <><Link className="button button-small" to="/admin/users">用户</Link><Link className="button button-small" to="/admin/registration">注册策略</Link></> : null}</div>
    </header>
    {loaderData.reviews.length ? <div className="review-list">{loaderData.reviews.map((item) => <article className="review-card" key={item.revisionId}>
      <div className="status-row"><span className="status-badge" data-risk={item.riskLevel}>{item.riskLevel ?? "未标记"}</span><span>{item.authorName}</span></div>
      <h2>{item.title}</h2><p>{item.summary}</p>
      <Link className="button button-primary" to={`/admin/reviews/${item.revisionId}`}>进入人工审核</Link>
    </article>)}</div> : <div className="empty-state">当前没有等待人工审核的投稿。</div>}
  </section>;
}
