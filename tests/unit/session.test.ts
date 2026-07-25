import { describe, expect, it } from "vitest";

import { SessionStore, sessionCookie } from "../../src/worker/auth/session";
import { MemoryKv } from "../utils/memory-kv";

describe("SessionStore", () => {
  it("creates and resolves an opaque session", async () => {
    const store = new SessionStore(
      new MemoryKv() as unknown as KVNamespace,
      "test-secret-with-enough-entropy",
    );
    const token = await store.create("github-123");

    expect(token).not.toContain("github-123");
    expect(await store.resolve(token)).toMatchObject({ githubId: "github-123" });
  });

  it("consumes OAuth state once", async () => {
    const store = new SessionStore(
      new MemoryKv() as unknown as KVNamespace,
      "test-secret-with-enough-entropy",
    );
    const state = await store.createOAuthState();

    expect(await store.consumeOAuthState(state)).toBe(true);
    expect(await store.consumeOAuthState(state)).toBe(false);
  });

  it("creates a hardened production cookie", () => {
    expect(sessionCookie("token", true)).toContain("HttpOnly");
    expect(sessionCookie("token", true)).toContain("Secure");
    expect(sessionCookie("token", true)).toContain("SameSite=Lax");
  });
});
