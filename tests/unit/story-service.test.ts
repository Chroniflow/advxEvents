import { describe, expect, it } from "vitest";

import type { UserProfile } from "../../src/shared/contracts";
import { StoryRepository } from "../../src/worker/data/stories";
import { StoryService } from "../../src/worker/stories/service";
import { MemoryKv } from "../utils/memory-kv";

const user: UserProfile = {
  githubId: "user-1",
  login: "builder",
  name: "Builder",
  avatarUrl: "https://example.com/avatar.png",
  profileUrl: "https://github.com/builder",
  role: "USER",
  createdAt: "2026-07-25T00:00:00.000Z",
  updatedAt: "2026-07-25T00:00:00.000Z",
};

describe("StoryService", () => {
  it("creates a text-only draft and submits it", async () => {
    const repository = new StoryRepository(new MemoryKv() as unknown as KVNamespace);
    const service = new StoryService(repository);
    const draft = await service.createDraft(user, {
      title: "那个凌晨",
      body: "我们终于完成了。",
      anonymous: true,
      images: [],
    });

    expect(draft.status).toBe("draft");
    const pending = await service.submit(user, draft.storyId);
    expect(pending.status).toBe("pending");
    expect(pending.submittedAt).not.toBeNull();
  });

  it("prevents another user from submitting a draft", async () => {
    const repository = new StoryRepository(new MemoryKv() as unknown as KVNamespace);
    const service = new StoryService(repository);
    const draft = await service.createDraft(user, {
      title: "那个凌晨",
      body: "我们终于完成了。",
      anonymous: false,
      images: [],
    });

    await expect(
      service.submit({ ...user, githubId: "other-user" }, draft.storyId),
    ).rejects.toThrow("Story owner mismatch");
  });
});
