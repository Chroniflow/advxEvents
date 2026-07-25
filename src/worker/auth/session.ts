import { keys } from "../data/keys";

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;
const OAUTH_STATE_TTL_SECONDS = 60 * 10;

interface SessionRecord {
  githubId: string;
  createdAt: string;
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

export class SessionStore {
  constructor(
    private readonly kv: KVNamespace,
    private readonly secret: string,
  ) {}

  private async digest(token: string): Promise<string> {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(this.secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const digest = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(token),
    );
    return base64Url(new Uint8Array(digest));
  }

  async create(githubId: string): Promise<string> {
    const token = randomToken();
    const digest = await this.digest(token);
    const record: SessionRecord = { githubId, createdAt: new Date().toISOString() };
    await this.kv.put(keys.session(digest), JSON.stringify(record), {
      expirationTtl: SESSION_TTL_SECONDS,
    });
    return token;
  }

  async resolve(token: string): Promise<SessionRecord | null> {
    const digest = await this.digest(token);
    return this.kv.get<SessionRecord>(keys.session(digest), "json");
  }

  async revoke(token: string): Promise<void> {
    const digest = await this.digest(token);
    await this.kv.delete(keys.session(digest));
  }

  async createOAuthState(): Promise<string> {
    const state = randomToken();
    const digest = await this.digest(state);
    await this.kv.put(keys.oauthState(digest), "1", {
      expirationTtl: OAUTH_STATE_TTL_SECONDS,
    });
    return state;
  }

  async consumeOAuthState(state: string): Promise<boolean> {
    const digest = await this.digest(state);
    const key = keys.oauthState(digest);
    const exists = await this.kv.get(key);
    if (!exists) return false;
    await this.kv.delete(key);
    return true;
  }
}

export function sessionCookie(token: string, secure: boolean): string {
  const parts = [
    `advx_session=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${SESSION_TTL_SECONDS}`,
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function clearSessionCookie(secure: boolean): string {
  const parts = [
    "advx_session=",
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function readSessionCookie(header: string | null): string | null {
  if (!header) return null;
  const pair = header
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith("advx_session="));
  return pair ? decodeURIComponent(pair.slice("advx_session=".length)) : null;
}
