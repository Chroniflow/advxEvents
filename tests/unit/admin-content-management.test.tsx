// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";

import { api } from "../../src/client/api/client";
import { ContentManagementPage } from "../../src/client/features/admin/ContentManagementPage";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const story = { storyId: "s1", revisionId: "r1", authorGithubId: "owner", authorLogin: "owner", authorName: null, authorAvatarUrl: "", authorProfileUrl: "", title: "已发布帖子", body: "正文", anonymous: false, images: [], status: "published" as const, createdAt: "2026-07-01T00:00:00Z", updatedAt: "2026-07-01T00:00:00Z", submittedAt: null, publishedAt: "2026-07-01T00:00:00Z" };

it("管理人员可以从内容管理页删除已发布帖子", async () => {
  vi.spyOn(api, "publishedStories").mockResolvedValue({ stories: [story] });
  vi.spyOn(api, "deletedStories").mockResolvedValue({ stories: [] });
  vi.spyOn(window, "confirm").mockReturnValue(true);
  const deletion = { storyId: "s1", deletedAt: "2026-07-25T00:00:00Z", purgeAt: "2026-08-08T00:00:00Z", deletedByGithubId: "staff", deletedByRole: "STAFF" as const, previousStatus: "published" as const, revisionId: "r1", contentHash: "h" };
  const remove = vi.spyOn(api, "deleteStory").mockResolvedValue(deletion);
  render(<ContentManagementPage />);

  await userEvent.click(await screen.findByRole("button", { name: "删除帖子" }));
  expect(remove).toHaveBeenCalledWith("s1");
  expect(await screen.findByRole("button", { name: "恢复帖子" })).toBeInTheDocument();
});

it("管理人员可以恢复待清理帖子", async () => {
  const deletion = { storyId: "s1", deletedAt: "2026-07-25T00:00:00Z", purgeAt: "2026-08-08T00:00:00Z", deletedByGithubId: "staff", deletedByRole: "STAFF" as const, previousStatus: "published" as const, revisionId: "r1", contentHash: "h" };
  vi.spyOn(api, "publishedStories").mockResolvedValue({ stories: [] });
  vi.spyOn(api, "deletedStories").mockResolvedValue({ stories: [{ ...story, deletion }] });
  const restore = vi.spyOn(api, "restoreStory").mockResolvedValue(story);
  render(<ContentManagementPage />);

  await userEvent.click(await screen.findByRole("button", { name: "恢复帖子" }));
  expect(restore).toHaveBeenCalledWith("s1");
  expect(await screen.findByRole("button", { name: "删除帖子" })).toBeInTheDocument();
});

it("删除失败时显示错误提示", async () => {
  vi.spyOn(api, "publishedStories").mockResolvedValue({ stories: [story] });
  vi.spyOn(api, "deletedStories").mockResolvedValue({ stories: [] });
  vi.spyOn(window, "confirm").mockReturnValue(true);
  vi.spyOn(api, "deleteStory").mockRejectedValue(new Error("failed"));
  render(<ContentManagementPage />);

  await userEvent.click(await screen.findByRole("button", { name: "删除帖子" }));
  expect(await screen.findByText("删除失败，请重试。")).toBeInTheDocument();
});
