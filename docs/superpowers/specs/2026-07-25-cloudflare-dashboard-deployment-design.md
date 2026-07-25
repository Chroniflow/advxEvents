# Cloudflare Dashboard 开源部署设计

## 背景与目标

本项目已经使用 Cloudflare Workers 运行 Hono API，并通过 Workers Static Assets 托管 Vite 构建产物。运行时依赖 Workers KV、R2、SQLite-backed Durable Objects、普通环境变量和加密密钥。

本次改造的目标是让开源部署者通过 Cloudflare Dashboard 连接 GitHub 仓库后完成部署，不需要修改或提交任何仓库文件。仓库内保留一份与账号无关的通用 `wrangler.jsonc`，它只描述应用入口、绑定契约和 Durable Object 迁移，不保存 Cloudflare 资源 ID、R2 桶名、站点地址、账号名或密钥。

## 方案选择

采用通用“草稿绑定”方案：

- KV 只声明绑定名 `CONTENT`，不声明命名空间 ID。
- R2 只声明绑定名 `MEDIA`，不声明桶名。
- 保留静态资源绑定 `ASSETS`。
- 保留 Durable Object 绑定 `LIKES`、类名 `LikeDirectory` 和现有 SQLite 迁移。
- 开启 `keep_vars`，避免 Workers Builds 部署时删除 Dashboard 中维护的运行时变量。
- 从 `vars` 中移除所有实例值。

Wrangler 首次部署时可自动配置缺失的 KV/R2 资源。高级用户也可以先在 Dashboard 创建资源并使用相同绑定名，部署时沿用远端配置。相比构建时生成临时配置，这一方案没有额外脚本，也不会让部署者维护资源 ID。

## 配置边界

### 仓库内通用配置

`wrangler.jsonc` 负责：

- Worker 名称与 TypeScript 入口；
- 兼容日期；
- Vite 构建产物和 `ASSETS` 绑定；
- `CONTENT`、`MEDIA`、`LIKES` 的稳定绑定名；
- Durable Object 类迁移；
- 保留 Dashboard 运行时变量。

配置不得包含：

- KV namespace ID 或 preview ID；
- R2 bucket name 或 preview bucket name；
- GitHub OAuth 凭据；
- Session 密钥；
- 部署域名；
- 部署者的 GitHub 管理员账号。

### Dashboard 运行时配置

部署者在 Worker 的 **Settings > Variables and Secrets** 中配置：

| 类型 | 名称 | 用途 |
| --- | --- | --- |
| 普通变量 | `GITHUB_CLIENT_ID` | GitHub OAuth App 客户端 ID |
| 普通变量 | `ADMIN_GITHUB_USERS` | 逗号分隔的引导管理员 GitHub 登录名 |
| 普通变量 | `APP_ORIGIN` | Worker 的公开 HTTPS Origin，不含末尾斜杠 |
| Secret | `GITHUB_CLIENT_SECRET` | GitHub OAuth App 客户端密钥 |
| Secret | `SESSION_SECRET` | 至少 32 个随机字符的会话签名密钥 |

部署者在 Worker 的绑定设置中确认以下资源：

| 绑定名 | Cloudflare 资源 | 用途 |
| --- | --- | --- |
| `CONTENT` | Workers KV | 用户、会话、投稿、审核与资源元数据 |
| `MEDIA` | R2 | 投稿图片对象 |
| `LIKES` | Durable Object | 点赞账本与热门排行 |

## 部署流程

1. 部署者 Fork 或选择 GitHub 仓库，并在 Cloudflare Workers & Pages 中导入该仓库。
2. Workers Builds 使用 `npm run build` 构建前端和执行 TypeScript 检查。
3. Workers Builds 使用 `npx wrangler deploy` 部署 Worker、静态资源和 Durable Object 迁移。
4. 首次部署自动配置缺失的 KV/R2 资源；若部署者已预建资源，则在 Dashboard 确认同名绑定指向目标资源。
5. 部署者在 Dashboard 添加普通变量和 Secrets，再部署设置变更。
6. 部署者将 GitHub OAuth App 回调地址设置为 `<APP_ORIGIN>/api/auth/github/callback`。
7. 后续 Git 推送自动构建和部署，Dashboard 变量由 `keep_vars` 保留。

README 需要明确：Workers Builds 中的构建变量只在构建期间可用，不能替代 Worker Settings 中的运行时变量。

## 代码与类型

现有 `Env` 接口已经覆盖全部运行时绑定，Hono 通过 `context.env` 注入依赖，符合 Workers ES modules 模式。本次不改变数据访问层和路由层。

实现阶段应评估是否使用 `wrangler types` 校验或生成绑定类型。若生成文件会与 Dashboard 实例值耦合，则保留手写 `Env`，仅通过编译和配置检查验证绑定名一致。

## 错误处理与运维提示

本次不改变现有 API 错误响应。部署文档必须列出以下可诊断问题：

- 缺少 `CONTENT`、`MEDIA` 或 `LIKES` 时，对应 API 会因绑定不可用而失败；
- 缺少 OAuth 变量或 Secret 时，GitHub 登录流程无法完成；
- `APP_ORIGIN` 与实际 HTTPS Origin 不一致时，OAuth 回调或安全 Cookie 会异常；
- `SESSION_SECRET` 长度不足不应作为有效生产配置；
- 构建变量与运行时变量属于不同作用域，必须在 Worker Settings 中设置运行时值。

README 不包含真实凭据或账号专属示例值，示例统一使用占位说明。

## 验证策略

实现完成后执行：

```bash
npm test
npm run build
npx wrangler deploy --dry-run
```

另外检查：

- `wrangler.jsonc` 通过 Wrangler schema 解析；
- dry-run 在没有账号资源 ID 和 R2 桶名时仍能完成打包；
- 仓库中不存在全零 KV ID、固定 R2 桶名、固定管理员账号和生产 Secret；
- README 的 Dashboard 步骤与当前 Cloudflare 官方界面及运行时绑定模型一致；
- 现有单元测试继续使用内存 KV 和伪绑定，不依赖真实 Cloudflare 账号。

## 非目标

- 不自动创建或修改部署者的 GitHub OAuth App；
- 不加入 GitHub Actions 部署流程；
- 不把 KV/R2 改成其他存储产品；
- 不修改业务功能、前端界面或数据模型；
- 不把实例资源 ID 或 Secret 写回仓库。
