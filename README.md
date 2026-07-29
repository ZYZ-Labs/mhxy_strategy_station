# 梦幻西游攻略站

面向梦幻西游玩家的中文攻略与交流站。项目计划部署到 Cloudflare Workers，使用 Wrangler
完成本地开发、资源绑定、数据库迁移和生产部署，并向 AI 客户端提供只读 MCP 能力。

## 当前阶段

第一期 MVP 已完成本地实现与验证，包含公开攻略、账号与唯一超管、阈值/定时注册、
纯文本投稿、规则预审、人工终审、管理后台和只读 MCP。

第一期已确认的核心边界：

- 只支持纯文本内容，不开放图片或附件上传。
- 所有用户投稿必须经过发布前审核，只有 `published` 内容对外可见。
- 审核采用“确定性规则预审 + 人工终审”。
- 规则只提供风险标记、排序和证据，不自动发布或作最终驳回。
- 每一篇投稿都必须由管理员人工决定通过或驳回。
- 权限分为普通用户、管理员和唯一超管；只有超管可以授予或撤销管理员权限。
- 空数据库首次初始化通过受 `BOOTSTRAP_TOKEN` 保护的入口创建唯一超管。
- 注册默认开放；默认每新增 100 名非超管用户自动切换为仅邀请码，超管可调整阈值、
  手动开关注册并配置一次性或每周定时开放窗口。
- MCP 第一阶段只读取已经发布的内容，不提供发布、修改或删除能力。

详细范围、架构和审核政策见：

- [项目架构草案](docs/guides/GUIDE-20260728-project-architecture-v1.md)
- [内容审核政策草案](docs/guides/GUIDE-20260728-content-moderation-policy-v1.md)
- [第一期实施计划](docs/plans/PLAN-20260728-mvp-v1.md)
- [当前进度](docs/progress/PROGRESS-20260728-mvp-v1.md)

## 技术基线

- TypeScript
- React Router 全栈 SSR
- Cloudflare Workers + Cloudflare Vite Plugin
- Cloudflare D1
- Wrangler

## 本地运行

```bash
npm install
npm run db:migrate:local
npm run dev
```

首次初始化前需要配置 Worker Secret `BOOTSTRAP_TOKEN`。空数据库访问 `/setup`，
使用该密钥创建唯一超管；数据库已有任意用户后，此入口永久拒绝再次初始化。

常用验证：

```bash
npm run check
```

部署 Worker：

```bash
npm run worker:deploy
```

该脚本会先执行生产构建，再调用 Wrangler 部署；`npm run deploy` 是兼容别名。

MCP Streamable HTTP 入口为 `/mcp`，工具固定为：

- `list_published_guides`
- `search_published_guides`
- `get_published_guide`

部署和接口说明见
[运行与接口指南](docs/guides/GUIDE-20260729-operations-and-interface-v1.md)。
