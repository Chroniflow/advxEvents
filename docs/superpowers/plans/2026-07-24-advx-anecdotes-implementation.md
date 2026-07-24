# ADVX轶事 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy a React and Cloudflare Workers application where GitHub-authenticated participants submit optionally anonymous text-and-image anecdotes for staff review, and authenticated users browse, sort, and like published stories.

**Architecture:** A single Cloudflare Worker serves a Vite-built React SPA and a Hono `/api` application. Workers KV stores users, story revisions, reviews, indexes, settings, sessions, and audit events; R2 stores validated original images; a SQLite-backed Durable Object serializes likes and maintains hot rankings. Domain services stay independent of Cloudflare bindings through narrow repository interfaces so permissions, state transitions, and serialization can be tested locally.

**Tech Stack:** TypeScript, React, React Router, Vite, Hono, Zod, Lucide React, Cloudflare Workers KV/R2/Durable Objects, Vitest, Testing Library, MSW, Playwright, Wrangler.

---

## File Map

```text
package.json                         scripts and dependencies
tsconfig.json                        shared TypeScript settings
vite.config.ts                       React client build
wrangler.jsonc                       Worker, assets, KV, R2, and DO bindings
src/shared/contracts.ts              API DTOs and role/status enums
src/shared/schemas.ts                Zod request validation
src/worker/index.ts                  Worker entry and SPA fallback
src/worker/env.ts                    typed Cloudflare bindings
src/worker/app.ts                    Hono composition and error mapping
src/worker/auth/*                    GitHub OAuth, signed session, role guards
src/worker/data/*                    KV repositories and key builders
src/worker/stories/*                 story lifecycle and public serialization
src/worker/uploads/*                 R2 validation and upload routes
src/worker/moderation/*              review, unpublish, restore, and role routes
src/worker/likes/LikeDirectory.ts     SQLite-backed Durable Object
src/client/main.tsx                  React bootstrap
src/client/router.tsx                public, authenticated, and admin routes
src/client/styles/*                  tokens, layout, and responsive rules
src/client/components/*              shared controls and story modules
src/client/features/gallery/*        public gallery and sorting
src/client/features/story/*          story detail
src/client/features/editor/*         draft editor and asset controls
src/client/features/admin/*          review and permissions workspace
tests/unit/*                          domain and repository tests
tests/integration/*                   Worker API tests with Miniflare pool
tests/e2e/*                           browser workflows
```

## Task 1: Scaffold The Worker And React Application

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `wrangler.jsonc`
- Create: `index.html`
- Create: `src/client/main.tsx`
- Create: `src/client/App.tsx`
- Create: `src/worker/env.ts`
- Create: `src/worker/index.ts`
- Create: `tests/unit/smoke.test.ts`

- [ ] **Step 1: Create the package manifest and test-first smoke test**

```json
{
  "name": "advx-anecdotes",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "deploy": "npm run build && wrangler deploy"
  }
}
```

```ts
// tests/unit/smoke.test.ts
import { describe, expect, it } from "vitest";
import { APP_NAME } from "../../src/shared/contracts";

describe("application scaffold", () => {
  it("exposes the approved product name", () => {
    expect(APP_NAME).toBe("ADVX轶事");
  });
});
```

- [ ] **Step 2: Install the required packages**

Run:

```bash
npm install react react-dom react-router-dom hono zod lucide-react
npm install -D typescript vite @vitejs/plugin-react wrangler vitest @cloudflare/vitest-pool-workers @cloudflare/workers-types @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom msw @playwright/test @types/react @types/react-dom
```

Expected: `package-lock.json` is created and `npm audit` reports no unresolved critical vulnerability.

- [ ] **Step 3: Run the smoke test and verify the missing module failure**

Run: `npm test -- tests/unit/smoke.test.ts`

Expected: FAIL because `src/shared/contracts.ts` does not exist.

- [ ] **Step 4: Add the minimum shared constant and application entries**

```ts
// src/shared/contracts.ts
export const APP_NAME = "ADVX轶事";
```

```tsx
// src/client/App.tsx
import { APP_NAME } from "../shared/contracts";

export function App() {
  return <main><h1>{APP_NAME}</h1></main>;
}
```

```tsx
// src/client/main.tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode><App /></StrictMode>,
);
```

```ts
// src/worker/env.ts
export interface Env {
  ASSETS: Fetcher;
  CONTENT: KVNamespace;
  MEDIA: R2Bucket;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  SESSION_SECRET: string;
  ADMIN_GITHUB_USERS: string;
  APP_ORIGIN: string;
}
```

```ts
// src/worker/index.ts
import { Hono } from "hono";
import type { Env } from "./env";

const app = new Hono<{ Bindings: Env }>();
app.get("/api/health", (c) => c.json({ ok: true }));
app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
```

- [ ] **Step 5: Configure Vite, TypeScript, Wrangler, and HTML**

Use a Vite React build output of `dist`, include `@cloudflare/workers-types` in TypeScript types, set Worker compatibility date to `2026-07-24`, bind `CONTENT` and `MEDIA`, configure `assets.directory` as `./dist`, and route `/api/*` through the Worker before assets. The `LIKES` binding and Durable Object migration are added in Task 7 when the class exists.

- [ ] **Step 6: Verify scaffold**

Run: `npm test -- tests/unit/smoke.test.ts && npm run build`

Expected: one passing test and a successful `dist` build.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts wrangler.jsonc index.html src tests/unit/smoke.test.ts
git commit -m "chore: scaffold React Worker application"
```

## Task 2: Define Domain Contracts, Permissions, And Story State

**Files:**
- Modify: `src/shared/contracts.ts`
- Create: `src/shared/schemas.ts`
- Create: `src/worker/auth/permissions.ts`
- Create: `src/worker/stories/lifecycle.ts`
- Test: `tests/unit/permissions.test.ts`
- Test: `tests/unit/story-lifecycle.test.ts`

- [ ] **Step 1: Write failing permission and lifecycle tests**

```ts
// tests/unit/permissions.test.ts
import { describe, expect, it } from "vitest";
import { can } from "../../src/worker/auth/permissions";

describe("role permissions", () => {
  it("allows staff moderation but denies role management", () => {
    expect(can("STAFF", "story:review")).toBe(true);
    expect(can("STAFF", "roles:manage")).toBe(false);
  });

  it("allows admins to manage roles", () => {
    expect(can("ADMIN", "roles:manage")).toBe(true);
  });
});
```

```ts
// tests/unit/story-lifecycle.test.ts
import { expect, it } from "vitest";
import { transitionStory } from "../../src/worker/stories/lifecycle";

it("rejects direct draft publication", () => {
  expect(() => transitionStory("draft", "publish")).toThrow("Invalid story transition");
});
```

- [ ] **Step 2: Verify both tests fail**

Run: `npm test -- tests/unit/permissions.test.ts tests/unit/story-lifecycle.test.ts`

Expected: FAIL because the modules are missing.

- [ ] **Step 3: Implement explicit contracts and permission matrix**

```ts
export type Role = "USER" | "STAFF" | "ADMIN";
export type PrincipalRole = "ANONYMOUS" | Role;
export type StoryStatus = "draft" | "pending" | "published" | "rejected" | "withdrawn" | "unpublished";
export type Permission = "story:create" | "story:like" | "story:review" | "story:unpublish" | "roles:manage" | "settings:manage";

export interface UserProfile {
  githubId: string;
  login: string;
  name: string | null;
  avatarUrl: string;
  profileUrl: string;
  role: Role;
  createdAt: string;
  updatedAt: string;
}
```

Implement `can(role, permission)` as a closed matrix. Implement `transitionStory(status, event)` with only the transitions approved in the design specification.

- [ ] **Step 4: Add Zod schemas for draft saves, review decisions, role changes, and image metadata**

Set concrete first-release limits: title 1-120 characters, body 1-20,000 characters, at most 8 images, caption at most 240 characters, rejection reason 1-1,000 characters.

- [ ] **Step 5: Verify domain behavior**

Run: `npm test -- tests/unit/permissions.test.ts tests/unit/story-lifecycle.test.ts`

Expected: all permission and transition cases pass.

- [ ] **Step 6: Commit**

```bash
git add src/shared src/worker/auth/permissions.ts src/worker/stories/lifecycle.ts tests/unit
git commit -m "feat: define roles and story lifecycle"
```

## Task 3: Implement KV Repositories And Public Serialization

**Files:**
- Create: `src/worker/data/keys.ts`
- Create: `src/worker/data/users.ts`
- Create: `src/worker/data/stories.ts`
- Create: `src/worker/data/audit.ts`
- Create: `src/worker/stories/serialize.ts`
- Test: `tests/unit/story-serialization.test.ts`
- Test: `tests/integration/story-repository.test.ts`

- [ ] **Step 1: Write a failing anonymity test**

```ts
import { expect, it } from "vitest";
import { toPublicStory } from "../../src/worker/stories/serialize";

it("removes private identity from an anonymous story", () => {
  const publicStory = toPublicStory({
    anonymous: true,
    authorGithubId: "123",
    authorLogin: "private-user",
  } as never);
  expect(publicStory.author).toEqual({ anonymous: true });
  expect(JSON.stringify(publicStory)).not.toContain("private-user");
  expect(JSON.stringify(publicStory)).not.toContain("123");
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- tests/unit/story-serialization.test.ts`

Expected: FAIL because `toPublicStory` is missing.

- [ ] **Step 3: Implement canonical key builders and typed repositories**

Repository methods must include `getUser`, `upsertGithubUser`, `setRole`, `getStory`, `saveRevision`, `listOwnerStories`, `listPending`, `publishRevision`, `setPublicationState`, and `appendAuditEvent`. Every multi-step mutation accepts an idempotency key and stores its completion marker.

- [ ] **Step 4: Implement public serialization as an allowlist**

Construct public DTOs field by field. Never spread a private story record. For anonymous stories, emit only `{ anonymous: true }`; for attributed stories, emit login, name, avatar URL, and GitHub profile URL.

- [ ] **Step 5: Add repository integration tests with isolated KV bindings**

Test revision persistence, pending pagination, idempotent publication, old-public-revision retention, and append-only audit keys.

- [ ] **Step 6: Verify repositories and serialization**

Run: `npm test -- tests/unit/story-serialization.test.ts tests/integration/story-repository.test.ts`

Expected: all tests pass with no private identity in anonymous snapshots.

- [ ] **Step 7: Commit**

```bash
git add src/worker/data src/worker/stories/serialize.ts tests
git commit -m "feat: add KV story repositories"
```

## Task 4: Add GitHub OAuth, Sessions, And Bootstrap Admin Protection

**Files:**
- Create: `src/worker/auth/github.ts`
- Create: `src/worker/auth/session.ts`
- Create: `src/worker/auth/middleware.ts`
- Create: `src/worker/auth/routes.ts`
- Create: `src/worker/app.ts`
- Test: `tests/unit/session.test.ts`
- Test: `tests/integration/auth-routes.test.ts`

- [ ] **Step 1: Write failing tests for OAuth state and bootstrap roles**

```ts
it("rejects an OAuth callback with mismatched state", async () => {
  const response = await api.request("/api/auth/github/callback?code=x&state=wrong", {}, env);
  expect(response.status).toBe(400);
});

it("always resolves icebraker as ADMIN", () => {
  expect(resolveRole({ storedRole: "USER", login: "icebraker", bootstrap: ["icebraker"] })).toBe("ADMIN");
});
```

- [ ] **Step 2: Verify the tests fail**

Run: `npm test -- tests/unit/session.test.ts tests/integration/auth-routes.test.ts`

Expected: FAIL because auth handlers are absent.

- [ ] **Step 3: Implement signed opaque sessions**

Generate 32 random bytes for a session ID, store a SHA-256 digest in KV with TTL, and send the raw ID only in an `HttpOnly; Secure; SameSite=Lax; Path=/` cookie. Rotate the session after OAuth completion and delete it on logout.

- [ ] **Step 4: Implement GitHub OAuth routes**

`GET /api/auth/github` creates a single-use state value and redirects to GitHub. The callback verifies state, exchanges the code using `GITHUB_CLIENT_SECRET`, fetches `/user`, upserts the profile, resolves bootstrap role, rotates the session, and redirects to `/account`.

- [ ] **Step 5: Implement `requireUser`, `requireStaff`, and `requireAdmin` middleware**

Every protected request reloads the user and resolves `ADMIN_GITHUB_USERS`; a stored demotion can never override a bootstrap administrator.

- [ ] **Step 6: Verify auth routes**

Run: `npm test -- tests/unit/session.test.ts tests/integration/auth-routes.test.ts`

Expected: state mismatch is rejected, cookies contain required flags, logout revokes the session, and bootstrap protection passes.

- [ ] **Step 7: Commit**

```bash
git add src/worker/auth src/worker/app.ts tests
git commit -m "feat: add GitHub authentication"
```

## Task 5: Implement R2 Image Uploads And Draft Submission

**Files:**
- Create: `src/worker/uploads/validate.ts`
- Create: `src/worker/uploads/routes.ts`
- Create: `src/worker/stories/service.ts`
- Create: `src/worker/stories/routes.ts`
- Test: `tests/unit/image-validation.test.ts`
- Test: `tests/integration/submission-routes.test.ts`

- [ ] **Step 1: Write failing validation tests**

Test accepted JPEG, PNG, and WebP signatures; reject SVG, mismatched MIME/signature, files over 10 MiB, more than 8 images, and dimensions over 12,000 pixels on either axis.

- [ ] **Step 2: Verify validation tests fail**

Run: `npm test -- tests/unit/image-validation.test.ts`

Expected: FAIL because image validation is missing.

- [ ] **Step 3: Implement bounded image inspection and R2 keys**

Read only the header bytes needed to detect type and dimensions. Generate `stories/{storyId}/{assetId}/original` keys. Preserve the browser filename only as escaped display metadata, never as an object key.

- [ ] **Step 4: Implement authenticated upload and draft routes**

Add:

```text
POST   /api/uploads
DELETE /api/uploads/:assetId
POST   /api/stories
PUT    /api/stories/:storyId/draft
POST   /api/stories/:storyId/submit
POST   /api/stories/:storyId/withdraw
GET    /api/me/stories
```

Check asset ownership before attachment or deletion. A submission references only completed uploads owned by the author.

- [ ] **Step 5: Add integration tests for ownership and state transitions**

Verify users cannot attach another user's asset, pending submissions cannot be directly edited, withdrawal returns a story to draft, and edits to published stories preserve the old public revision.

- [ ] **Step 6: Verify submission APIs**

Run: `npm test -- tests/unit/image-validation.test.ts tests/integration/submission-routes.test.ts`

Expected: all validation, ownership, and lifecycle cases pass.

- [ ] **Step 7: Commit**

```bash
git add src/worker/uploads src/worker/stories tests
git commit -m "feat: add image and submission APIs"
```

## Task 6: Implement Moderation, Role Management, And Audit Events

**Files:**
- Create: `src/worker/moderation/routes.ts`
- Create: `src/worker/moderation/service.ts`
- Create: `src/worker/admin/routes.ts`
- Test: `tests/integration/moderation-routes.test.ts`
- Test: `tests/integration/role-routes.test.ts`

- [ ] **Step 1: Write failing authorization tests**

Cover USER review denial, STAFF approval and unpublish, STAFF role-management denial, ADMIN role assignment, and rejection of any attempt to demote `icebraker`.

- [ ] **Step 2: Run and verify failures**

Run: `npm test -- tests/integration/moderation-routes.test.ts tests/integration/role-routes.test.ts`

Expected: FAIL because moderation routes are missing.

- [ ] **Step 3: Implement moderation routes**

```text
GET  /api/admin/reviews?status=pending&cursor=
GET  /api/admin/reviews/:storyId/:revisionId
POST /api/admin/reviews/:storyId/:revisionId/approve
POST /api/admin/reviews/:storyId/:revisionId/reject
POST /api/admin/stories/:storyId/unpublish
POST /api/admin/stories/:storyId/restore
POST /api/admin/stories/:storyId/feature
```

Reject requires a reason. Each mutation writes an append-only audit event containing actor, action, target, timestamp, and relevant reason.

- [ ] **Step 4: Implement role routes**

```text
GET   /api/admin/users?query=
PATCH /api/admin/users/:githubId/role
GET   /api/admin/audit?cursor=
```

Only ADMIN can call these routes. Deny bootstrap demotion before any KV write.

- [ ] **Step 5: Verify moderation and role behavior**

Run: `npm test -- tests/integration/moderation-routes.test.ts tests/integration/role-routes.test.ts`

Expected: all role boundaries, publication transitions, and audit assertions pass.

- [ ] **Step 6: Commit**

```bash
git add src/worker/moderation src/worker/admin tests
git commit -m "feat: add moderation and role management"
```

## Task 7: Implement Durable Object Likes And Rankings

**Files:**
- Create: `src/worker/likes/LikeDirectory.ts`
- Create: `src/worker/likes/routes.ts`
- Create: `src/worker/likes/client.ts`
- Test: `tests/integration/likes.test.ts`

- [ ] **Step 1: Write failing duplicate and concurrency tests**

```ts
it("counts one like per user and story", async () => {
  await like("story-1", "user-1");
  await like("story-1", "user-1");
  expect(await count("story-1")).toBe(1);
});
```

Also issue concurrent likes from distinct users and assert the final count equals the number of unique users.

- [ ] **Step 2: Verify tests fail**

Run: `npm test -- tests/integration/likes.test.ts`

Expected: FAIL because the Durable Object does not exist.

- [ ] **Step 3: Implement the SQLite-backed object**

Create tables:

```sql
CREATE TABLE IF NOT EXISTS likes (
  story_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (story_id, user_id)
);
CREATE INDEX IF NOT EXISTS likes_by_story ON likes(story_id);
```

Implement RPC or HTTP methods `like`, `unlike`, `hasLiked`, `count`, and `hottest`. Use `INSERT OR IGNORE` and transactional count reads. Exclude unpublished stories when returning hottest results by accepting the current published-ID allowlist from the Worker.

Add `LIKES: DurableObjectNamespace` to `src/worker/env.ts`, export `LikeDirectory` from `src/worker/index.ts`, and add the `durable_objects.bindings` entry plus a `new_sqlite_classes` migration to `wrangler.jsonc` in the same step.

- [ ] **Step 4: Add authenticated API routes**

```text
PUT    /api/stories/:storyId/like
DELETE /api/stories/:storyId/like
GET    /api/stories/:storyId/like
```

Anonymous writes return `401`. Liking an unpublished story returns `404`.

- [ ] **Step 5: Verify likes and rankings**

Run: `npm test -- tests/integration/likes.test.ts`

Expected: duplicate likes remain one, unlikes are idempotent, concurrent unique likes are exact, and hottest order is descending.

- [ ] **Step 6: Commit**

```bash
git add src/worker/likes tests/integration/likes.test.ts wrangler.jsonc
git commit -m "feat: add durable likes and rankings"
```

## Task 8: Build Public Gallery And Story Reading

**Files:**
- Create: `src/client/router.tsx`
- Create: `src/client/api/client.ts`
- Create: `src/client/styles/tokens.css`
- Create: `src/client/styles/global.css`
- Create: `src/client/components/SiteHeader.tsx`
- Create: `src/client/components/StoryCard.tsx`
- Create: `src/client/features/gallery/GalleryPage.tsx`
- Create: `src/client/features/story/StoryPage.tsx`
- Test: `tests/unit/gallery.test.tsx`
- Test: `tests/unit/story-page.test.tsx`

- [ ] **Step 1: Write failing UI behavior tests**

Render mixed pure-text and image stories, switch from latest to hottest, verify the query is updated, verify anonymous cards omit GitHub links, and verify a signed-out like action opens the GitHub login path.

- [ ] **Step 2: Verify tests fail**

Run: `npm test -- tests/unit/gallery.test.tsx tests/unit/story-page.test.tsx`

Expected: FAIL because public components are absent.

- [ ] **Step 3: Implement tokens and stable layout primitives**

Define near-black surfaces, white and muted text, restrained orange accent, 1px borders, radii no larger than 8px, fixed icon-button dimensions, and responsive grid tracks. Use system Chinese sans-serif for body text and a locally bundled or permissively licensed futuristic display font only for short labels.

- [ ] **Step 4: Implement the modular text wall**

Build cards for quote, short, long, and optional-image stories using semantic `<article>` elements. Card width is selected from bounded content-length rules, not image presence. On screens below the mobile breakpoint, use a single column with no masonry reordering.

- [ ] **Step 5: Implement story detail and like controls**

Render plain text without `dangerouslySetInnerHTML`, insert validated image records in author-defined order, use a fixed heart icon button with accessible label, and show optimistic like state with rollback on API error.

- [ ] **Step 6: Verify public UI**

Run: `npm test -- tests/unit/gallery.test.tsx tests/unit/story-page.test.tsx && npm run build`

Expected: all tests pass and the client build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/client tests/unit
git commit -m "feat: build public anecdote gallery"
```

## Task 9: Build Submission Workspace And Administration UI

**Files:**
- Create: `src/client/features/editor/EditorPage.tsx`
- Create: `src/client/features/editor/ImageManager.tsx`
- Create: `src/client/features/editor/StoryPreview.tsx`
- Create: `src/client/features/account/AccountPage.tsx`
- Create: `src/client/features/admin/AdminLayout.tsx`
- Create: `src/client/features/admin/AdminOverview.tsx`
- Create: `src/client/features/admin/ReviewPage.tsx`
- Create: `src/client/features/admin/UsersPage.tsx`
- Test: `tests/unit/editor.test.tsx`
- Test: `tests/unit/admin.test.tsx`

- [ ] **Step 1: Write failing editor and admin tests**

Verify title/body validation, anonymous toggle, multi-image ordering, failed-upload recovery, draft save, STAFF review controls, ADMIN-only role controls, and disabled bootstrap role controls.

- [ ] **Step 2: Verify tests fail**

Run: `npm test -- tests/unit/editor.test.tsx tests/unit/admin.test.tsx`

Expected: FAIL because editor and admin components are absent.

- [ ] **Step 3: Implement the submission workspace**

Use a two-mode segmented control for Edit and Preview on narrow screens and a split editor/preview layout where space permits. Preserve unsaved fields in component state after API errors. Use native file input with thumbnail previews, explicit remove controls, and move-up/move-down ordering buttons.

- [ ] **Step 4: Implement the account page**

List drafts, pending, rejected, published, and unpublished stories with their available state-dependent actions. Display rejection reasons and allow a rejected revision to return to editing.

- [ ] **Step 5: Implement the administration shell and workflows**

Follow the approved United Portal-inspired direction: fixed sidebar on desktop, compact collapsible navigation on mobile, pending queue as primary content, role-labelled user rows, and explicit bootstrap badge. Use real controls and confirmation dialogs for destructive moderation actions.

- [ ] **Step 6: Verify authenticated UI**

Run: `npm test -- tests/unit/editor.test.tsx tests/unit/admin.test.tsx && npm run build`

Expected: all editor, review, permission visibility, and build checks pass.

- [ ] **Step 7: Commit**

```bash
git add src/client/features tests/unit
git commit -m "feat: add submission and administration UI"
```

## Task 10: Complete End-To-End Verification And Deployment Documentation

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/gallery.spec.ts`
- Create: `tests/e2e/submission-review.spec.ts`
- Create: `tests/e2e/roles-and-likes.spec.ts`
- Create: `.dev.vars.example`
- Create: `README.md`
- Modify: `package.json`

- [ ] **Step 1: Add deterministic development authentication only for test mode**

Expose a stubbed OAuth boundary only when `APP_ENV=test`. It must be unreachable in preview and production configuration. Seed fixtures for ANONYMOUS, USER, STAFF, ADMIN, pure-text stories, image stories, and a rejected revision.

- [ ] **Step 2: Write end-to-end tests**

Cover:

```text
anonymous browses and sorts
anonymous is redirected when liking
USER drafts, uploads, previews, and submits anonymously
STAFF approves and later unpublishes
ADMIN promotes a user to STAFF
ADMIN cannot demote bootstrap icebraker
published anonymous story never exposes private author text in DOM or response payload
```

- [ ] **Step 3: Run the complete automated suite**

Run:

```bash
npm test
npm run build
npm run test:e2e
```

Expected: all unit, integration, and browser tests pass; TypeScript and Vite build without errors.

- [ ] **Step 4: Start the local Worker and perform visual verification**

Run: `npm run dev`

Use Playwright screenshots at desktop and mobile widths. Verify nonblank content, no horizontal overflow, no text overlap, stable card dimensions, readable long Chinese titles, working navigation, and correct image rendering. Adjust only layout values and tokens needed to pass these checks; preserve the approved information hierarchy.

- [ ] **Step 5: Document setup and deployment**

README commands must include:

```bash
npx wrangler login
npx wrangler kv namespace create CONTENT
npx wrangler r2 bucket create advx-anecdotes-media
npx wrangler secret put GITHUB_CLIENT_SECRET
npx wrangler secret put SESSION_SECRET
npm run deploy
```

Document creation of the GitHub OAuth App, exact callback path `/api/auth/github/callback`, binding IDs in `wrangler.jsonc`, `ADMIN_GITHUB_USERS=icebraker`, Free-plan Durable Object behavior, local `.dev.vars`, and data deletion procedures.

- [ ] **Step 6: Run final verification from a clean install**

Run:

```bash
npm ci
npm test
npm run build
```

Expected: clean dependency installation, all tests passing, and reproducible build output.

- [ ] **Step 7: Commit**

```bash
git add playwright.config.ts tests/e2e .dev.vars.example README.md package.json package-lock.json src
git commit -m "test: verify ADVX anecdotes workflows"
```
