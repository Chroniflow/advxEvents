import type { Role, UserProfile } from "../../shared/contracts";
import { keys } from "./keys";

export class UserRepository {
  constructor(private readonly kv: KVNamespace) {}

  get(githubId: string): Promise<UserProfile | null> {
    return this.kv.get<UserProfile>(keys.user(githubId), "json");
  }

  async upsert(profile: UserProfile): Promise<void> {
    await this.kv.put(keys.user(profile.githubId), JSON.stringify(profile));
  }

  async setRole(githubId: string, role: Role, updatedAt: string): Promise<UserProfile> {
    const existing = await this.get(githubId);
    if (!existing) throw new Error("User not found");
    const next = { ...existing, role, updatedAt };
    await this.upsert(next);
    return next;
  }
}

