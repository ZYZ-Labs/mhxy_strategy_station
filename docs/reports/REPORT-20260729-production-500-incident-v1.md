# REPORT-20260729 生产页面 500 事故 v1

## 背景

`https://mhxy.silvericekey.fun/` 上线后返回 HTTP 500。修复目标是定位根因并消除同类
部署遗漏，不以页面兜底或静默空数据掩盖数据库故障。

## 复现与证据

- `GET /`：500，React Router 服务端错误边界响应。
- `GET /rules`：500；该页面自身不查业务数据，但共享布局读取注册策略。
- `GET /api/health`：200；该独立路由不访问 D1。
- 线上静态资源 hash 与当前构建一致，证明 Worker 和 Assets 已成功部署。
- 当前 `worker:deploy` 为 `npm run build && wrangler deploy`，没有执行
  `db:migrate:remote`。
- 当前执行环境没有 Cloudflare 认证，不能读取生产日志或直接查询远端
  `sqlite_master`。

## 根因判断

故障边界位于 D1 访问，不在 Worker 启动、域名、TLS、静态资源或 React Router
通用请求处理。部署流程未同步 D1 migration，页面布局读取 `users` 和
`registration_settings` 时遇到未初始化 schema，从而进入 500 错误边界。

这是由外部响应差异和仓库部署命令共同支持的根因结论；获得 Cloudflare 认证后仍需通过
远端 migration 列表和表结构查询补齐生产侧直接证据。

## 修复方案

- `worker:deploy` 固定为：生产构建 → `db:migrate:remote` → `wrangler deploy`。
- 新增 `worker:deploy:dry-run`，只构建并执行 Wrangler dry-run，不连接远端 D1。
- 更新 README、运行指南、计划、进度和交接上下文。
- 本地执行全量检查和 dry-run，随后提交推送。

## 生产恢复步骤

在具备 `CLOUDFLARE_API_TOKEN` 的环境拉取修复后执行：

```bash
npm run worker:deploy
```

然后验证 `/api/health`、`/rules`、`/`、`/register`、`/setup` 和 MCP。

## 剩余风险

- 本地环境无法直接完成生产 migration 和部署，线上恢复状态必须在认证环境执行后确认。
- 修复推送后连续 6 次检查 `/` 仍为 500；GitHub 仓库没有 Actions workflow 或
  Cloudflare repository secrets，确认没有自动恢复通道。
- 若远端实际问题是 D1 binding 指向错误数据库，而非空 schema，需要根据远端绑定和
  `sqlite_master` 结果纠正 `database_id`，不得迁移其他项目数据库。
