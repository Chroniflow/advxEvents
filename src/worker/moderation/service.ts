import type { StoryRevision, UserProfile } from "../../shared/contracts";
import type { AssetRepository } from "../uploads/assets";
import type { AuditRepository } from "../data/audit";
import type { StoryRepository } from "../data/stories";

export class ModerationService {
  constructor(
    private readonly stories: StoryRepository,
    private readonly assets: AssetRepository,
    private readonly audit: AuditRepository,
  ) {}

  async approve(
    actor: UserProfile,
    storyId: string,
    revisionId: string,
  ): Promise<StoryRevision> {
    if (actor.role !== "STAFF" && actor.role !== "ADMIN") throw new Error("Staff required");
    if (await this.stories.getDeletion(storyId)) throw new Error("Deleted story cannot be reviewed");
    const revision = await this.stories.getRevision(storyId, revisionId);
    if (!revision || revision.status !== "pending") throw new Error("Pending revision not found");
    await this.stories.publishRevision(
      storyId,
      revisionId,
      `approve:${storyId}:${revisionId}`,
    );
    await this.assets.markPublic(revision.images.map((image) => image.assetId));
    const approved = await this.stories.getRevision(storyId, revisionId);
    await this.audit.append({
      eventId: crypto.randomUUID(),
      actorGithubId: actor.githubId,
      action: "story.approve",
      targetType: "revision",
      targetId: `${storyId}:${revisionId}`,
      createdAt: new Date().toISOString(),
    });
    if (!approved) throw new Error("Approved revision missing");
    return approved;
  }

  async reject(
    actor: UserProfile,
    storyId: string,
    revisionId: string,
    reason: string,
  ): Promise<StoryRevision> {
    if (actor.role !== "STAFF" && actor.role !== "ADMIN") throw new Error("Staff required");
    if (!reason.trim()) throw new Error("Rejection reason required");
    if (await this.stories.getDeletion(storyId)) throw new Error("Deleted story cannot be reviewed");
    const revision = await this.stories.getRevision(storyId, revisionId);
    if (!revision || revision.status !== "pending") throw new Error("Pending revision not found");
    const rejected = await this.stories.setRevisionStatus(storyId, revisionId, "rejected");
    await this.audit.append({
      eventId: crypto.randomUUID(), actorGithubId: actor.githubId,
      action: "story.reject", targetType: "revision",
      targetId: `${storyId}:${revisionId}`, reason: reason.trim(),
      createdAt: new Date().toISOString(),
    });
    return rejected;
  }

  async setPublication(
    actor: UserProfile,
    storyId: string,
    published: boolean,
  ): Promise<StoryRevision> {
    if (actor.role !== "STAFF" && actor.role !== "ADMIN") throw new Error("Staff required");
    const revision = await this.stories.getPublishedRevision(storyId);
    if (!revision) throw new Error("Published revision not found");
    const next = await this.stories.setRevisionStatus(
      storyId,
      revision.revisionId,
      published ? "published" : "unpublished",
    );
    await this.audit.append({
      eventId: crypto.randomUUID(), actorGithubId: actor.githubId,
      action: published ? "story.restore" : "story.unpublish",
      targetType: "story", targetId: storyId,
      createdAt: new Date().toISOString(),
    });
    return next;
  }
}
