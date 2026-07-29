export const POLICY_VERSION = "2026-07-29.v1";
export const RULE_VERSION = "2026-07-29.v1";

export type ModerationCategory =
  | "sexual_content"
  | "gambling"
  | "illegal_goods"
  | "fraud_or_phishing"
  | "game_black_market"
  | "offsite_redirection"
  | "violence_hate_harassment"
  | "spam_or_duplicate"
  | "off_topic"
  | "moderation_evasion"
  | "politics";

export const MODERATION_CATEGORIES: ReadonlyArray<{
  value: ModerationCategory;
  label: string;
}> = [
  { value: "sexual_content", label: "色情与招嫖" },
  { value: "gambling", label: "赌博与资金盘" },
  { value: "illegal_goods", label: "毒品与违禁品" },
  { value: "fraud_or_phishing", label: "诈骗、盗号与钓鱼" },
  { value: "game_black_market", label: "游戏黑产" },
  { value: "offsite_redirection", label: "站外联系方式引流" },
  { value: "violence_hate_harassment", label: "暴力、仇恨与骚扰" },
  { value: "spam_or_duplicate", label: "垃圾、灌水与重复" },
  { value: "off_topic", label: "与梦幻西游无关" },
  { value: "moderation_evasion", label: "规避审核" },
  { value: "politics", label: "现实政治" },
];

export type RiskLevel = "clear" | "warning" | "critical" | "error";

export interface RuleMatch {
  ruleId: string;
  category: ModerationCategory;
  severity: Exclude<RiskLevel, "clear" | "error">;
  field: "title" | "body" | "combined" | "metadata";
  excerpt: string;
  reason: string;
}

export interface RuleResult {
  riskLevel: RiskLevel;
  matches: RuleMatch[];
  normalizedTitle: string;
  normalizedBody: string;
}

// Control characters are intentional moderation-evasion signals.
// eslint-disable-next-line no-control-regex
const invisibleCharacters = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u2060\uFEFF]/gu;
const urlPattern = /\b(?:https?:\/\/|www\.)[^\s<>"']+/giu;
const contactPattern =
  /(?:微信|威信|微\s*信|vx|v信|qq|企鹅|群号|手机号|电话|加群|私聊)\s*[:：号]?\s*[a-z0-9_-]{4,}/giu;
const phonePattern = /(?<!\d)1[3-9]\d{9}(?!\d)/gu;
const repeatedCharacterPattern = /(.)\1{11,}/gu;

const keywordRules: Array<{
  ruleId: string;
  category: ModerationCategory;
  severity: "warning" | "critical";
  terms: string[];
  reason: string;
}> = [
  {
    ruleId: "prohibited.sexual",
    category: "sexual_content",
    severity: "critical",
    terms: ["色情", "招嫖", "淫秽"],
    reason: "疑似包含色情、淫秽或招嫖内容",
  },
  {
    ruleId: "prohibited.gambling",
    category: "gambling",
    severity: "critical",
    terms: ["赌博", "博彩", "资金盘"],
    reason: "疑似包含赌博、博彩或资金盘内容",
  },
  {
    ruleId: "prohibited.illegal_goods",
    category: "illegal_goods",
    severity: "critical",
    terms: ["毒品", "违禁品"],
    reason: "疑似包含毒品或违禁品内容",
  },
  {
    ruleId: "prohibited.fraud",
    category: "fraud_or_phishing",
    severity: "critical",
    terms: ["诈骗", "盗号", "钓鱼链接"],
    reason: "疑似包含诈骗、盗号或钓鱼内容",
  },
  {
    ruleId: "prohibited.black_market",
    category: "game_black_market",
    severity: "warning",
    terms: ["黑产", "代充", "外挂", "游戏币交易", "账号交易", "卖号", "收号"],
    reason: "疑似包含代充、外挂或游戏黑产内容",
  },
  {
    ruleId: "prohibited.redirection",
    category: "offsite_redirection",
    severity: "warning",
    terms: ["二维码", "扫码联系", "加微信", "加群"],
    reason: "疑似包含联系方式、二维码或站外引流",
  },
  {
    ruleId: "prohibited.spam",
    category: "spam_or_duplicate",
    severity: "warning",
    terms: ["垃圾广告", "机器灌水", "批量发帖"],
    reason: "疑似包含垃圾广告或机器灌水",
  },
  {
    ruleId: "prohibited.violence_hate",
    category: "violence_hate_harassment",
    severity: "warning",
    terms: ["暴力威胁", "仇恨言论", "人肉搜索"],
    reason: "疑似包含暴力、仇恨或骚扰内容",
  },
  {
    ruleId: "prohibited.politics",
    category: "politics",
    severity: "warning",
    terms: [
      "政治",
      "政治人物",
      "政治组织",
      "政治党派",
      "政治运动",
      "政治宣传",
      "选举",
      "领土争议",
      "国际政治",
    ],
    reason: "疑似包含现实政治相关内容",
  },
];

export function normalizeForModeration(value: string): string {
  return value
    .normalize("NFKC")
    .replace(invisibleCharacters, "")
    .replace(/\s+/gu, " ")
    .trim()
    .toLowerCase();
}

function compact(value: string): string {
  return value.replace(/[\s·•._\-—]+/gu, "");
}

function excerptAround(value: string, index: number, termLength: number): string {
  const start = Math.max(0, index - 16);
  const end = Math.min(value.length, index + termLength + 16);
  return value.slice(start, end);
}

function keywordMatches(
  field: "title" | "body" | "combined",
  value: string,
): RuleMatch[] {
  const matches: RuleMatch[] = [];
  const compactValue = compact(value);
  for (const rule of keywordRules) {
    for (const term of rule.terms) {
      const normalizedTerm = normalizeForModeration(term);
      const directIndex = value.indexOf(normalizedTerm);
      const compactIndex = compactValue.indexOf(compact(normalizedTerm));
      if (directIndex >= 0 || compactIndex >= 0) {
        matches.push({
          ruleId: rule.ruleId,
          category: rule.category,
          severity: rule.severity,
          field,
          excerpt:
            directIndex >= 0
              ? excerptAround(value, directIndex, normalizedTerm.length)
              : term,
          reason: rule.reason,
        });
        break;
      }
    }
  }
  return matches;
}

function patternMatches(
  field: "title" | "body",
  value: string,
): RuleMatch[] {
  const matches: RuleMatch[] = [];

  for (const result of value.matchAll(urlPattern)) {
    matches.push({
      ruleId: "redirect.url",
      category: "offsite_redirection",
      severity: "warning",
      field,
      excerpt: result[0].slice(0, 80),
      reason: "包含站外链接，需要人工确认是否属于引流或钓鱼",
    });
  }
  for (const result of value.matchAll(contactPattern)) {
    matches.push({
      ruleId: "redirect.contact",
      category: "offsite_redirection",
      severity: "critical",
      field,
      excerpt: result[0].slice(0, 80),
      reason: "疑似包含站外联系方式或群聊引流",
    });
  }
  for (const result of value.matchAll(phonePattern)) {
    matches.push({
      ruleId: "redirect.phone",
      category: "offsite_redirection",
      severity: "critical",
      field,
      excerpt: result[0],
      reason: "疑似包含手机号码",
    });
  }
  for (const result of value.matchAll(repeatedCharacterPattern)) {
    matches.push({
      ruleId: "spam.repeated_character",
      category: "spam_or_duplicate",
      severity: "warning",
      field,
      excerpt: result[0].slice(0, 40),
      reason: "包含异常连续重复字符",
    });
  }
  return matches;
}

export function evaluateTextRules(input: {
  title: string;
  body: string;
  duplicate?: boolean;
}): RuleResult {
  const normalizedTitle = normalizeForModeration(input.title);
  const normalizedBody = normalizeForModeration(input.body);
  const matches: RuleMatch[] = [
    ...keywordMatches("title", normalizedTitle),
    ...keywordMatches("body", normalizedBody),
    ...patternMatches("title", normalizedTitle),
    ...patternMatches("body", normalizedBody),
  ];
  const combinedKeywordMatches = keywordMatches(
    "combined",
    `${normalizedTitle}\n${normalizedBody}`,
  );
  for (const match of combinedKeywordMatches) {
    if (!matches.some((existing) => existing.ruleId === match.ruleId)) {
      matches.push(match);
    }
  }

  const originalCombined = `${input.title}\n${input.body}`;
  if (invisibleCharacters.test(originalCombined)) {
    invisibleCharacters.lastIndex = 0;
    matches.push({
      ruleId: "evasion.invisible_characters",
      category: "moderation_evasion",
      severity: "critical",
      field: "combined",
      excerpt: "检测到不可见字符",
      reason: "内容包含零宽或不可见控制字符",
    });
  }
  invisibleCharacters.lastIndex = 0;

  if (input.duplicate) {
    matches.push({
      ruleId: "spam.duplicate_content",
      category: "spam_or_duplicate",
      severity: "warning",
      field: "metadata",
      excerpt: "内容指纹与已有投稿重复",
      reason: "疑似重复投稿或跨帖复制",
    });
  }

  const riskLevel = matches.some((match) => match.severity === "critical")
    ? "critical"
    : matches.length > 0
      ? "warning"
      : "clear";

  return {
    riskLevel,
    matches,
    normalizedTitle,
    normalizedBody,
  };
}
