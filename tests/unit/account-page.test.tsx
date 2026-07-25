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
  it("作者确认后删除帖子并显示恢复操作", async () => {
    const story = { storyId: "s1", revisionId: "r1", authorGithubId: "123", authorLogin: "chroniflow", authorName: "Chroniflow", authorAvatarUrl: "", authorProfileUrl: "", title: "待删除", body: "正文", anonymous: false, images: [], status: "published" as const, createdAt: "2026-07-01T00:00:00Z", updatedAt: "2026-07-01T00:00:00Z", submittedAt: null, publishedAt: "2026-07-01T00:00:00Z" };
    vi.spyOn(api, "myStories").mockResolvedValue({ stories: [story] });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const deletion = { storyId: "s1", deletedAt: "2026-07-25T00:00:00Z", purgeAt: "2026-08-08T00:00:00Z", deletedByGithubId: "123", deletedByRole: "USER" as const, previousStatus: "published" as const, revisionId: "r1", contentHash: "h" };
    const remove = vi.spyOn(api, "deleteStory").mockResolvedValue(deletion);
    renderAccount();

    await userEvent.click(await screen.findByRole("button", { name: "删除帖子" }));
    expect(remove).toHaveBeenCalledWith("s1");
    expect(await screen.findByRole("button", { name: "恢复帖子" })).toBeInTheDocument();
  });

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
