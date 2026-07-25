import { describe, expect, it } from "vitest";

import type { StoryRevision } from "../../src/shared/contracts";
import { toPublicStory } from "../../src/worker/stories/serialize";

const revision: StoryRevision = {
  storyId: "story-1",
  revisionId: "revision-1",
  authorGithubId: "123",
  authorLogin: "private-user",
  authorName: "Private User",
  authorAvatarUrl: "https://avatars.example/private.png",
  authorProfileUrl: "https://github.com/private-user",
  title: "那个凌晨",
  body: "我们终于完成了。",
  anonymous: true,
  images: [],
  status: "published",
  createdAt: "2026-07-25T00:00:00.000Z",
  updatedAt: "2026-07-25T00:00:00.000Z",
  submittedAt: "2026-07-25T00:00:00.000Z",
  publishedAt: "2026-07-25T00:00:00.000Z",
};

describe("public story serialization", () => {
  it("removes private identity from an anonymous story", () => {
    const publicStory = toPublicStory(revision);
    const serialized = JSON.stringify(publicStory);

    expect(publicStory.author).toEqual({ anonymous: true });
    expect(serialized).not.toContain("private-user");
    expect(serialized).not.toContain("Private User");
    expect(serialized).not.toContain("123");
  });

  it("includes approved identity for an attributed story", () => {
    const publicStory = toPublicStory({ ...revision, anonymous: false });

    expect(publicStory.author).toMatchObject({
      anonymous: false,
      login: "private-user",
    });
  });
});

