import { describe, expect, it } from "vitest";

import type { StoryImage } from "../../src/shared/contracts";
import { normalizeImages } from "../../src/worker/stories/routes";
import { AssetRepository } from "../../src/worker/uploads/assets";
import { MemoryKv } from "../utils/memory-kv";

const forged: StoryImage = {
  assetId: "a1", objectKey: "objects/someone-else", contentType: "image/jpeg",
  width: 999, height: 999, size: 999, caption: "说明", order: 1,
};

describe("normalizeImages", () => {
  it("使用服务端资产记录覆盖客户端提供的 R2 元数据", async () => {
    const assets = new AssetRepository(new MemoryKv() as unknown as KVNamespace);
    await assets.save({ assetId: "a1", ownerGithubId: "u1", objectKey: "objects/a1", contentType: "image/png", width: 10, height: 20, size: 30, originalName: "a.png", public: false, createdAt: "2026-01-01T00:00:00Z" });

    await expect(normalizeImages(assets, "u1", [forged])).resolves.toEqual([{
      ...forged, objectKey: "objects/a1", contentType: "image/png", width: 10, height: 20, size: 30,
    }]);
  });

  it("拒绝不存在的资产", async () => {
    const assets = new AssetRepository(new MemoryKv() as unknown as KVNamespace);
    await expect(normalizeImages(assets, "u1", [forged])).rejects.toThrow("Asset not found");
  });
});
