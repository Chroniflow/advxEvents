import { describe, expect, it, vi } from "vitest";

import type { StoryRevision } from "../../src/shared/contracts";
import { StoryRepository } from "../../src/worker/data/stories";
import { GarbageCollectionService } from "../../src/worker/gc/service";
import { AssetRepository } from "../../src/worker/uploads/assets";
import { MemoryKv } from "../utils/memory-kv";

function revision(): StoryRevision {
  return { storyId: "s1", revisionId: "r1", authorGithubId: "u1", authorLogin: "u", authorName: null, authorAvatarUrl: "", authorProfileUrl: "", title: "t", body: "b", anonymous: false, images: [{ assetId: "a1", objectKey: "objects/a1", contentType: "image/png", width: 1, height: 1, size: 1, caption: "", order: 0 }], status: "draft", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z", submittedAt: null, publishedAt: null };
}

describe("GarbageCollectionService", () => {
  it("保留未到期帖子，并重试失败的 R2 删除", async () => {
    const memory = new MemoryKv();
    const kv = memory as unknown as KVNamespace;
    const stories = new StoryRepository(kv);
    const assets = new AssetRepository(kv);
    await stories.create(revision());
    await assets.save({ assetId: "a1", ownerGithubId: "u1", objectKey: "objects/a1", contentType: "image/png", width: 1, height: 1, size: 1, originalName: "a.png", public: false, createdAt: "2026-01-01T00:00:00Z" });
    await stories.saveDeletion({ storyId: "s1", deletedAt: "2026-01-01T00:00:00Z", purgeAt: "2026-01-15T00:00:00Z", deletedByGithubId: "u1", deletedByRole: "USER", previousStatus: "draft", revisionId: "r1", contentHash: "h" });
    const remove = vi.fn().mockRejectedValueOnce(new Error("R2 unavailable")).mockResolvedValue(undefined);
    const gc = new GarbageCollectionService(kv, stories, assets, { delete: remove } as unknown as R2Bucket, vi.fn());

    expect((await gc.run(new Date("2026-01-14T00:00:00Z"))).purgedStories).toBe(0);
    expect(await stories.getStory("s1")).not.toBeNull();
    expect((await gc.run(new Date("2026-01-16T00:00:00Z"))).queuedObjects).toBe(1);
    expect(await stories.getStory("s1")).toBeNull();
    expect(await assets.get("a1")).not.toBeNull();

    expect((await gc.run(new Date("2026-01-17T00:00:00Z"))).deletedObjects).toBe(1);
    expect(await assets.get("a1")).toBeNull();
  });

  it("重试 R2 删除前重新检查其他帖子的引用", async () => {
    const memory = new MemoryKv();
    const kv = memory as unknown as KVNamespace;
    const stories = new StoryRepository(kv);
    const assets = new AssetRepository(kv);
    await stories.create(revision());
    await assets.save({ assetId: "a1", ownerGithubId: "u1", objectKey: "objects/a1", contentType: "image/png", width: 1, height: 1, size: 1, originalName: "a.png", public: false, createdAt: "2026-01-01T00:00:00Z" });
    await stories.saveDeletion({ storyId: "s1", deletedAt: "2026-01-01T00:00:00Z", purgeAt: "2026-01-15T00:00:00Z", deletedByGithubId: "u1", deletedByRole: "USER", previousStatus: "draft", revisionId: "r1", contentHash: "h" });
    const remove = vi.fn().mockRejectedValueOnce(new Error("R2 unavailable"));
    const gc = new GarbageCollectionService(kv, stories, assets, { delete: remove } as unknown as R2Bucket, vi.fn());
    await gc.run(new Date("2026-01-16T00:00:00Z"));
    await stories.create({ ...revision(), storyId: "s2", revisionId: "r2" });

    await gc.run(new Date("2026-01-17T00:00:00Z"));
    expect(remove).toHaveBeenCalledTimes(1);
    expect(await assets.get("a1")).not.toBeNull();
  });
});
