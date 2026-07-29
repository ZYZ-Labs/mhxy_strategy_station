import type {
  Category,
  DraftGuide,
  PublishedGuide,
  ReviewItem,
  RevisionStatus,
} from "./types";
import type { RiskLevel, RuleMatch } from "~/features/moderation/rules";

function parseTags(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((tag): tag is string => typeof tag === "string")
      : [];
  } catch {
    return [];
  }
}

function mapPublished(row: {
  id: string;
  slug: string;
  title: string;
  summary: string;
  body: string;
  category_id: string | null;
  category_name: string | null;
  tags_json: string;
  author_name: string;
  published_at: string;
  updated_at: string;
}): PublishedGuide {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    body: row.body,
    categoryId: row.category_id,
    categoryName: row.category_name,
    tags: parseTags(row.tags_json),
    authorName: row.author_name,
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
  };
}

const publishedSelect = `
  SELECT e.id, e.slug, r.title, r.summary, r.body, r.category_id,
         c.name AS category_name, r.tags_json, u.display_name AS author_name,
         COALESCE(r.reviewed_at, r.updated_at) AS published_at,
         e.updated_at
  FROM content_entries e
  INNER JOIN content_revisions r ON r.id = e.published_revision_id
  INNER JOIN users u ON u.id = e.author_id
  LEFT JOIN categories c ON c.id = r.category_id
  WHERE r.status = 'published'
`;

export async function listPublishedGuides(
  db: D1Database,
  limit = 24,
): Promise<PublishedGuide[]> {
  const result = await db
    .prepare(`${publishedSelect} ORDER BY e.updated_at DESC LIMIT ?1`)
    .bind(limit)
    .all<Parameters<typeof mapPublished>[0]>();
  return result.results.map(mapPublished);
}

export async function getPublishedGuideBySlug(
  db: D1Database,
  slug: string,
): Promise<PublishedGuide | null> {
  const row = await db
    .prepare(`${publishedSelect} AND e.slug = ?1 LIMIT 1`)
    .bind(slug)
    .first<Parameters<typeof mapPublished>[0]>();
  return row ? mapPublished(row) : null;
}

export async function searchPublishedGuides(
  db: D1Database,
  query: string,
  limit = 20,
): Promise<PublishedGuide[]> {
  const escaped = query.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
  const pattern = `%${escaped}%`;
  const result = await db
    .prepare(
      `${publishedSelect}
       AND (
         r.title LIKE ?1 ESCAPE '\\'
         OR r.summary LIKE ?1 ESCAPE '\\'
         OR r.body LIKE ?1 ESCAPE '\\'
         OR r.tags_json LIKE ?1 ESCAPE '\\'
       )
       ORDER BY
         CASE WHEN r.title LIKE ?1 ESCAPE '\\' THEN 0 ELSE 1 END,
         e.updated_at DESC
       LIMIT ?2`,
    )
    .bind(pattern, limit)
    .all<Parameters<typeof mapPublished>[0]>();
  return result.results.map(mapPublished);
}

export async function listCategories(db: D1Database): Promise<Category[]> {
  const result = await db
    .prepare(
      `SELECT id, slug, name, description
       FROM categories
       WHERE status = 'active'
       ORDER BY sort_order, name`,
    )
    .all<Category>();
  return result.results;
}

export async function createCategory(
  db: D1Database,
  category: Category & { now: string },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO categories (
         id, slug, name, description, created_at, updated_at
       ) VALUES (?1, ?2, ?3, ?4, ?5, ?5)`,
    )
    .bind(
      category.id,
      category.slug,
      category.name,
      category.description,
      category.now,
    )
    .run();
}

export async function createDraftRows(
  db: D1Database,
  input: {
    entryId: string;
    revisionId: string;
    slug: string;
    authorId: string;
    title: string;
    summary: string;
    body: string;
    categoryId: string | null;
    tags: string[];
    contentHash: string;
    now: string;
  },
): Promise<void> {
  await db.batch([
    db
      .prepare(
        `INSERT INTO content_entries (
           id, slug, author_id, created_at, updated_at
         ) VALUES (?1, ?2, ?3, ?4, ?4)`,
      )
      .bind(input.entryId, input.slug, input.authorId, input.now),
    db
      .prepare(
        `INSERT INTO content_revisions (
           id, entry_id, revision_no, title, summary, body, category_id,
           tags_json, content_hash, status, created_at, updated_at
         ) VALUES (?1, ?2, 1, ?3, ?4, ?5, ?6, ?7, ?8, 'draft', ?9, ?9)`,
      )
      .bind(
        input.revisionId,
        input.entryId,
        input.title,
        input.summary,
        input.body,
        input.categoryId,
        JSON.stringify(input.tags),
        input.contentHash,
        input.now,
      ),
  ]);
}

interface DraftRow {
  entry_id: string;
  revision_id: string;
  slug: string;
  revision_no: number;
  title: string;
  summary: string;
  body: string;
  category_id: string | null;
  tags_json: string;
  status: RevisionStatus;
  risk_level: RiskLevel | null;
  updated_at: string;
  submitted_at: string | null;
  rejection_reason: string | null;
}

function mapDraft(row: DraftRow): DraftGuide {
  return {
    entryId: row.entry_id,
    revisionId: row.revision_id,
    slug: row.slug,
    revisionNo: row.revision_no,
    title: row.title,
    summary: row.summary,
    body: row.body,
    categoryId: row.category_id,
    tags: parseTags(row.tags_json),
    status: row.status,
    riskLevel: row.risk_level,
    updatedAt: row.updated_at,
    submittedAt: row.submitted_at,
    rejectionReason: row.rejection_reason,
  };
}

const draftSelect = `
  SELECT e.id AS entry_id, r.id AS revision_id, e.slug, r.revision_no,
         r.title, r.summary, r.body, r.category_id, r.tags_json, r.status,
         mr.risk_level, r.updated_at, r.submitted_at, r.rejection_reason
  FROM content_entries e
  INNER JOIN content_revisions r ON r.entry_id = e.id
  LEFT JOIN moderation_results mr ON mr.revision_id = r.id
`;

export async function listAuthorDrafts(
  db: D1Database,
  authorId: string,
): Promise<DraftGuide[]> {
  const result = await db
    .prepare(
      `${draftSelect}
       WHERE e.author_id = ?1
         AND r.revision_no = (
           SELECT MAX(latest.revision_no)
           FROM content_revisions latest
           WHERE latest.entry_id = e.id
         )
       ORDER BY r.updated_at DESC`,
    )
    .bind(authorId)
    .all<DraftRow>();
  return result.results.map(mapDraft);
}

export async function getAuthorLatestRevision(
  db: D1Database,
  entryId: string,
  authorId: string,
): Promise<DraftGuide | null> {
  const row = await db
    .prepare(
      `${draftSelect}
       WHERE e.id = ?1 AND e.author_id = ?2
       ORDER BY r.revision_no DESC
       LIMIT 1`,
    )
    .bind(entryId, authorId)
    .first<DraftRow>();
  return row ? mapDraft(row) : null;
}

export async function createNextDraftFromRevision(
  db: D1Database,
  input: {
    revisionId: string;
    sourceRevisionId: string;
    entryId: string;
    authorId: string;
    now: string;
  },
): Promise<boolean> {
  const result = await db
    .prepare(
      `INSERT INTO content_revisions (
         id, entry_id, revision_no, title, summary, body, category_id,
         tags_json, content_hash, status, created_at, updated_at
       )
       SELECT ?1, e.id, source.revision_no + 1, source.title, source.summary,
              source.body, source.category_id, source.tags_json,
              source.content_hash, 'draft', ?5, ?5
       FROM content_entries e
       INNER JOIN content_revisions source ON source.id = ?2
       WHERE e.id = ?3
         AND e.author_id = ?4
         AND source.entry_id = e.id
         AND source.status IN ('published', 'rejected')
         AND source.revision_no = (
           SELECT MAX(latest.revision_no)
           FROM content_revisions latest
           WHERE latest.entry_id = e.id
         )`,
    )
    .bind(
      input.revisionId,
      input.sourceRevisionId,
      input.entryId,
      input.authorId,
      input.now,
    )
    .run();
  return result.meta.changes === 1;
}

export async function updateDraftRow(
  db: D1Database,
  input: {
    revisionId: string;
    authorId: string;
    title: string;
    summary: string;
    body: string;
    categoryId: string | null;
    tags: string[];
    contentHash: string;
    now: string;
  },
): Promise<boolean> {
  const result = await db
    .prepare(
      `UPDATE content_revisions
       SET title = ?3, summary = ?4, body = ?5, category_id = ?6,
           tags_json = ?7, content_hash = ?8, updated_at = ?9
       WHERE id = ?1
         AND status = 'draft'
         AND entry_id IN (
           SELECT id FROM content_entries WHERE author_id = ?2
         )`,
    )
    .bind(
      input.revisionId,
      input.authorId,
      input.title,
      input.summary,
      input.body,
      input.categoryId,
      JSON.stringify(input.tags),
      input.contentHash,
      input.now,
    )
    .run();
  return result.meta.changes === 1;
}

export async function countDuplicateContent(
  db: D1Database,
  contentHash: string,
  revisionId: string,
): Promise<number> {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS count
       FROM content_revisions
       WHERE content_hash = ?1 AND id <> ?2`,
    )
    .bind(contentHash, revisionId)
    .first<{ count: number }>();
  return row?.count ?? 0;
}

export async function markRuleChecking(
  db: D1Database,
  revisionId: string,
  authorId: string,
  now: string,
): Promise<boolean> {
  const result = await db
    .prepare(
      `UPDATE content_revisions
       SET status = 'rule_checking', submitted_at = ?3, updated_at = ?3
       WHERE id = ?1
         AND status = 'draft'
         AND entry_id IN (
           SELECT id FROM content_entries WHERE author_id = ?2
         )`,
    )
    .bind(revisionId, authorId, now)
    .run();
  return result.meta.changes === 1;
}

export async function saveRuleResult(
  db: D1Database,
  input: {
    id: string;
    revisionId: string;
    policyVersion: string;
    ruleVersion: string;
    riskLevel: RiskLevel;
    matches: RuleMatch[];
    checkedAt: string;
    errorMessage: string | null;
  },
): Promise<void> {
  await db.batch([
    db
      .prepare(
        `INSERT INTO moderation_results (
           id, revision_id, policy_version, rule_version, risk_level,
           matches_json, checked_at, error_message
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
         ON CONFLICT(revision_id) DO UPDATE SET
           policy_version = excluded.policy_version,
           rule_version = excluded.rule_version,
           risk_level = excluded.risk_level,
           matches_json = excluded.matches_json,
           checked_at = excluded.checked_at,
           error_message = excluded.error_message`,
      )
      .bind(
        input.id,
        input.revisionId,
        input.policyVersion,
        input.ruleVersion,
        input.riskLevel,
        JSON.stringify(input.matches),
        input.checkedAt,
        input.errorMessage,
      ),
    db
      .prepare(
        `UPDATE content_revisions
         SET status = 'manual_review', updated_at = ?2
         WHERE id = ?1 AND status = 'rule_checking'`,
      )
      .bind(input.revisionId, input.checkedAt),
  ]);
}

interface ReviewRow extends DraftRow {
  author_id: string;
  author_name: string;
  matches_json: string | null;
  rule_version: string | null;
  policy_version: string | null;
  error_message: string | null;
}

function mapReview(row: ReviewRow): ReviewItem {
  let ruleMatches: RuleMatch[] = [];
  try {
    const parsed: unknown = JSON.parse(row.matches_json ?? "[]");
    if (Array.isArray(parsed)) {
      ruleMatches = parsed as RuleMatch[];
    }
  } catch {
    ruleMatches = [];
  }
  return {
    ...mapDraft(row),
    authorId: row.author_id,
    authorName: row.author_name,
    ruleMatches,
    ruleVersion: row.rule_version,
    policyVersion: row.policy_version,
    moderationError: row.error_message,
  };
}

const reviewSelect = `
  SELECT e.id AS entry_id, r.id AS revision_id, e.slug, r.revision_no,
         r.title, r.summary, r.body, r.category_id, r.tags_json, r.status,
         mr.risk_level, r.updated_at, r.submitted_at, r.rejection_reason,
         e.author_id, u.display_name AS author_name, mr.matches_json,
         mr.rule_version, mr.policy_version, mr.error_message
  FROM content_revisions r
  INNER JOIN content_entries e ON e.id = r.entry_id
  INNER JOIN users u ON u.id = e.author_id
  LEFT JOIN moderation_results mr ON mr.revision_id = r.id
`;

export async function listReviewQueue(db: D1Database): Promise<ReviewItem[]> {
  const result = await db
    .prepare(
      `${reviewSelect}
       WHERE r.status = 'manual_review'
       ORDER BY
         CASE mr.risk_level
           WHEN 'error' THEN 0
           WHEN 'critical' THEN 1
           WHEN 'warning' THEN 2
           ELSE 3
         END,
         r.submitted_at ASC
       LIMIT 200`,
    )
    .all<ReviewRow>();
  return result.results.map(mapReview);
}

export async function getReviewItem(
  db: D1Database,
  revisionId: string,
): Promise<ReviewItem | null> {
  const row = await db
    .prepare(`${reviewSelect} WHERE r.id = ?1 LIMIT 1`)
    .bind(revisionId)
    .first<ReviewRow>();
  return row ? mapReview(row) : null;
}

export interface AuthorReviewHistory {
  title: string;
  decision: "approve" | "reject";
  reason: string;
  createdAt: string;
}

export async function listAuthorReviewHistory(
  db: D1Database,
  authorId: string,
  excludeRevisionId: string,
): Promise<AuthorReviewHistory[]> {
  const result = await db.prepare(
    `SELECT r.title, d.decision, d.reason, d.created_at
     FROM moderation_decisions d
     INNER JOIN content_revisions r ON r.id = d.revision_id
     INNER JOIN content_entries e ON e.id = r.entry_id
     WHERE e.author_id = ?1 AND r.id <> ?2
     ORDER BY d.created_at DESC
     LIMIT 5`,
  ).bind(authorId, excludeRevisionId).all<{
    title: string;
    decision: "approve" | "reject";
    reason: string;
    created_at: string;
  }>();
  return result.results.map((row) => ({
    title: row.title,
    decision: row.decision,
    reason: row.reason,
    createdAt: row.created_at,
  }));
}

export async function recordDecision(
  db: D1Database,
  input: {
    decisionId: string;
    revisionId: string;
    reviewerId: string;
    decision: "approve" | "reject";
    categories: string[];
    reason: string;
    policyVersion: string;
    now: string;
  },
): Promise<boolean> {
  const review = await getReviewItem(db, input.revisionId);
  if (!review || review.status !== "manual_review") {
    return false;
  }

  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        `INSERT INTO moderation_decisions (
           id, revision_id, reviewer_id, decision, categories_json,
           reason, policy_version, created_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
      )
      .bind(
        input.decisionId,
        input.revisionId,
        input.reviewerId,
        input.decision,
        JSON.stringify(input.categories),
        input.reason,
        input.policyVersion,
        input.now,
      ),
  ];

  if (input.decision === "approve") {
    statements.push(
      db
        .prepare(
          `UPDATE content_revisions
           SET status = 'published', reviewer_id = ?2, reviewed_at = ?3,
               rejection_reason = NULL, updated_at = ?3
           WHERE id = ?1 AND status = 'manual_review'`,
        )
        .bind(input.revisionId, input.reviewerId, input.now),
      db
        .prepare(
          `UPDATE content_entries
           SET published_revision_id = ?2, updated_at = ?3
           WHERE id = ?1`,
        )
        .bind(review.entryId, input.revisionId, input.now),
    );
  } else {
    statements.push(
      db
        .prepare(
          `UPDATE content_revisions
           SET status = 'rejected', reviewer_id = ?2, reviewed_at = ?3,
               rejection_reason = ?4, updated_at = ?3
           WHERE id = ?1 AND status = 'manual_review'`,
        )
        .bind(
          input.revisionId,
          input.reviewerId,
          input.now,
          input.reason,
        ),
    );
  }

  const results = await db.batch(statements);
  return results[1]?.meta.changes === 1;
}
