# REPORT-20260729 PBKDF2 Workers 兼容修复 v1

## 背景

生产 `/setup` 创建唯一超管时返回：

```text
Pbkdf2 failed: iteration counts above 100000 are not supported (requested 600000)
```

## 根因

`app/features/auth/password.server.ts` 请求 Web Crypto 执行 PBKDF2-SHA256 600,000
次，超过当前 Cloudflare Workers 实际支持的 100,000 次上限。`0001_initial.sql`
同时要求数据库字段至少为 600,000，因此代码和 schema 必须一起迁移。

## 修复边界

- 新密码固定使用 PBKDF2-SHA256 100,000 次、16 字节随机盐和 256 位输出。
- 保留至少 12 位密码策略、登录失败锁定和常量时间比较。
- 不修改已经可能应用的 `0001_initial.sql`。
- 新增 `0002_pbkdf2_workers_compatibility.sql`，在 `users` 为空时重建迭代次数
  约束和原有索引。
- 迁移复制时只接受 `password_iterations = 100000`；如果数据库存在无法在 Workers
  验证的旧 600,000 次账户，迁移失败并要求单独执行密码重置，不伪造或改写哈希参数。
- 使用 D1 支持的 `PRAGMA defer_foreign_keys`。迁移先创建新表并复制；任何旧
  600,000 次账户都会在删除旧表前使复制失败并回滚。复制成功代表 `users` 为空，
  此时才替换表并执行 `foreign_key_check`。

禁止采用“先重命名旧 `users`”方案：本地 D1 实测会把 `sessions` 等子表外键改写为
旧表名，即使启用 `legacy_alter_table` 也不能阻止，最终会留下失效外键。

## 验证结果

- 新增 3 条密码测试，覆盖 100,000 次参数、正确/错误密码验证和至少 12 位密码策略。
- 全新隔离本地 D1 连续应用 `0001`（38 条命令）与 `0002`（11 条命令）成功。
- 最终 `users` 约束为 `password_iterations = 100000`。
- `PRAGMA foreign_key_check` 无结果；`sessions`、`content_entries` 外键仍指向
  `users`；用户名、状态角色和唯一超管索引均存在。
- `npm run check` 通过：ESLint、TypeScript、20/20 Vitest、React Router
  生产构建和 Wrangler dry-run 均成功。

未执行生产 migration、部署和 `/setup` 联调：当前环境 `wrangler whoami` 未认证，
且没有 `CLOUDFLARE_API_TOKEN`。

## 结论

根因已在代码和 schema 两侧消除，本地升级路径不会损坏子表外键。生产是否恢复仍以
应用 `0002`、部署新 Worker 并实际完成一次 `/setup` 为准。

## 生产恢复

在具备 Cloudflare 凭据的环境执行 `npm run worker:deploy`，再访问 `/setup`。此前
异常发生在 INSERT 之前，正常情况下不会留下半个超管账户；仍应先确认 `users` 为空。
