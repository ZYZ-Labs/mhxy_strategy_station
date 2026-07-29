import { Form } from "react-router";

import { GuideCard } from "~/components/guide-card";
import { searchPublishedGuides } from "~/features/content/repository.server";
import { getCloudflare } from "~/lib/cloudflare.server";

import type { Route } from "./+types/search";

export function meta() {
  return [{ title: "搜索｜梦幻策略站" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const query = new URL(request.url).searchParams.get("q")?.trim().slice(0, 100) ?? "";
  const { env } = getCloudflare(context);
  return { query, guides: query ? await searchPublishedGuides(env.DB, query) : [] };
}

export default function Search({ loaderData }: Route.ComponentProps) {
  return (
    <section className="page-shell">
      <header className="page-heading"><p className="eyebrow">SEARCH</p><h1>搜索已审核攻略</h1></header>
      <Form className="search-form" method="get">
        <input aria-label="搜索词" name="q" defaultValue={loaderData.query} maxLength={100} placeholder="输入门派、玩法、任务或关键词" />
        <button className="button button-primary" type="submit">搜索</button>
      </Form>
      {loaderData.query ? (
        loaderData.guides.length ? <div className="guide-grid">{loaderData.guides.map((guide) => <GuideCard guide={guide} key={guide.id} />)}</div> :
          <div className="empty-state">没有找到与“{loaderData.query}”相关的已发布攻略。</div>
      ) : <div className="empty-state">输入关键词开始搜索；结果只包含人工批准的公开内容。</div>}
    </section>
  );
}
