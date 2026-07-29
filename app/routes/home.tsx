import { Link } from "react-router";

import { GuideCard } from "~/components/guide-card";
import { ProhibitedNotice } from "~/components/prohibited-notice";
import { listPublishedGuides } from "~/features/content/repository.server";
import { getCloudflare } from "~/lib/cloudflare.server";

import type { Route } from "./+types/home";

export function meta() {
  return [
    { title: "梦幻策略站｜人工甄选的梦幻西游攻略" },
    {
      name: "description",
      content: "只收录经过规则预审和人工终审的梦幻西游纯文本攻略。",
    },
  ];
}

export async function loader({ context }: Route.LoaderArgs) {
  const { env } = getCloudflare(context);
  return { guides: await listPublishedGuides(env.DB, 6) };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">TEXT FIRST · HUMAN REVIEWED · MCP READY</p>
          <h1>
            把零散经验，整理成
            <em>可信攻略</em>
          </h1>
          <p>
            面向玩家和 AI 的梦幻西游攻略库。第一期只收纯文本，每次发布都经过规则预审和管理员人工终审。
          </p>
          <div className="hero-actions">
            <Link className="button button-primary" to="/guides">
              浏览攻略
            </Link>
            <Link className="button" to="/dashboard/guides/new">
              投稿攻略
            </Link>
          </div>
        </div>
        <aside className="hero-panel">
          <strong>高质量优先</strong>
          <p>不追求发帖数量。内容保留版本、作者、发布时间和审核痕迹，MCP 只读取已人工批准的公开版本。</p>
          <div className="metric-grid">
            <div className="metric"><b>纯文本</b><span>首期范围</span></div>
            <div className="metric"><b>100%</b><span>人工终审</span></div>
            <div className="metric"><b>只读</b><span>MCP 能力</span></div>
          </div>
        </aside>
      </section>
      <section className="page-shell section">
        <div className="section-heading">
          <div><p className="eyebrow">LATEST GUIDES</p><h2>最新攻略</h2></div>
          <Link className="text-link" to="/guides">查看全部</Link>
        </div>
        {loaderData.guides.length ? (
          <div className="guide-grid">
            {loaderData.guides.map((guide) => <GuideCard key={guide.id} guide={guide} />)}
          </div>
        ) : (
          <div className="empty-state">攻略库正在等待第一篇通过人工审核的内容。</div>
        )}
      </section>
      <ProhibitedNotice />
    </>
  );
}
