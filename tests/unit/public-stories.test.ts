import { describe, expect, it } from "vitest";

import type { StoryRevision } from "../../src/shared/contracts";
import { orderPublicStories } from "../../src/worker/stories/public-service";

function story(storyId: string, publishedAt: string, status: StoryRevision["status"] = "published") {
  return { storyId, publishedAt, status } as StoryRevision;
}

describe("orderPublicStories", () => {
  const stories = [
    story("old", "2026-07-01T00:00:00.000Z"),
    story("new", "2026-07-25T00:00:00.000Z"),
    story("hidden", "2026-07-26T00:00:00.000Z", "unpublished"),
  ];

  it("returns only published stories newest first", () => {
    expect(orderPublicStories(stories, "latest").map((item) => item.storyId)).toEqual([
      "new",
      "old",
    ]);
  });

  it("uses the supplied hot order", () => {
    expect(
      orderPublicStories(stories, "hottest", ["old", "new"]).map(
        (item) => item.storyId,
      ),
    ).toEqual(["old", "new"]);
  });
});
