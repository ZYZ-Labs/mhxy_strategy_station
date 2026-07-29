# Agent Context

## 当前主任务

- 设计并实现一个部署到 Cloudflare Workers 的梦幻西游攻略与交流站。
- 当前阶段：第一期 MVP 本地实现与验收完成；Cloudflare 远端联调因环境未配置
  `CLOUDFLARE_API_TOKEN` 尚未执行；源码已推送到 GitHub `master`。

## 已确认边界

- 第一期只支持纯文本，不接入 R2，不允许图片或附件上传。
- 用户投稿先审后发；未通过审核的内容不能出现在公共页面、公共 API 或 MCP 中。
- 审核链路为：确定性规则预审、管理员人工终审。
- 规则只标记风险、生成证据并帮助审核队列排序，不自动发布或作最终驳回。
- 每篇投稿均需管理员人工决定通过或驳回，不接入 AI 内容审核。
- 禁止色情招嫖、赌博博彩、代充资金盘、毒品违禁品、诈骗盗号钓鱼、
  游戏币或账号黑产、站外联系方式引流、暴力仇恨骚扰、垃圾广告与灌水、
  重复内容、与梦幻西游无关的内容、规避审核内容及政治相关内容。
- MCP 第一阶段只读，只返回已发布内容。
- 第一期只实现纯文本攻略投稿，不实现主题帖、回复、评论、点赞或私信。
- 注册默认开放，默认每新增 100 名非超管用户自动切换为仅邀请码；超管可修改步长、
  手动开关，并配置一次性或每周定时开放窗口。
- 定时窗口可选择是否受人数阈值约束；不受约束时持续开放到窗口结束，之后按当前人数
  重新计算下一阈值。
- 权限采用 `member | admin | super_admin` 三级角色，数据库中最多一个超管。
- 空数据库首次初始化必须使用 `BOOTSTRAP_TOKEN` 创建唯一超管；管理员不能授予角色、
  禁用、降级或删除超管，只有超管可以授予或撤销管理员。
- 政治相关内容采用审核政策中的宽口径，歧义项由人工终审。
- 技术基线确认为 TypeScript、React Router、Cloudflare Vite Plugin、Workers、
  D1 和 Wrangler。
- `ai_engineer_toolbox` 仅用于参考 Wrangler、Workers、D1 绑定和部署经验。
- 开发完成并验证后提交、推送到
  `https://github.com/ZYZ-Labs/mhxy_strategy_station.git` 的 `master` 分支。

## 当前入口

- Worker：`workers/app.ts`
- 路由：`app/routes.ts`
- D1 migration：`migrations/0001_initial.sql`
- MCP：`app/mcp/server.ts`
- Worker 部署：`npm run worker:deploy`；`npm run deploy` 为兼容别名。
- 架构：`docs/guides/GUIDE-20260728-project-architecture-v1.md`
- 运行与接口：`docs/guides/GUIDE-20260729-operations-and-interface-v1.md`
- 审核政策：`docs/guides/GUIDE-20260728-content-moderation-policy-v1.md`
- 计划：`docs/plans/PLAN-20260728-mvp-v1.md`
- 进度：`docs/progress/PROGRESS-20260728-mvp-v1.md`
- 本地验收报告：`docs/reports/REPORT-20260729-local-acceptance-v1.md`

## 当前风险

- 尚无真实、脱敏且已标注的审核样本，不能验证规则的召回和误判情况。
- 超管转移与灾难恢复尚未纳入第一期普通管理流程，需要后续专项设计。
- 尚未用真实攻略样本完成“投稿 → 规则预审 → 人工批准/退回 → MCP 可见性”浏览器验收，
  不能声称规则召回率或误判率。
- 当前环境 Wrangler 未登录且无 `CLOUDFLARE_API_TOKEN`，不能创建/迁移远端 D1、
  写入 `BOOTSTRAP_TOKEN` 或部署生产 Worker。
- GitHub `ZYZ-Labs/mhxy_strategy_station` 的远端初始 Apache-2.0 `LICENSE` 已保留，
  本地 `master` 已与远端同步。
