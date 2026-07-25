// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

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

afterEach(cleanup);

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
    expect(screen.getByRole("link", { name: /GitHub 登录/ })).toHaveAttribute(
      "href",
      "/api/auth/github",
    );
    expect(screen.queryByRole("link", { name: "我的" })).not.toBeInTheDocument();
  });

  it("登录后只显示我的入口", () => {
    renderHeader({ authStatus: "authenticated", user });
    expect(screen.getByRole("link", { name: "我的" })).toHaveAttribute(
      "href",
      "/account",
    );
    expect(screen.queryByRole("link", { name: /GitHub 登录/ })).not.toBeInTheDocument();
  });
});
