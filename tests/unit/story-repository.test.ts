import { describe, expect, it } from "vitest";

import type { StoryRevision } from "../../src/shared/contracts";
import { StoryRepository } from "../../src/worker/data/stories";
import { MemoryKv } from "../utils/memory-kv";

function makeRevision(overrides: Partial<StoryRevision> = {}): StoryRevision {
  return {
    storyId: "story-1",
    revisionId: "revision-1",
    authorGithubId: "user-1",
    authorLogin: "builder",
    authorName: "Builder",
    authorAvatarUrl: "https://example.com/avatar.png",
    authorProfileUrl: "https://github.com/builder",
    title: "第一版",
    body: "正文",
    anonymous: false,
    images: [],
    status: "published",
    createdAt: "2026-07-25T00:00:00.000Z",
    updatedAt: "2026-07-25T00:00:00.000Z",
    submittedAt: "2026-07-25T00:00:00.000Z",
    publishedAt: "2026-07-25T00:00:00.000Z",
    ...overrides,
  };
}

describe("StoryRepository", () => {
  it("删除后隐藏公开修订并在作者列表附带删除记录", async () => {
    const repository = new StoryRepository(new MemoryKv() as unknown as KVNamespace);
    await repository.create(makeRevision());
    await repository.publishRevision("story-1", "revision-1", "publish-delete");
    await repository.saveDeletion({
      storyId: "story-1", deletedAt: "2026-07-25T00:00:00.000Z",
      purgeAt: "2026-08-08T00:00:00.000Z", deletedByGithubId: "user-1",
      deletedByRole: "USER", previousStatus: "published", revisionId: "revision-1", contentHash: "hash",
    });

    expect(await repository.getPublishedRevision("story-1")).toBeNull();
    expect((await repository.listPublished()).length).toBe(0);
    expect((await repository.listOwner("user-1"))[0].deletion?.contentHash).toBe("hash");
  });
  it("keeps the approved revision public while a new revision is pending", async () => {
    const repository = new StoryRepository(new MemoryKv() as unknown as KVNamespace);
    await repository.create(makeRevision());
    await repository.publishRevision("story-1", "revision-1", "publish-1");
    await repository.saveRevision(
      makeRevision({ revisionId: "revision-2", title: "待审修改", status: "pending", publishedAt: null }),
    );

    const publicRevision = await repository.getPublishedRevision("story-1");
    expect(publicRevision?.revisionId).toBe("revision-1");
    expect(publicRevision?.title).toBe("第一版");
  });

  it("publishes idempotently", async () => {
    const repository = new StoryRepository(new MemoryKv() as unknown as KVNamespace);
    await repository.create(makeRevision());
    await repository.publishRevision("story-1", "revision-1", "same-operation");
    await repository.publishRevision("story-1", "revision-1", "same-operation");

    expect((await repository.listPublished()).length).toBe(1);
  });
});
