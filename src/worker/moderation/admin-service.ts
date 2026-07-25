import type { Role, UserProfile } from "../../shared/contracts";
import type { AuditRepository } from "../data/audit";
import type { UserRepository } from "../data/users";

export class AdminService {
  constructor(
    private readonly users: UserRepository,
    private readonly audit: AuditRepository,
    private readonly bootstrapLogins: string[],
  ) {}

  async setRole(
    actor: UserProfile,
    targetGithubId: string,
    role: Role,
  ): Promise<UserProfile> {
    if (actor.role !== "ADMIN") throw new Error("Administrator required");
    const target = await this.users.get(targetGithubId);
    if (!target) throw new Error("User not found");
    const isBootstrap = this.bootstrapLogins.some(
      (login) => login.toLowerCase() === target.login.toLowerCase(),
    );
    if (isBootstrap && role !== "ADMIN") {
      throw new Error("Bootstrap administrator cannot be demoted");
    }
    const updated = await this.users.setRole(
      targetGithubId,
      role,
      new Date().toISOString(),
    );
    await this.audit.append({
      eventId: crypto.randomUUID(), actorGithubId: actor.githubId,
      action: "user.role-change", targetType: "user", targetId: targetGithubId,
      reason: role, createdAt: new Date().toISOString(),
    });
    return updated;
  }
}
