# Cloudflare Dashboard 开源部署实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让开源部署者通过 Cloudflare Dashboard 连接 GitHub 后部署项目，无需修改仓库或填写账号资源 ID。

**Architecture:** 保留 `wrangler.jsonc` 作为账号无关的 Worker 契约，只声明入口、静态资源、绑定名和 Durable Object 迁移。KV/R2 使用无实例标识的草稿绑定，普通变量与 Secret 由 Dashboard 维护，并通过 `keep_vars` 在后续 Git 部署中保留。

**Tech Stack:** Cloudflare Workers、Wrangler 4、Workers KV、R2、Durable Objects、Hono、Vite、Vitest、TypeScript

---

## 文件结构

- 修改 `wrangler.jsonc`：保存可公开复用的 Worker 入口、草稿绑定和迁移契约。
- 创建 `tests/unit/wrangler-config.test.ts`：锁定配置不含实例值、绑定名稳定、Dashboard 变量不会被部署覆盖。
- 修改 `.dev.vars.example`：在移除 Wrangler `vars` 后继续提供完整本地运行时变量模板。
- 修改 `README.md`：提供以 Cloudflare Dashboard 为主的简体中文 Git 部署与运行时绑定步骤。

### Task 1: 锁定开源 Wrangler 配置契约

**Files:**
- Create: `tests/unit/wrangler-config.test.ts`
- Test: `tests/unit/wrangler-config.test.ts`

- [ ] **Step 1: 编写失败测试**

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

interface WranglerConfig {
  keep_vars?: boolean;
  vars?: Record<string, unknown>;
  kv_namespaces?: Array<{ binding: string; id?: string; preview_id?: string }>;
  r2_buckets?: Array<{
    binding: string;
    bucket_name?: string;
    preview_bucket_name?: string;
  }>;
  durable_objects?: {
    bindings?: Array<{ name: string; class_name: string }>;
  };
}

const config = JSON.parse(
  readFileSync(new URL("../../wrangler.jsonc", import.meta.url), "utf8"),
) as WranglerConfig;

describe("开源 Wrangler 配置", () => {
  it("只声明稳定资源绑定，不包含部署实例标识", () => {
    expect(config.kv_namespaces).toEqual([{ binding: "CONTENT" }]);
    expect(config.r2_buckets).toEqual([{ binding: "MEDIA" }]);
    expect(config.durable_objects?.bindings).toContainEqual({
      name: "LIKES",
      class_name: "LikeDirectory",
    });
  });

  it("由 Dashboard 管理运行时变量", () => {
    expect(config.keep_vars).toBe(true);
    expect(config.vars).toBeUndefined();
  });
});
```

- [ ] **Step 2: 运行测试并确认按预期失败**

Run: `npm test -- tests/unit/wrangler-config.test.ts`

Expected: FAIL；现有 KV 包含全零 `id`、R2 包含固定 `bucket_name`，并且 `keep_vars` 未启用、`vars` 仍存在。

- [ ] **Step 3: 提交失败测试**

```bash
git add tests/unit/wrangler-config.test.ts
git commit -m "test: define portable Wrangler config contract"
```

### Task 2: 改为 Dashboard 优先的通用绑定配置

**Files:**
- Modify: `wrangler.jsonc`
- Test: `tests/unit/wrangler-config.test.ts`

- [ ] **Step 1: 最小修改 Wrangler 配置**

将实例相关字段移除，并加入变量保留开关：

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "advx-anecdotes",
  "main": "src/worker/index.ts",
  "compatibility_date": "2026-07-24",
  "keep_vars": true,
  "assets": {
    "binding": "ASSETS",
    "directory": "./dist",
    "run_worker_first": ["/api/*"]
  },
  "kv_namespaces": [{ "binding": "CONTENT" }],
  "r2_buckets": [{ "binding": "MEDIA" }],
  "durable_objects": {
    "bindings": [{ "name": "LIKES", "class_name": "LikeDirectory" }]
  },
  "migrations": [
    { "tag": "v1", "new_sqlite_classes": ["LikeDirectory"] }
  ]
}
```

- [ ] **Step 2: 运行配置契约测试并确认通过**

Run: `npm test -- tests/unit/wrangler-config.test.ts`

Expected: PASS，2 tests passed。

- [ ] **Step 3: 运行 Wrangler dry-run 验证草稿绑定可打包**

Run: `npm run build && npx wrangler deploy --dry-run`

Expected: 两条命令退出码均为 0；绑定清单包含 `CONTENT`、`MEDIA`、`LIKES` 和 `ASSETS`，无需账号资源 ID。

- [ ] **Step 4: 提交通用配置**

```bash
git add wrangler.jsonc
git commit -m "feat: make Cloudflare bindings deployment-portable"
```

### Task 3: 编写 Dashboard Git 部署文档并完整验证

**Files:**
- Modify: `.dev.vars.example`
- Modify: `README.md`

- [ ] **Step 1: 补齐本地变量模板**

在 `.dev.vars.example` 中加入：

```dotenv
ADMIN_GITHUB_USERS=replace-with-comma-separated-github-logins
APP_ORIGIN=http://localhost:8787
```

- [ ] **Step 2: 重写 Cloudflare 资源与部署章节**

README 必须明确写出：

```markdown
## 通过 Cloudflare Dashboard 部署

1. 在 Workers & Pages 中导入 GitHub 仓库。
2. 构建命令使用 `npm run build`，部署命令使用 `npx wrangler deploy`。
3. 首次部署可自动配置 `CONTENT` KV 与 `MEDIA` R2；也可预建资源后在 Worker 设置中确认同名绑定。
4. 在 Worker 的运行时 Variables and Secrets 中填写三项普通变量和两项 Secret。
5. 将 GitHub OAuth 回调设置为 `<APP_ORIGIN>/api/auth/github/callback`。

Workers Builds 的构建变量不会注入 Worker 运行时，不能替代 Worker Settings 中的 Variables and Secrets。
```

同时保留本地开发、权限、数据清理和验证说明；删除要求部署者替换 KV ID、修改 `wrangler.jsonc`、执行 `wrangler secret put` 的生产部署步骤。普通变量与 Secret 的名称、用途和敏感性必须与设计文档一致。

- [ ] **Step 3: 扫描账号专属值和旧部署指令**

Run: `rg -n "00000000000000000000000000000000|advx-anecdotes-media|icebraker|替换.*wrangler|secret put" README.md wrangler.jsonc`

Expected: 无输出，退出码为 1。

- [ ] **Step 4: 执行完整单元测试**

Run: `npm test`

Expected: 所有测试文件和测试用例通过，退出码为 0。

- [ ] **Step 5: 执行生产构建**

Run: `npm run build`

Expected: TypeScript 检查与 Vite 构建通过，退出码为 0。

- [ ] **Step 6: 执行 Cloudflare 打包验证**

Run: `npx wrangler deploy --dry-run`

Expected: Wrangler 完成 Worker 与静态资源打包，退出码为 0；不要求真实 KV ID 或 R2 桶名。

- [ ] **Step 7: 检查最终差异并提交文档**

```bash
git diff --check
git status --short
git add .dev.vars.example README.md docs/superpowers/plans/2026-07-25-cloudflare-dashboard-deployment.md
git commit -m "docs: explain Dashboard-first Cloudflare deployment"
```
