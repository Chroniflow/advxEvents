import { keys } from "../data/keys";

export interface AssetRecord {
  assetId: string;
  ownerGithubId: string;
  objectKey: string;
  contentType: "image/jpeg" | "image/png" | "image/webp";
  width: number;
  height: number;
  size: number;
  originalName: string;
  public: boolean;
  createdAt: string;
}

export class AssetRepository {
  constructor(private readonly kv: KVNamespace) {}

  get(assetId: string): Promise<AssetRecord | null> {
    return this.kv.get<AssetRecord>(keys.asset(assetId), "json");
  }

  save(asset: AssetRecord): Promise<void> {
    return this.kv.put(keys.asset(asset.assetId), JSON.stringify(asset));
  }

  async getOwned(assetId: string, githubId: string): Promise<AssetRecord | null> {
    const asset = await this.get(assetId);
    if (!asset) return null;
    if (asset.ownerGithubId !== githubId) throw new Error("Asset owner mismatch");
    return asset;
  }

  async markPublic(assetIds: string[]): Promise<void> {
    await Promise.all(
      assetIds.map(async (assetId) => {
        const asset = await this.get(assetId);
        if (asset) await this.save({ ...asset, public: true });
      }),
    );
  }

  delete(assetId: string): Promise<void> {
    return this.kv.delete(keys.asset(assetId));
  }
}
