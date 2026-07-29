import { ProhibitedNotice } from "~/components/prohibited-notice";

export function meta() {
  return [{ title: "发布规则｜梦幻策略站" }];
}

export default function Rules() {
  return (
    <section className="page-shell">
      <header className="page-heading">
        <p className="eyebrow">PUBLISHING POLICY</p>
        <h1>先保证内容可信，再谈规模</h1>
        <p>规则预审只负责标记风险，不能批准发布；所有投稿最终都由管理员人工决定。</p>
      </header>
      <ProhibitedNotice compact />
      <div className="panel">
        <h2>审核流程</h2>
        <p>保存草稿 → 作者提交 → 确定性规则预审 → 人工审核 → 批准发布或退回修改。</p>
        <p>图片、附件、评论、私信和论坛回帖不在第一期范围内。</p>
      </div>
    </section>
  );
}
