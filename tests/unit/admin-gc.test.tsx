// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { api } from "../../src/client/api/client";
import { AdminOverview } from "../../src/client/features/admin/AdminOverview";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("ADMIN 可以手动运行 GC", async () => {
  vi.spyOn(api, "reviews").mockResolvedValue({ stories: [] });
  vi.spyOn(api, "deletedStories").mockResolvedValue({ stories: [] });
  const run = vi.spyOn(api, "runGc").mockResolvedValue({ purgedStories: 2, deletedObjects: 1, queuedObjects: 0 });
  render(<MemoryRouter initialEntries={["/admin"]}><Routes><Route element={<Outlet context={{ user: { role: "ADMIN" } }} />}><Route path="/admin" element={<AdminOverview />} /></Route></Routes></MemoryRouter>);
  await userEvent.click(await screen.findByRole("button", { name: "立即运行 GC" }));
  expect(run).toHaveBeenCalledOnce();
  expect(await screen.findByText(/已清理 2 个帖子/)).toBeInTheDocument();
});

it("管理人员可以恢复保留期内的帖子", async () => {
  vi.spyOn(api, "reviews").mockResolvedValue({ stories: [] });
  vi.spyOn(api, "deletedStories").mockResolvedValue({ stories: [{
    storyId: "s1", revisionId: "r1", authorGithubId: "123", authorLogin: "author",
    authorName: null, authorAvatarUrl: "", authorProfileUrl: "", title: "待恢复",
    body: "正文", anonymous: false, images: [], status: "published", createdAt: "2026-07-01T00:00:00Z",
    updatedAt: "2026-07-01T00:00:00Z", submittedAt: null, publishedAt: "2026-07-01T00:00:00Z",
    deletion: { storyId: "s1", deletedAt: "2026-07-25T00:00:00Z", purgeAt: "2026-08-08T00:00:00Z", deletedByGithubId: "admin", deletedByRole: "ADMIN", previousStatus: "published", revisionId: "r1", contentHash: "h" },
  }] });
  const restore = vi.spyOn(api, "restoreStory").mockResolvedValue({} as never);
  render(<MemoryRouter initialEntries={["/admin"]}><Routes><Route element={<Outlet context={{ user: { role: "ADMIN" } }} />}><Route path="/admin" element={<AdminOverview />} /></Route></Routes></MemoryRouter>);

  await userEvent.click(await screen.findByRole("button", { name: "恢复帖子" }));
  expect(restore).toHaveBeenCalledWith("s1");
  expect(screen.queryByText("待恢复")).not.toBeInTheDocument();
});
