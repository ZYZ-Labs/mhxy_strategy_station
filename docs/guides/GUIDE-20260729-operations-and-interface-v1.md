# GUIDE-20260729 运行与接口 v1

## 1. 本地运行

```bash
npm install
npm run db:migrate:local
npm run dev
```

权威配置只有根目录 `wrangler.jsonc`。D1 binding 固定为 `DB`，migration 位于
`migrations/`。不得把真实 secret 写入 `.dev.vars`、源码或提交记录。

## 2. 首次初始化

1. 在 Worker 环境配置 `BOOTSTRAP_TOKEN`。
2. 确认 D1 `users` 表为空。
3. 访问 `GET /setup`，提交 token、用户名、显示名和至少 12 位密码。
4. 服务端同时校验 token 和空库条件，创建数据库中唯一的 `super_admin`。
5. 初始化完成后删除生产 `BOOTSTRAP_TOKEN`。

任何用户已存在时均不能再次初始化。超管不能通过普通用户管理入口降级或停用。

## 3. 注册优先级

1. 活跃且不受阈值约束的定时窗口：开放到窗口结束。
2. 活跃且受阈值约束的定时窗口：未触发阈值时开放。
3. 触发人数阈值：邀请码制。
4. 其余情况使用超管设置的手动模式。

人数统计排除超管，包含普通成员和管理员。默认步长 100。超管手动调整模式或步长时，
下一阈值重算为严格大于当前人数的下一个步长倍数。一次性窗口输入按
`Asia/Shanghai` 解释，每周窗口也按该时区实时计算，无需 Cron 才能在过期后关闭。

## 4. HTTP 入口

- 公共：`/`、`/guides`、`/guides/:slug`、`/search`、`/rules`
- 账号：`/setup`、`/login`、`/register`、`/logout`
- 作者：`/dashboard`、`/dashboard/guides/*`
- 管理员：`/admin/reviews/*`、`/admin/categories`、`/admin/invites`
- 仅超管：`/admin/users`、`/admin/registration`
- 状态：`/api/health`、`/api/submissions/:entryId/status`

所有变更请求经过同源校验；所有权限在服务端 action 再校验。公共攻略查询 SQL 固定连接
当前公开修订并限定 `published`。

## 5. MCP

入口：`POST /mcp`，Stateless Streamable HTTP。

- `list_published_guides(limit=20)`：列出最近公开攻略摘要。
- `search_published_guides(query, limit=20)`：搜索已发布攻略。
- `get_published_guide(slug)`：读取一篇公开攻略全文。

三个工具均只读，共用公共查询 repository，没有草稿、审核记录或管理写入口。

## 6. 生产部署

```bash
npm run check
npx wrangler whoami
npx wrangler d1 create mhxy-strategy-station
npx wrangler d1 migrations apply mhxy-strategy-station --remote
npx wrangler secret put BOOTSTRAP_TOKEN
npm run deploy
```

创建 D1 后按 Wrangler 返回值把实际 `database_id` 写入 `wrangler.jsonc`，再执行远端
migration。部署后验证 `/api/health`、`/register`、`/setup` 和 `/mcp`，并单独留下
生产联调报告。
