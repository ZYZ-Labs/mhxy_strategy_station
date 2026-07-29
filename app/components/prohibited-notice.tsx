export const prohibitedItems = [
  "色情、淫秽内容和招嫖",
  "赌博、博彩、代充和资金盘",
  "毒品和违禁品",
  "诈骗、盗号和钓鱼链接",
  "游戏币、账号、外挂等黑产广告",
  "联系方式、群号和站外引流",
  "暴力、仇恨、歧视、威胁和骚扰",
  "垃圾广告、机器灌水和重复内容",
  "与梦幻西游无关的内容",
  "拆字、谐音、编码或其他规避审核内容",
  "现实政治相关内容",
] as const;

export function ProhibitedNotice({ compact = false }: { compact?: boolean }) {
  return (
    <aside className={`policy-notice${compact ? " policy-notice-compact" : ""}`}>
      <div>
        <p className="eyebrow">发布前请确认</p>
        <h2>本站坚持人工审核，以下内容禁止发布</h2>
        <p>
          规则预审只负责标记风险，每一篇投稿都由管理员人工终审。未通过审核的内容不会出现在站点或 MCP 中。
        </p>
      </div>
      <ul>
        {prohibitedItems.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </aside>
  );
}
