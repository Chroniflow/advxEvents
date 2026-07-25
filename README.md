# ADVX轶事

参赛者轶事档案：React 前端、Cloudflare Workers API、Workers KV 用户与投稿记录、R2 图片、SQLite-backed Durable Objects 点赞与热门排行。

## 本地预览

只预览前端视觉和内置开发示例：

```bash
npm install
npm run dev:client
```

完整 Worker 本地环境：

```bash
cp .dev.vars.example .dev.vars
# 填写 GitHub OAuth 开发应用信息和随机 SESSION_SECRET
npm run dev
```

完整环境运行在 `http://localhost:8787`，GitHub OAuth 回调为：

```text
http://localhost:8787/api/auth/github/callback
```

## Cloudflare 资源

登录并创建生产资源：

```bash
npx wrangler login
npx wrangler kv namespace create CONTENT
npx wrangler r2 bucket create advx-anecdotes-media
npx wrangler secret put GITHUB_CLIENT_SECRET
npx wrangler secret put SESSION_SECRET
```

将 KV 命令返回的 ID 替换 `wrangler.jsonc` 中的全零占位 ID。生产环境还需要：

- 将 `APP_ORIGIN` 改为最终 HTTPS 站点地址。
- 将 `GITHUB_CLIENT_ID` 配置为 Worker 变量。
- 在 GitHub OAuth App 中将回调设置为 `<APP_ORIGIN>/api/auth/github/callback`。
- 保留 `ADMIN_GITHUB_USERS=icebraker`，或用逗号加入其他不可降级的引导管理员。

GitHub Client Secret 和 Session Secret 只能通过 Wrangler secret 或 `.dev.vars` 提供，不应写入仓库。

## 验证

```bash
npm test
npm run build
npm run test:e2e
npx wrangler deploy --dry-run
```

## 部署

```bash
npm run deploy
```

Durable Objects 可在 Workers Free 计划使用 SQLite 存储。免费额度耗尽时相关操作会失败，不会自动产生账单；画廊会在热门排行不可用时回退到最新排序。

## 权限

- `ANONYMOUS`：仅浏览公开内容。
- `USER`：投稿、管理自己的草稿、点赞。
- `STAFF`：审核、拒绝、下架和恢复内容。
- `ADMIN`：管理角色和整个站点。

`ADMIN_GITHUB_USERS` 中的账号始终解析为 `ADMIN`，后台无法将其降级。

## 数据清理

- 删除故事前，先下架公开修订，再删除相应 KV 修订与索引键。
- 只有未公开的 R2 图片可以通过现有上传 API 删除。
- 生产运维删除公开图片时，应先确认没有已发布修订引用对应 `assetId`。
