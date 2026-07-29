import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import {
  getPublishedGuideBySlug,
  listPublishedGuides,
  searchPublishedGuides,
} from "~/features/content/repository.server";

function textResult(value: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value) }],
    structuredContent: value,
  };
}

function guideSummary(guide: Awaited<ReturnType<typeof listPublishedGuides>>[number]) {
  return {
    slug: guide.slug,
    title: guide.title,
    summary: guide.summary,
    category: guide.categoryName,
    tags: guide.tags,
    author: guide.authorName,
    publishedAt: guide.publishedAt,
    updatedAt: guide.updatedAt,
  };
}

export function createStrategyMcpServer(db: D1Database) {
  const server = new McpServer({
    name: "mhxy-strategy-station",
    version: "0.1.0",
  });

  server.registerTool(
    "list_published_guides",
    {
      description: "列出最近由管理员人工批准并公开发布的梦幻西游攻略。不会返回草稿或待审内容。",
      inputSchema: {
        limit: z.number().int().min(1).max(50).default(20),
      },
    },
    async ({ limit }) => {
      const guides = await listPublishedGuides(db, limit);
      return textResult({ guides: guides.map(guideSummary) });
    },
  );

  server.registerTool(
    "search_published_guides",
    {
      description: "在已人工批准的梦幻西游攻略标题、摘要、正文和标签中搜索。",
      inputSchema: {
        query: z.string().trim().min(1).max(100),
        limit: z.number().int().min(1).max(50).default(20),
      },
    },
    async ({ query, limit }) => {
      const guides = await searchPublishedGuides(db, query, limit);
      return textResult({ query, guides: guides.map(guideSummary) });
    },
  );

  server.registerTool(
    "get_published_guide",
    {
      description: "按 slug 读取一篇已由管理员人工批准的完整攻略。",
      inputSchema: {
        slug: z.string().trim().min(1).max(120),
      },
    },
    async ({ slug }) => {
      const guide = await getPublishedGuideBySlug(db, slug);
      if (!guide) {
        return {
          content: [{ type: "text" as const, text: "未找到已发布攻略" }],
          isError: true,
        };
      }
      return textResult({ ...guideSummary(guide), body: guide.body });
    },
  );

  return server;
}
