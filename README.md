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
# 填写 GitHub OAuth 开发应用信息、管理员账号和随机 SESSION_SECRET
npm run dev
```

完整环境运行在 `http://localhost:8787`，GitHub OAuth 回调为：

```text
http://localhost:8787/api/auth/github/callback
```

## 通过 Cloudflare Dashboard 部署

仓库中的 `wrangler.jsonc` 只描述 Worker 入口和绑定契约，不包含部署者的资源 ID、桶名、账号或密钥。部署时不需要编辑仓库。

1. 在 Cloudflare Dashboard 的 **Workers & Pages** 中导入 GitHub 仓库并选择生产分支。
2. 将构建命令设为 `npm run build`，部署命令设为 `npx wrangler deploy`。
3. 执行首次部署。Wrangler 会为草稿绑定自动配置 `CONTENT` KV 和 `MEDIA` R2；如需复用已有资源，可预先创建资源，并在 Worker 设置中确认同名绑定指向目标资源。
4. 打开 Worker 的 **Settings > Variables and Secrets**，按下表添加运行时配置并部署这些设置。
5. 在 GitHub OAuth App 中将回调地址设置为 `<APP_ORIGIN>/api/auth/github/callback`。

| 类型 | 名称 | 值 |
| --- | --- | --- |
| Variable | `GITHUB_CLIENT_ID` | GitHub OAuth App 客户端 ID |
| Variable | `ADMIN_GITHUB_USERS` | 逗号分隔的引导管理员 GitHub 登录名 |
| Variable | `APP_ORIGIN` | Worker 的公开 HTTPS Origin，不含末尾斜杠 |
| Secret | `GITHUB_CLIENT_SECRET` | GitHub OAuth App 客户端密钥 |
| Secret | `SESSION_SECRET` | 至少 32 个随机字符的会话签名密钥 |

Worker 使用以下固定绑定名：

| 绑定名 | 资源 | 用途 |
| --- | --- | --- |
| `CONTENT` | Workers KV | 用户、会话、投稿、审核与资源元数据 |
| `MEDIA` | R2 | 投稿图片对象 |
| `LIKES` | Durable Object | 点赞账本与热门排行 |
| `ASSETS` | Workers Static Assets | Vite 前端构建产物 |

Workers Builds 中的构建变量只在构建期间可用，不会注入 Worker 运行时。上述变量和密钥必须添加到 Worker 的 **Variables and Secrets**，其中敏感值必须选择 **Secret** 类型。

## 验证

```bash
npm test
npm run build
npm run test:e2e
npx wrangler deploy --dry-run
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
