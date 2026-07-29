import { GuideCard } from "~/components/guide-card";
import { listPublishedGuides } from "~/features/content/repository.server";
import { getCloudflare } from "~/lib/cloudflare.server";

import type { Route } from "./+types/guides";

export function meta() {
  return [{ title: "攻略库｜梦幻策略站" }];
}

export async function loader({ context }: Route.LoaderArgs) {
  const { env } = getCloudflare(context);
  return { guides: await listPublishedGuides(env.DB) };
}

export default function Guides({ loaderData }: Route.ComponentProps) {
  return (
    <section className="page-shell">
      <header className="page-heading">
        <p className="eyebrow">GUIDE LIBRARY</p>
        <h1>人工甄选攻略库</h1>
        <p>这里出现的每篇内容都已经通过确定性规则预审和管理员人工终审。</p>
      </header>
      {loaderData.guides.length ? (
        <div className="guide-grid">
          {loaderData.guides.map((guide) => <GuideCard key={guide.id} guide={guide} />)}
        </div>
      ) : <div className="empty-state">暂无已发布攻略。</div>}
    </section>
  );
}
