import { describe, expect, it } from "vitest";

import { AssetRepository } from "../../src/worker/uploads/assets";
import { MemoryKv } from "../utils/memory-kv";

describe("AssetRepository", () => {
  it("returns an asset only to its owner before publication", async () => {
    const assets = new AssetRepository(new MemoryKv() as unknown as KVNamespace);
    await assets.save({
      assetId: "asset-1",
      ownerGithubId: "user-1",
      objectKey: "stories/unassigned/asset-1/original",
      contentType: "image/png",
      width: 100,
      height: 100,
      size: 24,
      originalName: "photo.png",
      public: false,
      createdAt: "2026-07-25T00:00:00.000Z",
    });

    expect(await assets.getOwned("asset-1", "user-1")).not.toBeNull();
    await expect(assets.getOwned("asset-1", "user-2")).rejects.toThrow(
      "Asset owner mismatch",
    );
  });
});
