import { describe, expect, it } from "vitest";

import { evaluateTextRules } from "~/features/moderation/rules";

describe("deterministic moderation rules", () => {
  it.each([
    ["色情和招嫖", "sexual_content"],
    ["赌博、博彩和资金盘", "gambling"],
    ["毒品和违禁品", "illegal_goods"],
    ["诈骗、盗号、钓鱼链接", "fraud_or_phishing"],
    ["游戏账号黑产和代充", "game_black_market"],
    ["展示二维码并加微信", "offsite_redirection"],
    ["垃圾广告和机器灌水", "spam_or_duplicate"],
    ["暴力威胁和仇恨言论", "violence_hate_harassment"],
    ["政治相关内容", "politics"],
  ] as const)("marks prohibited text %s", (body, category) => {
    const result = evaluateTextRules({ title: "规则说明", body, duplicate: false });
    expect(result.matches.some((match) => match.category === category)).toBe(true);
  });

  it("marks URLs, contacts and duplicate content", () => {
    const result = evaluateTextRules({
      title: "站外引流",
      body: "加微信 vx:abcde，并访问 https://example.com",
      duplicate: true,
    });
    expect(result.matches.map((match) => match.category)).toContain("offsite_redirection");
    expect(result.matches.map((match) => match.category)).toContain("spam_or_duplicate");
  });

  it("never returns an approval decision", () => {
    const result = evaluateTextRules({
      title: "梦幻西游攻略",
      body: "这是正常文本。",
      duplicate: false,
    });
    expect(result).not.toHaveProperty("decision");
  });

  it("detects prohibited terms split between title and body", () => {
    const result = evaluateTextRules({
      title: "赌",
      body: "博",
      duplicate: false,
    });
    expect(result.matches.some((match) => match.category === "gambling")).toBe(true);
  });
});
