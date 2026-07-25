import { describe, expect, it } from "vitest";

import type { StoryRevision, UserProfile } from "../../src/shared/contracts";
import { AuditRepository } from "../../src/worker/data/audit";
import { StoryRepository } from "../../src/worker/data/stories";
import { UserRepository } from "../../src/worker/data/users";
import { AdminService } from "../../src/worker/moderation/admin-service";
import { ModerationService } from "../../src/worker/moderation/service";
import { AssetRepository } from "../../src/worker/uploads/assets";
import { MemoryKv } from "../utils/memory-kv";

const staff: UserProfile = {
  githubId: "staff-1",
  login: "reviewer",
  name: "Reviewer",
  avatarUrl: "",
  profileUrl: "https://github.com/reviewer",
  role: "STAFF",
  createdAt: "2026-07-25T00:00:00.000Z",
  updatedAt: "2026-07-25T00:00:00.000Z",
};

function pendingStory(): StoryRevision {
  return {
    storyId: "story-1",
    revisionId: "revision-1",
    authorGithubId: "user-1",
    authorLogin: "builder",
    authorName: "Builder",
    authorAvatarUrl: "",
    authorProfileUrl: "https://github.com/builder",
    title: "待审核",
    body: "正文",
    anonymous: false,
    images: [],
    status: "pending",
    createdAt: "2026-07-25T00:00:00.000Z",
    updatedAt: "2026-07-25T00:00:00.000Z",
    submittedAt: "2026-07-25T00:00:00.000Z",
    publishedAt: null,
  };
}

describe("moderation", () => {
  it("allows staff to approve a pending revision", async () => {
    const kv = new MemoryKv() as unknown as KVNamespace;
    const stories = new StoryRepository(kv);
    await stories.create(pendingStory());
    const service = new ModerationService(
      stories,
      new AssetRepository(kv),
      new AuditRepository(kv),
    );

    const approved = await service.approve(staff, "story-1", "revision-1");
    expect(approved.status).toBe("published");
  });

  it("prevents demoting a bootstrap administrator", async () => {
    const kv = new MemoryKv() as unknown as KVNamespace;
    const users = new UserRepository(kv);
    await users.upsert({ ...staff, githubId: "root", login: "icebraker", role: "ADMIN" });
    const service = new AdminService(users, new AuditRepository(kv), ["icebraker"]);

    await expect(
      service.setRole({ ...staff, role: "ADMIN" }, "root", "USER"),
    ).rejects.toThrow(
      "Bootstrap administrator cannot be demoted",
    );
  });
});
