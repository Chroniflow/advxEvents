import { keys } from "./keys";

export interface AuditEvent {
  eventId: string;
  actorGithubId: string;
  action: string;
  targetType: "story" | "revision" | "user" | "settings";
  targetId: string;
  reason?: string;
  createdAt: string;
}

export class AuditRepository {
  constructor(private readonly kv: KVNamespace) {}

  async append(event: AuditEvent): Promise<void> {
    const key = keys.audit(event.createdAt, event.eventId);
    if (await this.kv.get(key)) throw new Error("Audit event already exists");
    await this.kv.put(key, JSON.stringify(event));
  }
}

