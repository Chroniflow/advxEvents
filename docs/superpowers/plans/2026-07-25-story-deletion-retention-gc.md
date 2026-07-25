# 帖子延迟删除、恢复与 R2 GC 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为作者、STAFF 和 ADMIN 提供帖子延迟删除与恢复，并用每日 Cron 和 ADMIN 手动 GC 在 14 天后清理 KV、点赞及未引用 R2 对象。

**Architecture:** 删除状态以独立 KV 记录覆盖在现有 StoryRecord/StoryRevision 上，保持现有审核状态机不变。`StoryDeletionService` 负责权限、SHA-256 指纹和索引恢复，`GarbageCollectionService` 负责过期清理与 R2 重试；Cron 和管理 API 复用同一服务。

**Tech Stack:** Cloudflare Workers、Workers KV、R2、Durable Objects、Hono、React、Vitest、TypeScript

---

### Task 1: 删除数据模型、指纹和仓储行为

**Files:**
- Modify: `src/shared/contracts.ts`
- Modify: `src/worker/data/keys.ts`
- Modify: `src/worker/data/stories.ts`
- Create: `src/worker/stories/content-hash.ts`
- Modify: `tests/unit/story-repository.test.ts`
- Create: `tests/unit/story-content-hash.test.ts`

- [ ] 先写失败测试，覆盖稳定 SHA-256（忽略状态/时间、识别正文与图片说明变化）、删除记录读写、删除后公开查询隐藏、作者列表携带 `deletion`。
- [ ] 运行 `npm test -- tests/unit/story-content-hash.test.ts tests/unit/story-repository.test.ts`，确认因 API 缺失失败。
- [ ] 增加共享 `StoryDeletion` 与 `StoryRevisionView`；增加 `storyDeletion`、`deletionIndex`、`gcObject` 键。
- [ ] 实现规范化内容哈希；仓储增加 `getDeletion/saveDeletion/removeDeletion/listExpiredDeletions/listRevisions/removePublishedIndex/restoreIndexes/purgeStory`。
- [ ] 修改 `getPublishedRevision/listPublished/listPending` 排除删除记录，`listOwner` 返回带可选删除信息的视图。
- [ ] 重跑定向测试并提交 `feat: add retained story deletion storage`。

### Task 2: 删除与恢复服务/API

**Files:**
- Create: `src/worker/stories/deletion-service.ts`
- Modify: `src/worker/stories/service.ts`
- Modify: `src/worker/stories/routes.ts`
- Modify: `src/client/api/client.ts`
- Create: `tests/unit/story-deletion.test.ts`
- Modify: `tests/unit/auth-routes.test.ts`

- [ ] 先写失败测试，覆盖作者删除自己、普通用户不能删除他人、STAFF/ADMIN 删除任意、重复删除冲突、作者未修改恢复原状态、修改后恢复草稿、管理员恢复管理员删除。
- [ ] 运行定向测试确认失败。
- [ ] 实现 `StoryDeletionService.delete/restore`，保留期固定 14 天；删除时移除公开/待审索引，恢复时按哈希与删除者规则恢复索引和状态。
- [ ] 允许作者在删除保留期更新草稿，但禁止未恢复直接提交。
- [ ] 新增 `DELETE /api/stories/:storyId` 与 `POST /api/stories/:storyId/restore`，按 403/404/409 映射错误。
- [ ] 客户端增加 `deleteStory/restoreStory`。
- [ ] 运行定向测试并提交 `feat: add story deletion and restore APIs`。

### Task 3: 过期清理、R2 重试、点赞清理与 Cron

**Files:**
- Create: `src/worker/gc/service.ts`
- Create: `src/worker/gc/routes.ts`
- Modify: `src/worker/likes/LikeDirectory.ts`
- Modify: `src/worker/index.ts`
- Modify: `src/worker/app.ts`
- Modify: `wrangler.jsonc`
- Create: `tests/unit/garbage-collection.test.ts`
- Modify: `tests/unit/wrangler-config.test.ts`

- [ ] 先写失败测试，覆盖未到期不清理、到期清理 KV、未引用 R2 删除、R2 失败进入队列且下次重试、仍被其他故事引用的对象不删除。
- [ ] 运行定向测试确认失败。
- [ ] 实现批量 GC 与 `GcStats`，对象删除失败保存重试记录；扫描其他故事修订防止误删共享对象。
- [ ] Durable Object 增加 `DELETE /stories/:storyId/purge` 清理该帖全部点赞。
- [ ] 新增 ADMIN 专用 `POST /api/admin/gc`；Worker export default 同时实现 `fetch` 与 `scheduled`。
- [ ] `wrangler.jsonc` 增加每日 `0 3 * * *` Cron，并扩展配置测试。
- [ ] 运行定向测试、build、dry-run 并提交 `feat: add scheduled story garbage collection`。

### Task 4: 作者与管理员前端操作

**Files:**
- Modify: `src/client/features/account/AccountPage.tsx`
- Modify: `src/client/features/admin/AdminOverview.tsx`
- Modify: `src/client/api/client.ts`
- Modify: `src/client/styles/global.css`
- Modify: `tests/unit/account-page.test.tsx`
- Create: `tests/unit/admin-gc.test.tsx`

- [ ] 先写失败测试，覆盖作者删除确认、删除后恢复、删除信息展示、ADMIN 手动 GC 成功/失败。
- [ ] 运行定向测试确认失败。
- [ ] 账号页对未删除帖子显示删除，对已删除帖子显示恢复和剩余期限；操作成功刷新本地列表，失败显示 `.notice`。
- [ ] 管理概览增加 ADMIN 可用的“立即运行 GC”按钮及统计提示；STAFF 不显示该按钮。
- [ ] 运行定向测试并提交 `feat: add deletion and GC controls`。

### Task 5: 完整验证与发布

**Files:**
- Verify all changed files

- [ ] 执行 `npm test`、`npm run build`、`WRANGLER_LOG_PATH=/tmp/mysteryadvx-gc.log npx wrangler deploy --dry-run`、`git diff --check`。
- [ ] 检查桌面与 390px 手机视口，确认账号操作不溢出。
- [ ] 审查删除权限、恢复状态、过期边界、R2 引用保护和 Cron 配置。
- [ ] 确认工作区干净后 `git push origin main`，若远端前进则 fetch/rebase、重新验证后快进推送。
