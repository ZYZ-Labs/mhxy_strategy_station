import { getPublishedGuideBySlug } from "~/features/content/repository.server";
import { getCloudflare } from "~/lib/cloudflare.server";

import type { Route } from "./+types/guide-detail";

export async function loader({ context, params }: Route.LoaderArgs) {
  const { env } = getCloudflare(context);
  const guide = await getPublishedGuideBySlug(env.DB, params.slug);
  if (!guide) throw new Response("攻略不存在", { status: 404 });
  return { guide };
}

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: loaderData ? `${loaderData.guide.title}｜梦幻策略站` : "攻略不存在" }];
}

export default function GuideDetail({ loaderData }: Route.ComponentProps) {
  const { guide } = loaderData;
  return (
    <article className="article-shell">
      <div>
        <header className="article-header">
          <p className="eyebrow">{guide.categoryName ?? "未分类"}</p>
          <h1>{guide.title}</h1>
          <p className="article-summary">{guide.summary}</p>
          <div className="article-meta">
            <span>作者：{guide.authorName}</span>
            <time dateTime={guide.publishedAt}>{new Date(guide.publishedAt).toLocaleDateString("zh-CN")}</time>
          </div>
        </header>
        <div className="article-body"><p>{guide.body}</p></div>
      </div>
      <aside className="article-aside">
        <div className="panel">
          <h3>内容说明</h3>
          <p>本文为纯文本攻略，已由管理员人工批准。游戏机制可能随版本调整，请结合发布时间判断。</p>
          <div className="tag-row">
            {guide.tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}
          </div>
        </div>
      </aside>
    </article>
  );
}
