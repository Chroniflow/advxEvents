import { describe, expect, it } from "vitest";

import type { StoryRevision } from "../../src/shared/contracts";
import { hashStoryContent } from "../../src/worker/stories/content-hash";

const revision = {
  storyId: "story-1", revisionId: "r1", authorGithubId: "u1", authorLogin: "u",
  authorName: null, authorAvatarUrl: "", authorProfileUrl: "", title: "标题", body: "正文",
  anonymous: false, images: [], status: "published", createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z", submittedAt: null, publishedAt: "2026-01-01T00:00:00Z",
} satisfies StoryRevision;

describe("hashStoryContent", () => {
  it("忽略状态和时间但识别内容变化", async () => {
    const hash = await hashStoryContent(revision);
    expect(await hashStoryContent({ ...revision, status: "unpublished", updatedAt: "2027-01-01T00:00:00Z" })).toBe(hash);
    expect(await hashStoryContent({ ...revision, body: "新正文" })).not.toBe(hash);
  });
});
