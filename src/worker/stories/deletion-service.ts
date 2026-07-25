import type { StoryDeletion, StoryRevision, UserProfile } from "../../shared/contracts";
import type { StoryRepository } from "../data/stories";
import { hashStoryContent } from "./content-hash";

const RETENTION_MS = 14 * 24 * 60 * 60 * 1_000;

export class StoryDeletionService {
  constructor(
    private readonly stories: StoryRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async delete(actor: UserProfile, storyId: string): Promise<StoryDeletion> {
    const [record, existing, current] = await Promise.all([
      this.stories.getStory(storyId), this.stories.getDeletion(storyId), this.stories.getCurrentRevision(storyId),
    ]);
    if (!record || !current) throw new Error("Story not found");
    if (existing) throw new Error("Story already deleted");
    if (record.ownerGithubId !== actor.githubId && actor.role === "USER") throw new Error("Insufficient permissions");
    const deletedAt = this.now();
    const deletion: StoryDeletion = {
      storyId, deletedAt: deletedAt.toISOString(),
      purgeAt: new Date(deletedAt.getTime() + RETENTION_MS).toISOString(),
      deletedByGithubId: actor.githubId, deletedByRole: actor.role,
      previousStatus: current.status, revisionId: current.revisionId,
      contentHash: await hashStoryContent(current),
    };
    await this.stories.removeActiveIndexes(current);
    await this.stories.saveDeletion(deletion);
    return deletion;
  }

  async restore(actor: UserProfile, storyId: string): Promise<StoryRevision> {
    const [record, deletion, current] = await Promise.all([
      this.stories.getStory(storyId), this.stories.getDeletion(storyId), this.stories.getCurrentRevision(storyId),
    ]);
    if (!record || !deletion || !current) throw new Error("Deleted story not found");
    const actorIsStaff = actor.role === "STAFF" || actor.role === "ADMIN";
    const authorCanRestore = record.ownerGithubId === actor.githubId && deletion.deletedByRole === "USER";
    if (!actorIsStaff && !authorCanRestore) throw new Error("Insufficient permissions");
    const unchanged = await hashStoryContent(current) === deletion.contentHash;
    const restorePrevious = deletion.deletedByRole !== "USER" || unchanged;
    const restored: StoryRevision = {
      ...current,
      status: restorePrevious ? deletion.previousStatus : "draft",
      submittedAt: restorePrevious ? current.submittedAt : null,
      publishedAt: restorePrevious ? current.publishedAt : null,
      updatedAt: this.now().toISOString(),
    };
    await this.stories.saveRevision(restored);
    await this.stories.removeDeletion(deletion);
    await this.stories.restoreIndexes(restored);
    return restored;
  }
}
