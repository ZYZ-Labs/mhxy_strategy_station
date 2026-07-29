# PROGRESS-20260728 梦幻西游攻略站第一期 v1

## 当前状态

- 生产 500 根因修复已推送：部署命令现会在发布前执行远端 D1 migration。
  `https://mhxy.silvericekey.fun/` 仍待认证环境执行新部署；当前 `/` 和 `/rules`
  返回 500，`/api/health` 返回 200。
- 第一期 MVP 已完成本地开发和基础验收。
- 已确认纯文本、先审后发、规则预审 + 人工终审。
- 已确认不接入 AI 内容审核，不使用置信度阈值，不自动发布或自动作最终驳回。
- 已确认禁止政治相关内容。
- 已确认第一期不使用 R2，不实现图片或附件。
- 已确认只实现纯文本攻略投稿，不实现主题帖、回复、评论、点赞或私信。
- 已确认管理员人工终审。
- 已确认注册默认开放、每新增 100 名非超管用户自动转为仅邀请码；超管可修改阈值、
  手动开关并配置一次性或每周定时开放窗口及其阈值约束。
- 已确认普通用户、管理员、唯一超管三级权限；空数据库使用 `BOOTSTRAP_TOKEN`
  初始化唯一超管，管理员角色仅由超管授予或撤销。
- 已确认 TypeScript、React Router、Cloudflare Vite Plugin、Workers、D1 和
  Wrangler 技术基线。
- 已实现 23 个 React Router 路由、D1 初始 migration、账号与会话、唯一超管、
  阈值/定时注册、攻略修订、规则预审、人工终审、管理员后台和只读 MCP。
- 本地 D1 migration、17 条单元测试、lint、typecheck、生产构建和 Wrangler
  dry-run 均通过。
- 首页、注册、初始化和健康检查 HTTP 验收通过；MCP `initialize` 与 `tools/list`
  响应通过；首页 1440×1100 Chrome 截图人工检查通过。
- 源码、migration、测试和文档已提交并推送到
  `https://github.com/ZYZ-Labs/mhxy_strategy_station.git` 的 `master`；远端原有
  Apache-2.0 `LICENSE` 已安全合并保留。
- `npm run worker:deploy` 已调整为“生产构建 → 远端 D1 migration → Wrangler
  部署”；`worker:deploy:dry-run` 用于不连接远端的检查，原 `deploy` 保留兼容。

## 最近关键结论

- 500 只发生在访问 D1 的页面链路；纯 Worker 健康接口正常。部署产物已上线，
  但现有 `worker:deploy` 只构建和部署，没有执行 `db:migrate:remote`。
- 修复边界限定为部署顺序：构建 → 远端 D1 migration → Wrangler 部署，并增加
  独立 dry-run 命令；不通过吞掉数据库错误掩盖未迁移 schema。
- 公共页面、API 和 MCP 只能读取已发布内容。
- 规则异常必须失败关闭，内容保持待审核。
- 已发布内容编辑后，新修订通过审核前继续展示旧修订。
- 规则效果必须通过真实标注样本验证，不能凭空宣称准确率。
- 参考项目只用于 Wrangler、Workers 和 D1 部署经验。
- 远端 `ZYZ-Labs/mhxy_strategy_station` 已确认是空仓库，默认分支为 `master`，
  当前连接具备 push 权限；开发完成后提交并推送到该分支。

## 下一步

1. 获得 Cloudflare API Token 后创建/绑定项目专属 D1、执行远端 migration、
   配置 `BOOTSTRAP_TOKEN` 并部署。
2. 由用户提供真实攻略验收样本和首个超管凭据后，执行完整投稿审核回放。
3. 生产部署后补充线上联调报告。

## 阻塞项

- 尚无真实审核样本和首个超管凭据。
- Wrangler 未认证：`wrangler whoami` 明确返回未登录，且环境没有
  `CLOUDFLARE_API_TOKEN`；本地无法代为执行生产 migration、查看日志或重新部署。
- GitHub 仓库没有 Actions workflow 和 Cloudflare repository secrets，无法从
  GitHub 自动完成生产恢复。

## 未证实风险

- 中文游戏语境、谐音和黑话可能造成政治、赌博、交易类规则误判。
- 中文规避表达不断变化，纯规则只能辅助人工，不能替代人工判断。
- Cloudflare 生产账号、D1、域名和 secrets 尚未联调。
- D1 并发边界依赖条件写入、batch 和唯一约束，尚未在生产 D1 压测。
