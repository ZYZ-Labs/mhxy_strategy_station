import {
  MODERATION_CATEGORIES,
  POLICY_VERSION,
  RULE_VERSION,
  evaluateTextRules,
} from "~/features/moderation/rules";
import { sha256 } from "~/lib/crypto";
import { createGuideSlug, createId } from "~/lib/ids";
import { nowIso } from "~/lib/time";

import {
  countDuplicateContent,
  createDraftRows,
  createNextDraftFromRevision,
  getAuthorLatestRevision,
  markRuleChecking,
  recordDecision,
  saveRuleResult,
  updateDraftRow,
} from "./repository.server";
import { guideInputSchema, type GuideInput } from "./validation";
import type { DraftGuide } from "./types";

async function contentHash(input: GuideInput): Promise<string> {
  return sha256(
    `${input.title.normalize("NFKC").trim()}\n${input.body
      .normalize("NFKC")
      .replace(/\s+/gu, " ")
      .trim()}`,
  );
}

export async function createDraft(
  db: D1Database,
  authorId: string,
  input: GuideInput,
): Promise<string> {
  const data = guideInputSchema.parse(input);
  const entryId = createId();
  const now = nowIso();
  await createDraftRows(db, {
    entryId,
    revisionId: createId(),
    slug: createGuideSlug(),
    authorId,
    ...data,
    contentHash: await contentHash(data),
    now,
  });
  return entryId;
}

export async function ensureEditableDraft(
  db: D1Database,
  entryId: string,
  authorId: string,
): Promise<DraftGuide> {
  let current = await getAuthorLatestRevision(db, entryId, authorId);
  if (!current) {
    throw new Response("攻略不存在", { status: 404 });
  }
  if (current.status === "draft") {
    return current;
  }
  if (current.status !== "published" && current.status !== "rejected") {
    return current;
  }

  const created = await createNextDraftFromRevision(db, {
    revisionId: createId(),
    sourceRevisionId: current.revisionId,
    entryId,
    authorId,
    now: nowIso(),
  });
  if (!created) {
    throw new Error("创建新修订失败");
  }
  current = await getAuthorLatestRevision(db, entryId, authorId);
  if (!current) {
    throw new Error("读取新修订失败");
  }
  return current;
}

export async function updateDraft(
  db: D1Database,
  revisionId: string,
  authorId: string,
  input: GuideInput,
): Promise<void> {
  const data = guideInputSchema.parse(input);
  const changed = await updateDraftRow(db, {
    revisionId,
    authorId,
    ...data,
    contentHash: await contentHash(data),
    now: nowIso(),
  });
  if (!changed) {
    throw new Error("草稿不存在或当前状态不可编辑");
  }
}

export async function submitDraft(
  db: D1Database,
  revision: DraftGuide,
  authorId: string,
): Promise<void> {
  const now = nowIso();
  const locked = await markRuleChecking(
    db,
    revision.revisionId,
    authorId,
    now,
  );
  if (!locked) {
    throw new Error("草稿状态已经变化，请刷新后重试");
  }

  try {
    const hash = await contentHash(
      guideInputSchema.parse({
        title: revision.title,
        summary: revision.summary,
        body: revision.body,
        categoryId: revision.categoryId,
        tags: revision.tags,
      }),
    );
    const duplicate =
      (await countDuplicateContent(db, hash, revision.revisionId)) > 0;
    const result = evaluateTextRules({
      title: revision.title,
      body: revision.body,
      duplicate,
    });
    await saveRuleResult(db, {
      id: createId(),
      revisionId: revision.revisionId,
      policyVersion: POLICY_VERSION,
      ruleVersion: RULE_VERSION,
      riskLevel: result.riskLevel,
      matches: result.matches,
      checkedAt: nowIso(),
      errorMessage: null,
    });
  } catch (error) {
    await saveRuleResult(db, {
      id: createId(),
      revisionId: revision.revisionId,
      policyVersion: POLICY_VERSION,
      ruleVersion: RULE_VERSION,
      riskLevel: "error",
      matches: [],
      checkedAt: nowIso(),
      errorMessage: error instanceof Error ? error.message : "规则预审失败",
    });
  }
}

export async function decideReview(
  db: D1Database,
  input: {
    revisionId: string;
    reviewerId: string;
    decision: "approve" | "reject";
    categories: string[];
    reason: string;
  },
): Promise<void> {
  if (input.reason.trim().length < 2) {
    throw new Error("请填写审核理由");
  }
  const allowedCategories = new Set<string>(
    MODERATION_CATEGORIES.map((category) => category.value),
  );
  if (input.categories.some((category) => !allowedCategories.has(category))) {
    throw new Error("审核分类无效");
  }
  if (input.decision === "reject" && input.categories.length === 0) {
    throw new Error("退回时至少选择一个违规分类");
  }
  const changed = await recordDecision(db, {
    decisionId: createId(),
    revisionId: input.revisionId,
    reviewerId: input.reviewerId,
    decision: input.decision,
    categories: input.categories,
    reason: input.reason.trim(),
    policyVersion: POLICY_VERSION,
    now: nowIso(),
  });
  if (!changed) {
    throw new Error("审核项不存在或已经被其他管理员处理");
  }
}
