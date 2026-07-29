# GUIDE-20260728 项目架构草案 v1

> 状态：已于 2026-07-29 经用户确认。

## 1. 目标

构建一个现代、简约的梦幻西游攻略与交流站，并提供：

- 对搜索引擎友好的攻略列表、详情、分类和搜索页面。
- 纯文本用户投稿与发布前审核。
- 管理员审核队列和审核记录。
- 面向 AI 客户端的只读 MCP 查询入口。
- 基于 Wrangler 的本地开发、D1 migration、预览和 Workers 部署流程。

## 2. 第一期范围

### 2.1 包含

- 公开攻略列表、详情、分类、标签和文本搜索。
- 纯文本内容草稿、提交、审核、发布和驳回。
- 默认开放注册、阈值自动切换邀请码、定时开放窗口、用户登录和管理员登录。
- 空数据库首次初始化唯一超管，以及超管专属的用户与管理员权限管理。
- 确定性规则检查。
- 人工审核队列。
- 管理员登录和审核操作。
- 只读 MCP：搜索和读取已经发布的攻略内容。
- 审核、发布和管理员操作的审计记录。

### 2.2 不包含

- 图片、文件、视频或二维码上传。
- R2 资源绑定。
- MCP 写入、修改或删除工具。
- 私信、实时聊天、支付、打赏和交易撮合。
- 主题帖、公开回复、评论、点赞、关注或声望系统。

## 3. 技术基线

拟采用：

- TypeScript。
- React Router 全栈 SSR，兼顾内容 SEO 和后台动态能力。
- Cloudflare Vite Plugin，使本地服务端代码运行在 Workers 兼容环境。
- Cloudflare Workers 作为唯一生产运行入口。
- D1 保存账号、内容、审核状态和审计记录。
- Wrangler 作为开发、类型生成、migration、预览和部署入口。

第一期只保留一个权威 `wrangler.jsonc`。不复制参考项目中根目录与应用目录各自维护
Wrangler 配置的做法，避免绑定与部署目标漂移。

## 4. 模块边界

```text
app/routes
  公共页面、投稿页面、管理页面和 HTTP 路由适配

app/features/content
  草稿、提交、版本、发布状态和公开查询用例

app/features/moderation
  文本规范化、规则预审、风险排序和人工终审

app/features/auth
  普通用户、管理员、唯一超管、会话和权限检查

app/mcp
  MCP 协议适配，只调用公开内容查询用例

migrations + app/features/*/repository.server.ts
  D1 schema、migration 和按领域划分的 repository 实现

workers/app.ts
  Worker 请求入口和 Cloudflare bindings 注入
```

约束：

- Route 不直接写 SQL。
- Repository 不调用外部 HTTP。
- 规则预审和人工终审必须分离。
- MCP 不得绕过内容查询用例直接读取数据库。
- 公共查询必须在服务端固定附加 `status = published` 条件。

## 5. 权限矩阵与首次初始化

角色固定为：

| 能力 | 普通用户 | 管理员 | 唯一超管 |
| --- | --- | --- | --- |
| 管理自己的草稿和投稿 | 是 | 是 | 是 |
| 人工审核、通过或驳回内容 | 否 | 是 | 是 |
| 管理分类和邀请码 | 否 | 是 | 是 |
| 查看内容审核审计 | 否 | 是 | 是 |
| 禁用或恢复普通用户 | 否 | 否 | 是 |
| 授予或撤销管理员 | 否 | 否 | 是 |
| 查看安全与角色变更审计 | 否 | 否 | 是 |
| 修改注册模式、人数阈值和定时窗口 | 否 | 否 | 是 |

约束：

- 数据库通过唯一约束保证最多一个 `super_admin`。
- 当且仅当 `users` 表为空时，`/setup` 接受初始化请求。
- 初始化请求必须同时通过 `BOOTSTRAP_TOKEN` 校验，禁止“首个访客成为超管”。
- 超管不能被管理员降级、禁用或删除。
- 管理员角色只能由超管授予或撤销。
- 注册人数统计排除唯一超管，普通用户和管理员均计入人数。
- 默认开放注册，默认阈值步长为 100，达到阈值后自动切换为仅邀请码。
- 超管手动重新开放后，开放状态持续到下一个人数阈值；超管也可以随时手动关闭。
- 修改阈值步长时，下一阈值重新计算为严格大于当前非超管人数的下一个步长倍数。
- 定时开放支持一次性日期时间窗口和按星期重复窗口，统一使用 `Asia/Shanghai` 时区。
- 定时窗口结束后恢复窗口开始前的手动注册模式。
- 定时窗口可选择是否受人数阈值约束：受约束时达到阈值提前关闭；不受约束时持续开放
  到窗口结束，结束后依据当前人数重新计算下一阈值。
- 每次模式修改、阈值触发和定时策略变更必须写审计日志。
- 超管转移与灾难恢复不在普通管理操作中隐式完成；如后续实现，必须独立设计重新认证、
  原子转移和审计流程。

## 6. 核心状态机

```text
draft
  -> rule_checking
  -> manual_review
  -> published | rejected
```

状态约束：

- `draft` 仅作者本人和管理员可见。
- 提交时当前草稿版本锁定进入 `rule_checking`。
- 规则检查完成后，无论是否命中风险，均进入 `manual_review`。
- 规则只提供风险级别、命中位置和队列优先级，不作最终发布或驳回决定。
- 管理员批准动作以同一批 D1 写入记录决定、切换为 `published` 并更新公开指针；
  不保留可被其他请求观察到的中间 `approved` 状态。
- 已发布内容编辑时创建新修订；新修订审核通过前继续展示旧版本。
- 公共页面、API 和 MCP 只能读取 `published` 修订。

所有投稿都必须由管理员人工终审，不根据账号信誉开放自动发布。

## 7. 拟定数据职责

- `users`：账号、状态和 `member | admin | super_admin` 角色。
- `sessions`：登录会话。
- `registration_settings`：手动注册模式、阈值步长、下一阈值和默认时区。
- `registration_schedules`：一次性或每周定时开放窗口及阈值约束开关。
- `registration_events`：模式变更、阈值触发和定时窗口事件。
- `content_entries`：内容稳定标识、作者和当前公开修订。
- `content_revisions`：标题、正文、分类、状态和提交时间。
- `moderation_results`：规则命中、证据、风险级别和政策版本。
- `moderation_decisions`：人工最终决定、操作者和理由。
- `categories`：攻略分类；第一期标签以修订中的 JSON 数组保存。

具体字段、索引、外键、删除策略和 migration 在下一轮接口设计中确认。

## 8. 拟定入口契约

公共入口：

- `GET /guides`
- `GET /guides/:slug`
- `GET /search`

投稿入口：

- `GET|POST /dashboard/guides/new`
- `GET|POST /dashboard/guides/:entryId/edit`
- `GET|POST /dashboard/guides/:entryId/submit`
- `GET /api/submissions/:entryId/status`

管理入口：

- `GET|POST /setup`（仅空数据库且需要 `BOOTSTRAP_TOKEN`）
- `GET /admin/reviews`
- `GET|POST /admin/reviews/:revisionId`
- `GET|POST /admin/categories`
- `GET|POST /admin/invites`
- `GET /admin/users`
- `GET|POST /admin/registration`（仅超管）
- `GET|POST /admin/users`（仅超管）

MCP 只读工具：

- `list_published_guides`
- `search_published_guides`
- `get_published_guide`

所有错误码、请求体和响应体需要在编码前进一步形成接口契约。

## 9. 部署边界

从参考项目只吸收以下经验：

- 根目录统一 Wrangler 配置和脚本。
- Worker 入口负责绑定注入和请求分发。
- D1 使用 binding 访问。
- 本地与生产均由 Wrangler 管理。
- 构建后执行 `wrangler deploy`。

本项目改进项：

- 使用 `wrangler d1 migrations create/apply` 管理数据库版本。
- 本地、预览、生产数据库严格分离。
- migration 在具备连接和用户确认后由智能体实际执行，不只输出 SQL。
- 生产 secrets 仅通过 Wrangler 或 Cloudflare 配置，不写入仓库。
- 首次初始化前通过 `wrangler secret put BOOTSTRAP_TOKEN` 配置初始化密钥；超管创建成功后
  删除该 secret。

## 10. 验证矩阵

- 单元测试：文本规范化、每条规则和风险排序。
- 集成测试：提交到发布/驳回完整状态机。
- 权限测试：草稿、待审内容和审核证据不可被公共入口读取。
- 故障测试：规则预审异常时内容保持未发布，并清晰暴露错误。
- 回归测试：已发布内容编辑期间旧版本持续可见，新版本不泄漏。
- MCP 测试：只能搜索和读取已发布内容。
- 部署测试：本地 D1 migration、Worker 预览、生产部署和绑定检查。
- 权限测试：只能初始化一次超管；管理员不能授予角色、禁用超管或访问超管专属审计。
- 注册策略测试：第 100、200 名等边界自动关闭；超管、手动模式、一次性/每周窗口及
  “是否受阈值约束”组合符合优先级。
