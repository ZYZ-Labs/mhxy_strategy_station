import type { RiskLevel, RuleMatch } from "~/features/moderation/rules";

export type RevisionStatus =
  | "draft"
  | "submitted"
  | "rule_checking"
  | "manual_review"
  | "approved"
  | "rejected"
  | "published";

export interface PublishedGuide {
  id: string;
  slug: string;
  title: string;
  summary: string;
  body: string;
  categoryId: string | null;
  categoryName: string | null;
  tags: string[];
  authorName: string;
  publishedAt: string;
  updatedAt: string;
}

export interface DraftGuide {
  entryId: string;
  revisionId: string;
  slug: string;
  revisionNo: number;
  title: string;
  summary: string;
  body: string;
  categoryId: string | null;
  tags: string[];
  status: RevisionStatus;
  riskLevel: RiskLevel | null;
  updatedAt: string;
  submittedAt: string | null;
  rejectionReason: string | null;
}

export interface ReviewItem extends DraftGuide {
  authorId: string;
  authorName: string;
  ruleMatches: RuleMatch[];
  ruleVersion: string | null;
  policyVersion: string | null;
  moderationError: string | null;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  description: string;
}
