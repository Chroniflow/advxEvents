// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, it } from "vitest";

import type { PublicStoryWithLikes } from "../../src/shared/contracts";
import { StoryCard } from "../../src/client/components/StoryCard";

it("renders an anonymous text-only story without a GitHub link", () => {
  const story: PublicStoryWithLikes = {
    storyId: "story-1",
    revisionId: "revision-1",
    title: "凌晨四点，我们终于让那块板子亮了起来",
    body: "没有人欢呼。大家只是盯着那颗绿色 LED。",
    images: [],
    publishedAt: "2026-07-25T00:00:00.000Z",
    author: { anonymous: true },
    likeCount: 12,
  };

  render(
    <MemoryRouter>
      <StoryCard story={story} index={0} />
    </MemoryRouter>,
  );

  expect(screen.getByRole("heading", { name: story.title })).toBeInTheDocument();
  expect(screen.getByText("匿名投稿")).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: /GitHub/ })).not.toBeInTheDocument();
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
});
