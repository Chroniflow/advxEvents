# 响应式登录导航与退出实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让桌面与手机端头部根据真实登录状态切换 GitHub 登录和“我的”入口，并在账号页提供可靠退出功能。

**Architecture:** `App` 负责加载并保存全站用户状态，将状态传给 `SiteHeader`，并通过 React Router Outlet context 提供给 `AccountPage`。账号页调用现有 Worker 退出端点，成功后清除全局用户并跳转首页，失败时保留登录状态并显示错误。

**Tech Stack:** React 19、React Router 7、TypeScript、Testing Library、Vitest、Cloudflare Workers

---

## 文件结构

- 修改 `src/client/App.tsx`：全站认证状态的唯一前端来源，并提供 Outlet context。
- 修改 `src/client/components/SiteHeader.tsx`：根据加载、匿名、已登录状态渲染响应式入口。
- 修改 `src/client/features/account/AccountPage.tsx`：使用全局用户状态并实现退出流程。
- 修改 `src/client/api/client.ts`：增加 `logout` API 方法。
- 修改 `src/client/styles/global.css`：保证移动端“我的”图标入口可见且尺寸稳定。
- 创建 `tests/unit/site-header.test.tsx`：验证 Header 三种认证状态。
- 创建 `tests/unit/account-page.test.tsx`：验证退出成功和失败行为。

### Task 1: 全局认证状态与响应式 Header

**Files:**
- Create: `tests/unit/site-header.test.tsx`
- Modify: `src/client/App.tsx`
- Modify: `src/client/components/SiteHeader.tsx`
- Modify: `src/client/styles/global.css`

- [ ] **Step 1: 编写失败的 Header 状态测试**

测试使用 jsdom、Testing Library 和 `MemoryRouter`，构造一个最小 `UserProfile`：

```tsx
// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { SiteHeader } from "../../src/client/components/SiteHeader";
import type { UserProfile } from "../../src/shared/contracts";

const user: UserProfile = {
  githubId: "123",
  login: "chroniflow",
  name: "Chroniflow",
  avatarUrl: "https://example.com/avatar.png",
  profileUrl: "https://github.com/chroniflow",
  role: "USER",
  createdAt: "2026-07-25T00:00:00.000Z",
  updatedAt: "2026-07-25T00:00:00.000Z",
};

function renderHeader(props: Parameters<typeof SiteHeader>[0]) {
  render(
    <MemoryRouter>
      <SiteHeader {...props} />
    </MemoryRouter>,
  );
}

describe("SiteHeader", () => {
  it("加载认证状态时不显示登录或我的入口", () => {
    renderHeader({ authStatus: "loading", user: null });
    expect(screen.queryByRole("link", { name: /GitHub 登录/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "我的" })).not.toBeInTheDocument();
  });

  it("未登录时只显示 GitHub 登录入口", () => {
    renderHeader({ authStatus: "anonymous", user: null });
    expect(screen.getByRole("link", { name: /GitHub 登录/ })).toHaveAttribute("href", "/api/auth/github");
    expect(screen.queryByRole("link", { name: "我的" })).not.toBeInTheDocument();
  });

  it("登录后只显示我的入口", () => {
    renderHeader({ authStatus: "authenticated", user });
    expect(screen.getByRole("link", { name: "我的" })).toHaveAttribute("href", "/account");
    expect(screen.queryByRole("link", { name: /GitHub 登录/ })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `npm test -- tests/unit/site-header.test.tsx`

Expected: FAIL；`SiteHeader` 尚不接收 `authStatus` 和 `user`，且始终同时渲染两个入口。

- [ ] **Step 3: 实现 Header 状态接口**

在 `SiteHeader.tsx` 定义：

```ts
export type AuthStatus = "loading" | "anonymous" | "authenticated";

interface SiteHeaderProps {
  authStatus: AuthStatus;
  user: UserProfile | null;
}
```

使用 `UserRound` 图标渲染登录后的 `/account` Link，访问名称为“我的”。仅在 `anonymous` 时渲染 GitHub 登录链接，仅在 `authenticated` 且 `user` 存在时渲染“我的”。

- [ ] **Step 4: 在 App 中加载并提供全局认证状态**

在 `App.tsx` 中：

```ts
export interface AuthOutletContext {
  user: UserProfile | null;
  setUser: Dispatch<SetStateAction<UserProfile | null>>;
}
```

挂载时调用 `api.me()`；成功设置用户和 `authenticated`，失败设置 `anonymous`。将状态传给 Header，并用 `<Outlet context={{ user, setUser }} />` 暴露更新入口。卸载后不得更新 state。

- [ ] **Step 5: 修改移动端样式**

删除移动端规则中的 `.account-link { display:none; }`。让 `.account-link` 与 `.login-link` 在窄屏都使用固定图标按钮：

```css
.account-link,.login-link { width:38px; padding:0; }
.account-link span,.login-link span { display:none; }
```

桌面端按钮文字放在 `<span>` 中，保持可见。

- [ ] **Step 6: 运行 Header 测试并确认通过**

Run: `npm test -- tests/unit/site-header.test.tsx`

Expected: PASS，3 tests passed。

- [ ] **Step 7: 提交 Header 与全局认证状态**

```bash
git add tests/unit/site-header.test.tsx src/client/App.tsx src/client/components/SiteHeader.tsx src/client/styles/global.css
git commit -m "feat: show responsive navigation from auth state"
```

### Task 2: 账号页退出流程

**Files:**
- Create: `tests/unit/account-page.test.tsx`
- Modify: `src/client/api/client.ts`
- Modify: `src/client/features/account/AccountPage.tsx`

- [ ] **Step 1: 编写失败的退出行为测试**

测试 mock `api.myStories` 和 `api.logout`，使用 React Router data router 为 `AccountPage` 提供 Outlet context。覆盖：

```tsx
it("退出成功后清除用户并跳转首页", async () => {
  api.myStories = vi.fn().mockResolvedValue({ stories: [] });
  api.logout = vi.fn().mockResolvedValue({ ok: true });
  // 渲染 user 已登录的 AccountPage，点击“退出登录”
  // 断言 api.logout 被调用、setUser(null) 被调用、首页元素出现
});

it("退出失败时保留用户并显示错误", async () => {
  api.myStories = vi.fn().mockResolvedValue({ stories: [] });
  api.logout = vi.fn().mockRejectedValue(new Error("Request failed (500)"));
  // 点击“退出登录”
  // 断言 setUser 未以 null 调用，仍停留账号页，并显示“退出失败，请重试。”
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `npm test -- tests/unit/account-page.test.tsx`

Expected: FAIL；API 客户端没有 `logout`，账号页没有退出按钮和 Outlet context 行为。

- [ ] **Step 3: 增加 API 客户端退出方法**

在 `api` 对象中加入：

```ts
logout: () => request<{ ok: true }>("/api/auth/logout", { method: "POST" }),
```

- [ ] **Step 4: 实现账号页退出行为**

账号页通过 `useOutletContext<AuthOutletContext>()` 获取 `user` 和 `setUser`，通过 `useNavigate()` 跳转。新增 `logoutBusy` 与 `logoutError` 状态。

退出函数：

```ts
async function logout() {
  setLogoutBusy(true);
  setLogoutError("");
  try {
    await api.logout();
    setUser(null);
    navigate("/");
  } catch {
    setLogoutError("退出失败，请重试。");
  } finally {
    setLogoutBusy(false);
  }
}
```

已登录时只请求 `api.myStories()`；匿名状态显示现有登录提示。操作区加入 `LogOut` 图标按钮，处理中禁用。错误使用 `.notice` 显示。

- [ ] **Step 5: 运行账号页测试并确认通过**

Run: `npm test -- tests/unit/account-page.test.tsx`

Expected: PASS，退出成功和失败测试均通过。

- [ ] **Step 6: 执行完整验证**

Run:

```bash
npm test
npm run build
WRANGLER_LOG_PATH=/tmp/mysteryadvx-auth-nav.log npx wrangler deploy --dry-run
git diff --check
```

Expected: 全部命令退出码为 0；所有单元测试通过，构建和 Worker 打包成功。

- [ ] **Step 7: 提交退出流程**

```bash
git add tests/unit/account-page.test.tsx src/client/api/client.ts src/client/features/account/AccountPage.tsx
git commit -m "feat: add account logout flow"
```

### Task 3: 响应式视觉验证与推送

**Files:**
- Verify: `src/client/components/SiteHeader.tsx`
- Verify: `src/client/features/account/AccountPage.tsx`
- Verify: `src/client/styles/global.css`

- [ ] **Step 1: 启动本地 Worker**

Run: `npm run dev`

Expected: 服务监听 `http://localhost:8787`。

- [ ] **Step 2: 用 Playwright 检查桌面和手机尺寸**

检查 `1280×800` 与 `390×844`：

- 匿名状态只显示 GitHub 登录和投稿；
- 已登录状态只显示“我的”和投稿；
- 手机头部按钮不重叠，认证入口保持 38×38；
- 账号页退出按钮位于页面操作区且文字不溢出。

- [ ] **Step 3: 最终验证并推送**

Run:

```bash
npm test
npm run build
git status --short
git push origin main
```

Expected: 测试和构建通过，工作区干净，`origin/main` 更新到最新提交。
