// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import {
  Outlet,
  RouterProvider,
  createMemoryRouter,
} from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AuthOutletContext } from "../../src/client/App";
import { api } from "../../src/client/api/client";
import { AccountPage } from "../../src/client/features/account/AccountPage";
import type { UserProfile } from "../../src/shared/contracts";

const profile: UserProfile = {
  githubId: "123",
  login: "chroniflow",
  name: "Chroniflow",
  avatarUrl: "https://example.com/avatar.png",
  profileUrl: "https://github.com/chroniflow",
  role: "USER",
  createdAt: "2026-07-25T00:00:00.000Z",
  updatedAt: "2026-07-25T00:00:00.000Z",
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function AuthLayout() {
  const [user, setUser] = useState<UserProfile | null>(profile);
  return <Outlet context={{ user, setUser } satisfies AuthOutletContext} />;
}

function renderAccount() {
  const router = createMemoryRouter(
    [
      {
        element: <AuthLayout />,
        children: [
          { path: "/account", element: <AccountPage /> },
          { path: "/", element: <div>首页</div> },
        ],
      },
    ],
    { initialEntries: ["/account"] },
  );
  render(<RouterProvider router={router} />);
}

describe("AccountPage 退出登录", () => {
  it("退出成功后清除用户并跳转首页", async () => {
    vi.spyOn(api, "myStories").mockResolvedValue({ stories: [] });
    const logout = vi.spyOn(api, "logout").mockResolvedValue({ ok: true });
    renderAccount();

    await userEvent.click(await screen.findByRole("button", { name: "退出登录" }));

    expect(logout).toHaveBeenCalledOnce();
    expect(await screen.findByText("首页")).toBeInTheDocument();
  });

  it("退出失败时保留用户并显示错误", async () => {
    vi.spyOn(api, "myStories").mockResolvedValue({ stories: [] });
    vi.spyOn(api, "logout").mockRejectedValue(new Error("Request failed (500)"));
    renderAccount();

    await userEvent.click(await screen.findByRole("button", { name: "退出登录" }));

    expect(await screen.findByText("退出失败，请重试。")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Chroniflow" })).toBeInTheDocument();
    expect(screen.queryByText("首页")).not.toBeInTheDocument();
  });
});
