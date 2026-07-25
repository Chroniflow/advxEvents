# 后台内容管理入口实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 STAFF 和 ADMIN 增加可发现的已发布帖子删除与待清理帖子恢复入口。

**Architecture:** 在现有 moderationRoutes 下增加已发布列表 API，复用 StoryRepository.listPublished。前端新增独立 ContentManagementPage，并复用现有 deleteStory、restoreStory 与 deletedStories 客户端接口。

**Tech Stack:** Hono、Cloudflare Workers KV、React Router、React、Vitest、Testing Library、TypeScript

---

### Task 1: 已发布内容管理 API

**Files:**
- Modify: `src/worker/moderation/routes.ts`
- Create: `tests/unit/moderation-content-routes.test.ts`

- [ ] 写失败测试：以 STAFF 会话请求 `GET /api/admin/published`，期望返回已发布帖子；普通用户期望 403。
- [ ] 运行 `npm test -- --run tests/unit/moderation-content-routes.test.ts`，确认因路由缺失失败。
- [ ] 在 `moderationRoutes` 增加 `GET /published`，返回 `{ stories: await repository.listPublished() }`。
- [ ] 重跑定向测试，确认权限和响应通过。

### Task 2: 后台内容管理页面

**Files:**
- Create: `src/client/features/admin/ContentManagementPage.tsx`
- Modify: `src/client/features/admin/AdminLayout.tsx`
- Modify: `src/client/api/client.ts`
- Modify: `src/client/main.tsx`
- Create: `tests/unit/admin-content-management.test.tsx`

- [ ] 写失败测试：页面加载已发布与待清理列表，删除已发布帖子后移入待清理区，恢复后移回已发布区；失败时显示中文提示。
- [ ] 运行 `npm test -- --run tests/unit/admin-content-management.test.tsx`，确认组件或入口缺失导致失败。
- [ ] 客户端增加 `publishedStories()`；新增 `ContentManagementPage`，包含确认、busy/disabled、错误提示和本地列表同步。
- [ ] 后台侧边栏增加“内容管理”，路由增加 `/admin/content`。
- [ ] 重跑定向测试，确认页面行为通过。

### Task 3: 验证与发布

**Files:**
- Verify all changed files

- [ ] 执行 `npm test`、`npm run build`、`WRANGLER_LOG_PATH=/tmp/mysteryadvx-content.log npx wrangler deploy --dry-run` 和 `git diff --check`。
- [ ] 审查 STAFF/ADMIN 权限、按钮可发现性、删除确认、恢复与失败状态。
- [ ] 提交并推送 `main`，确认 `HEAD` 与 `origin/main` 一致。

