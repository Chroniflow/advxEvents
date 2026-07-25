import type { StoryRevision } from "../../shared/contracts";
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
    const record = await this.getStory(storyId);
    if (!record?.publishedRevisionId) return null;
    return this.getRevision(storyId, record.publishedRevisionId);
  }

  async getCurrentRevision(storyId: string): Promise<StoryRevision | null> {
    const record = await this.getStory(storyId);
    if (!record) return null;
    return this.getRevision(storyId, record.currentRevisionId);
  }

  async listOwner(githubId: string, limit = 100): Promise<StoryRevision[]> {
    const list = await this.kv.list({
      prefix: `indexes:owner:${githubId}:`,
      limit,
    });
    const revisions = await Promise.all(
      list.keys.map(({ name }) => {
        const storyId = name.split(":").at(-1);
        return storyId ? this.getCurrentRevision(storyId) : null;
      }),
    );
    return revisions.filter((item): item is StoryRevision => item !== null);
  }

  async listPending(limit = 50): Promise<StoryRevision[]> {
    const list = await this.kv.list({ prefix: "indexes:pending:", limit });
    const revisions = await Promise.all(
      list.keys.map(({ name }) => {
        const parts = name.split(":");
        const revisionId = parts.at(-1);
        const storyId = parts.at(-2);
        return storyId && revisionId ? this.getRevision(storyId, revisionId) : null;
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
        if (!revisionId || !storyId) return null;
        return this.getRevision(storyId, revisionId);
      }),
    );
    return revisions.filter((item): item is StoryRevision => item !== null);
  }
}
