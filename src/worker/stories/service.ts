import type { z } from "zod";

import type { StoryRevision, UserProfile } from "../../shared/contracts";
import { draftInputSchema } from "../../shared/schemas";
import type { StoryRepository } from "../data/stories";
import { transitionStory } from "./lifecycle";

type DraftInput = z.infer<typeof draftInputSchema>;

export class StoryService {
  constructor(private readonly stories: StoryRepository) {}

  async createDraft(user: UserProfile, input: DraftInput): Promise<StoryRevision> {
    const parsed = draftInputSchema.parse(input);
    const now = new Date().toISOString();
    const revision: StoryRevision = {
      storyId: crypto.randomUUID(),
      revisionId: crypto.randomUUID(),
      authorGithubId: user.githubId,
      authorLogin: user.login,
      authorName: user.name,
      authorAvatarUrl: user.avatarUrl,
      authorProfileUrl: user.profileUrl,
      ...parsed,
      status: "draft",
      createdAt: now,
      updatedAt: now,
      submittedAt: null,
      publishedAt: null,
    };
    await this.stories.create(revision);
    return revision;
  }

  async updateDraft(
    user: UserProfile,
    storyId: string,
    input: DraftInput,
  ): Promise<StoryRevision> {
    const current = await this.requireOwned(user, storyId);
    const deleted = await this.stories.getDeletion(storyId);
    if (deleted && deleted.deletedByRole !== "USER") throw new Error("Story is not editable");
    if (!deleted && current.status !== "draft" && current.status !== "rejected") {
      throw new Error("Story is not editable");
    }
    const parsed = draftInputSchema.parse(input);
    const now = new Date().toISOString();
    const revision: StoryRevision = {
      ...current,
      ...parsed,
      revisionId: crypto.randomUUID(),
      status: "draft",
      updatedAt: now,
      submittedAt: null,
    };
    await this.stories.saveRevision(revision);
    return revision;
  }

  async submit(user: UserProfile, storyId: string): Promise<StoryRevision> {
    if (await this.stories.getDeletion(storyId)) throw new Error("Restore story before submitting");
    const current = await this.requireOwned(user, storyId);
    const now = new Date().toISOString();
    const revision: StoryRevision = {
      ...current,
      status: transitionStory(current.status, "submit"),
      submittedAt: now,
      updatedAt: now,
    };
    await this.stories.saveRevision(revision);
    return revision;
  }

  async withdraw(user: UserProfile, storyId: string): Promise<StoryRevision> {
    if (await this.stories.getDeletion(storyId)) throw new Error("Restore story before withdrawing");
    const current = await this.requireOwned(user, storyId);
    const now = new Date().toISOString();
    const withdrawn: StoryRevision = {
      ...current,
      status: transitionStory(current.status, "withdraw"),
      updatedAt: now,
    };
    await this.stories.saveRevision(withdrawn);
    const draft: StoryRevision = {
      ...withdrawn,
      revisionId: crypto.randomUUID(),
      status: transitionStory(withdrawn.status, "revise"),
      submittedAt: null,
      updatedAt: now,
    };
    await this.stories.saveRevision(draft);
    return draft;
  }

  private async requireOwned(user: UserProfile, storyId: string) {
    const record = await this.stories.getStory(storyId);
    if (!record) throw new Error("Story not found");
    if (record.ownerGithubId !== user.githubId) {
      throw new Error("Story owner mismatch");
    }
    const current = await this.stories.getCurrentRevision(storyId);
    if (!current) throw new Error("Story revision not found");
    return current;
  }
}
