import type { StoryDeletion, StoryRevision, StoryRevisionView } from "../../shared/contracts";
import { keys } from "./keys";

export interface StoryRecord {
  storyId: string;
  ownerGithubId: string;
  currentRevisionId: string;
  publishedRevisionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export class StoryRepository {
  constructor(private readonly kv: KVNamespace) {}

  async create(revision: StoryRevision): Promise<StoryRecord> {
    if (await this.getStory(revision.storyId)) throw new Error("Story already exists");
    const record: StoryRecord = {
      storyId: revision.storyId,
      ownerGithubId: revision.authorGithubId,
      currentRevisionId: revision.revisionId,
      publishedRevisionId: null,
      createdAt: revision.createdAt,
      updatedAt: revision.updatedAt,
    };
    await Promise.all([
      this.kv.put(keys.storyMeta(revision.storyId), JSON.stringify(record)),
      this.kv.put(
        keys.storyRevision(revision.storyId, revision.revisionId),
        JSON.stringify(revision),
      ),
      this.kv.put(keys.ownerIndex(revision.authorGithubId, revision.storyId), "1"),
    ]);
    return record;
  }

  getStory(storyId: string): Promise<StoryRecord | null> {
    return this.kv.get<StoryRecord>(keys.storyMeta(storyId), "json");
  }

  getDeletion(storyId: string): Promise<StoryDeletion | null> {
    return this.kv.get<StoryDeletion>(keys.storyDeletion(storyId), "json");
  }

  async saveDeletion(deletion: StoryDeletion): Promise<void> {
    await Promise.all([
      this.kv.put(keys.storyDeletion(deletion.storyId), JSON.stringify(deletion)),
      this.kv.put(keys.deletionIndex(deletion.purgeAt, deletion.storyId), deletion.storyId),
    ]);
  }

  async removeDeletion(deletion: StoryDeletion): Promise<void> {
    await Promise.all([
      this.kv.delete(keys.storyDeletion(deletion.storyId)),
      this.kv.delete(keys.deletionIndex(deletion.purgeAt, deletion.storyId)),
    ]);
  }

  getRevision(storyId: string, revisionId: string): Promise<StoryRevision | null> {
    return this.kv.get<StoryRevision>(
      keys.storyRevision(storyId, revisionId),
      "json",
    );
  }

  async saveRevision(revision: StoryRevision): Promise<void> {
    const record = await this.getStory(revision.storyId);
    if (!record) throw new Error("Story not found");
    if (record.ownerGithubId !== revision.authorGithubId) {
      throw new Error("Story owner mismatch");
    }
    record.currentRevisionId = revision.revisionId;
    record.updatedAt = revision.updatedAt;
    await Promise.all([
      this.kv.put(
        keys.storyRevision(revision.storyId, revision.revisionId),
        JSON.stringify(revision),
      ),
      this.kv.put(keys.storyMeta(revision.storyId), JSON.stringify(record)),
    ]);
    if (revision.status === "pending" && revision.submittedAt) {
      await this.kv.put(
        keys.pendingIndex(revision.submittedAt, revision.storyId, revision.revisionId),
        "1",
      );
    }
  }

  async publishRevision(
    storyId: string,
    revisionId: string,
    operationId: string,
  ): Promise<void> {
    const operationKey = keys.operation(operationId);
    if (await this.kv.get(operationKey)) return;
    const [record, revision] = await Promise.all([
      this.getStory(storyId),
      this.getRevision(storyId, revisionId),
    ]);
    if (!record || !revision) throw new Error("Story revision not found");
    const publishedAt = revision.publishedAt ?? new Date().toISOString();
    const publishedRevision: StoryRevision = {
      ...revision,
      status: "published",
      publishedAt,
      updatedAt: publishedAt,
    };
    record.publishedRevisionId = revisionId;
    record.updatedAt = publishedAt;
    await Promise.all([
      this.kv.put(
        keys.storyRevision(storyId, revisionId),
        JSON.stringify(publishedRevision),
      ),
      this.kv.put(keys.storyMeta(storyId), JSON.stringify(record)),
      this.kv.put(keys.publishedIndex(publishedAt, storyId), revisionId),
      this.kv.put(operationKey, "1", { expirationTtl: 60 * 60 * 24 * 30 }),
    ]);
  }

  async getPublishedRevision(storyId: string): Promise<StoryRevision | null> {
    if (await this.getDeletion(storyId)) return null;
    const record = await this.getStory(storyId);
    if (!record?.publishedRevisionId) return null;
    return this.getRevision(storyId, record.publishedRevisionId);
  }

  async getCurrentRevision(storyId: string): Promise<StoryRevision | null> {
    const record = await this.getStory(storyId);
    if (!record) return null;
    return this.getRevision(storyId, record.currentRevisionId);
  }

  async listOwner(githubId: string, limit = 100): Promise<StoryRevisionView[]> {
    const list = await this.kv.list({
      prefix: `indexes:owner:${githubId}:`,
      limit,
    });
    const revisions = await Promise.all(
      list.keys.map(async ({ name }) => {
        const storyId = name.split(":").at(-1);
        if (!storyId) return null;
        const [revision, deletion] = await Promise.all([
          this.getCurrentRevision(storyId), this.getDeletion(storyId),
        ]);
        return revision ? { ...revision, ...(deletion ? { deletion } : {}) } : null;
      }),
    );
    return revisions.filter((item): item is StoryRevisionView => item !== null);
  }

  async listPending(limit = 50): Promise<StoryRevision[]> {
    const list = await this.kv.list({ prefix: "indexes:pending:", limit });
    const revisions = await Promise.all(
      list.keys.map(async ({ name }) => {
        const parts = name.split(":");
        const revisionId = parts.at(-1);
        const storyId = parts.at(-2);
        if (!storyId || !revisionId || await this.getDeletion(storyId)) return null;
        return this.getRevision(storyId, revisionId);
      }),
    );
    return revisions.filter(
      (item): item is StoryRevision => item !== null && item.status === "pending",
    );
  }

  async setRevisionStatus(
    storyId: string,
    revisionId: string,
    status: StoryRevision["status"],
  ): Promise<StoryRevision> {
    const revision = await this.getRevision(storyId, revisionId);
    if (!revision) throw new Error("Story revision not found");
    const next = { ...revision, status, updatedAt: new Date().toISOString() };
    await this.kv.put(keys.storyRevision(storyId, revisionId), JSON.stringify(next));
    return next;
  }

  async listPublished(limit = 50): Promise<StoryRevision[]> {
    const list = await this.kv.list({ prefix: "indexes:published:", limit });
    const revisions = await Promise.all(
      list.keys.map(async ({ name }) => {
        const revisionId = await this.kv.get(name);
        const storyId = name.split(":").at(-1);
        if (!revisionId || !storyId || await this.getDeletion(storyId)) return null;
        return this.getRevision(storyId, revisionId);
      }),
    );
    return revisions.filter((item): item is StoryRevision => item !== null);
  }

  async removeActiveIndexes(revision: StoryRevision): Promise<void> {
    const removals: Promise<void>[] = [];
    if (revision.publishedAt) removals.push(this.kv.delete(keys.publishedIndex(revision.publishedAt, revision.storyId)));
    if (revision.submittedAt) removals.push(this.kv.delete(keys.pendingIndex(revision.submittedAt, revision.storyId, revision.revisionId)));
    await Promise.all(removals);
  }

  async restoreIndexes(revision: StoryRevision): Promise<void> {
    if (revision.status === "published" && revision.publishedAt) {
      await this.kv.put(keys.publishedIndex(revision.publishedAt, revision.storyId), revision.revisionId);
    } else if (revision.status === "pending" && revision.submittedAt) {
      await this.kv.put(keys.pendingIndex(revision.submittedAt, revision.storyId, revision.revisionId), "1");
    }
  }

  async listRevisions(storyId: string): Promise<StoryRevision[]> {
    const keys = await this.listAllKeys(`stories:${storyId}:revision:`);
    const revisions = await Promise.all(keys.map(({ name }) => this.kv.get<StoryRevision>(name, "json")));
    return revisions.filter((item): item is StoryRevision => item !== null);
  }

  async listExpiredDeletions(now: string, limit = 50): Promise<StoryDeletion[]> {
    const keys = await this.listAllKeys("indexes:deletions:");
    const deletions = await Promise.all(keys.map(async ({ name }) => {
      const storyId = await this.kv.get(name);
      return storyId ? this.getDeletion(storyId) : null;
    }));
    return deletions.filter((item): item is StoryDeletion => item !== null && item.purgeAt <= now).slice(0, limit);
  }

  async listDeleted(limit = 50): Promise<StoryRevisionView[]> {
    const list = await this.kv.list({ prefix: "indexes:deletions:", limit });
    const candidates = await Promise.all(list.keys.map(async ({ name }) => {
      const storyId = await this.kv.get(name);
      if (!storyId) return null;
      const [revision, deletion] = await Promise.all([this.getCurrentRevision(storyId), this.getDeletion(storyId)]);
      return revision && deletion ? { ...revision, deletion } : null;
    }));
    const items: StoryRevisionView[] = [];
    for (const candidate of candidates) {
      if (candidate) items.push(candidate);
    }
    return items;
  }

  async isAssetReferencedElsewhere(assetId: string, excludedStoryId: string): Promise<boolean> {
    const keys = await this.listAllKeys("stories:");
    for (const { name } of keys) {
      if (!name.includes(":revision:") || name.startsWith(`stories:${excludedStoryId}:`)) continue;
      const revision = await this.kv.get<StoryRevision>(name, "json");
      if (revision?.images.some((image) => image.assetId === assetId)) return true;
    }
    return false;
  }

  private async listAllKeys(prefix: string): Promise<{ name: string }[]> {
    const keys: { name: string }[] = [];
    let cursor: string | undefined;
    do {
      const page = await this.kv.list({ prefix, cursor });
      keys.push(...page.keys);
      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);
    return keys;
  }

  async purgeStory(deletion: StoryDeletion): Promise<void> {
    const [record, currentDeletion] = await Promise.all([
      this.getStory(deletion.storyId), this.getDeletion(deletion.storyId),
    ]);
    if (!record || !currentDeletion
      || currentDeletion.deletedAt !== deletion.deletedAt
      || currentDeletion.purgeAt !== deletion.purgeAt) return;
    const revisions = await this.listRevisions(deletion.storyId);
    await Promise.all([
      ...revisions.map((revision) => this.kv.delete(keys.storyRevision(revision.storyId, revision.revisionId))),
      this.kv.delete(keys.storyMeta(deletion.storyId)),
      this.kv.delete(keys.ownerIndex(record.ownerGithubId, deletion.storyId)),
      this.removeDeletion(deletion),
    ]);
  }
}
