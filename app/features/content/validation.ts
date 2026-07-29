import { z } from "zod";

export const guideInputSchema = z.object({
  title: z.string().trim().min(4, "标题至少 4 个字符").max(80, "标题不能超过 80 个字符"),
  summary: z
    .string()
    .trim()
    .min(10, "摘要至少 10 个字符")
    .max(240, "摘要不能超过 240 个字符"),
  body: z
    .string()
    .trim()
    .min(50, "正文至少 50 个字符")
    .max(30_000, "正文不能超过 30000 个字符"),
  categoryId: z.string().trim().max(64).nullable(),
  tags: z
    .array(z.string().trim().min(1).max(20))
    .max(8, "标签最多 8 个")
    .transform((tags) => [...new Set(tags)]),
});

export type GuideInput = z.infer<typeof guideInputSchema>;

export function parseTags(value: string): string[] {
  return value
    .split(/[,，]/u)
    .map((tag) => tag.trim())
    .filter(Boolean);
}
