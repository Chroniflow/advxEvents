import { keys } from "../data/keys";
import { StoryRepository } from "../data/stories";
import type { Env } from "../env";
import { likeDirectory } from "../likes/client";
import { AssetRepository } from "../uploads/assets";

interface QueuedObject { assetId: string; objectKey: string; attempts: number }
export interface GcStats { purgedStories: number; deletedObjects: number; queuedObjects: number; }

export class GarbageCollectionService {
  constructor(
    private readonly kv: KVNamespace,
    private readonly stories: StoryRepository,
    private readonly assets: AssetRepository,
    private readonly bucket: R2Bucket,
    private readonly purgeLikes: (storyId: string) => Promise<unknown>,
  ) {}

  async run(now = new Date()): Promise<GcStats> {
    const stats: GcStats = { purgedStories: 0, deletedObjects: 0, queuedObjects: 0 };
    const queued = await this.kv.list({ prefix: "gc:r2:", limit: 50 });
    for (const { name } of queued.keys) {
      const item = await this.kv.get<QueuedObject>(name, "json");
      if (!item) continue;
      if (await this.stories.isAssetReferencedElsewhere(item.assetId, "")) {
        await this.kv.delete(name);
        continue;
      }
      try {
        const asset = await this.assets.get(item.assetId);
        if (!asset) { await this.kv.delete(name); continue; }
        await this.bucket.delete(asset.objectKey);
        await Promise.all([this.assets.delete(item.assetId), this.kv.delete(name)]);
        stats.deletedObjects++;
      } catch {
        await this.kv.put(name, JSON.stringify({ ...item, attempts: item.attempts + 1 }));
      }
    }

    for (const deletion of await this.stories.listExpiredDeletions(now.toISOString())) {
      const currentDeletion = await this.stories.getDeletion(deletion.storyId);
      if (!currentDeletion || currentDeletion.deletedAt !== deletion.deletedAt || currentDeletion.purgeAt !== deletion.purgeAt) continue;
      const revisions = await this.stories.listRevisions(deletion.storyId);
      const images = new Map(revisions.flatMap((revision) => revision.images).map((image) => [image.assetId, image]));
      for (const image of images.values()) {
        if (await this.stories.isAssetReferencedElsewhere(image.assetId, deletion.storyId)) continue;
        const asset = await this.assets.get(image.assetId);
        if (!asset) continue;
        try {
          await this.bucket.delete(asset.objectKey);
          await this.assets.delete(image.assetId);
          stats.deletedObjects++;
        } catch {
          const queuedObject: QueuedObject = { assetId: image.assetId, objectKey: asset.objectKey, attempts: 1 };
          await this.kv.put(keys.gcObject(asset.objectKey), JSON.stringify(queuedObject));
          stats.queuedObjects++;
        }
      }
      try { await this.purgeLikes(deletion.storyId); } catch { continue; }
      const deletionBeforePurge = await this.stories.getDeletion(deletion.storyId);
      if (!deletionBeforePurge || deletionBeforePurge.deletedAt !== deletion.deletedAt || deletionBeforePurge.purgeAt !== deletion.purgeAt) continue;
      await this.stories.purgeStory(deletion);
      stats.purgedStories++;
    }
    return stats;
  }
}

export function garbageCollection(env: Env): GarbageCollectionService {
  return new GarbageCollectionService(
    env.CONTENT,
    new StoryRepository(env.CONTENT),
    new AssetRepository(env.CONTENT),
    env.MEDIA,
    (storyId) => likeDirectory(env).fetch(new Request(`https://likes/stories/${encodeURIComponent(storyId)}/purge`, { method: "DELETE" })),
  );
}
