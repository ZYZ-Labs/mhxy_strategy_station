import { Link } from "react-router";

import type { PublishedGuide } from "~/features/content/types";

export function GuideCard({ guide }: { guide: PublishedGuide }) {
  return (
    <article className="guide-card">
      <div className="guide-card-meta">
        <span>{guide.categoryName ?? "未分类"}</span>
        <time dateTime={guide.updatedAt}>
          {new Date(guide.updatedAt).toLocaleDateString("zh-CN")}
        </time>
      </div>
      <h3>
        <Link to={`/guides/${guide.slug}`}>{guide.title}</Link>
      </h3>
      <p>{guide.summary}</p>
      <div className="tag-row">
        {guide.tags.slice(0, 4).map((tag) => (
          <span className="tag" key={tag}>
            {tag}
          </span>
        ))}
      </div>
      <footer>
        <span>作者：{guide.authorName}</span>
        <Link className="text-link" to={`/guides/${guide.slug}`}>
          阅读攻略
        </Link>
      </footer>
    </article>
  );
}
