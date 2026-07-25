import { describe, expect, it } from "vitest";

import type { StoryRevision, UserProfile } from "../../src/shared/contracts";
import { StoryRepository } from "../../src/worker/data/stories";
import { StoryDeletionService } from "../../src/worker/stories/deletion-service";
import { MemoryKv } from "../utils/memory-kv";

const owner = { githubId: "owner", login: "owner", name: null, avatarUrl: "", profileUrl: "", role: "USER", createdAt: "", updatedAt: "" } satisfies UserProfile;
const staff = { ...owner, githubId: "staff", role: "STAFF" as const };

function story(status: StoryRevision["status"] = "published"): StoryRevision {
  return { storyId: "story-1", revisionId: "r1", authorGithubId: "owner", authorLogin: "owner", authorName: null, authorAvatarUrl: "", authorProfileUrl: "", title: "标题", body: "正文", anonymous: false, images: [], status, createdAt: "2026-07-01T00:00:00.000Z", updatedAt: "2026-07-01T00:00:00.000Z", submittedAt: null, publishedAt: status === "published" ? "2026-07-01T00:00:00.000Z" : null };
}

describe("StoryDeletionService", () => {
  it("允许作者删除并在未修改时恢复原状态", async () => {
    const repository = new StoryRepository(new MemoryKv() as unknown as KVNamespace);
    await repository.create(story());
    await repository.publishRevision("story-1", "r1", "publish");
    const service = new StoryDeletionService(repository);
    await service.delete(owner, "story-1");

    expect(await repository.getPublishedRevision("story-1")).toBeNull();
    expect((await service.restore(owner, "story-1")).status).toBe("published");
  });

  it("阻止普通用户删除他人帖子，但允许 STAFF 删除", async () => {
    const repository = new StoryRepository(new MemoryKv() as unknown as KVNamespace);
    await repository.create(story());
    const service = new StoryDeletionService(repository);

    await expect(service.delete({ ...owner, githubId: "other" }, "story-1")).rejects.toThrow("Insufficient permissions");
    await expect(service.delete(staff, "story-1")).resolves.toBeDefined();
  });

  it("作者在删除期修改内容后恢复为草稿", async () => {
    const repository = new StoryRepository(new MemoryKv() as unknown as KVNamespace);
    await repository.create(story());
    const service = new StoryDeletionService(repository);
    await service.delete(owner, "story-1");
    await repository.saveRevision({ ...story("draft"), revisionId: "r2", body: "修改后的正文", updatedAt: "2026-07-26T00:00:00.000Z" });

    expect((await service.restore(owner, "story-1")).status).toBe("draft");
  });
});
