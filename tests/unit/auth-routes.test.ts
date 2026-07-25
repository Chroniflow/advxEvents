import { describe, expect, it } from "vitest";

import { createApp } from "../../src/worker/app";
import type { Env } from "../../src/worker/env";
import { MemoryKv } from "../utils/memory-kv";

function makeEnv(): Env {
  return {
    CONTENT: new MemoryKv() as unknown as KVNamespace,
    ASSETS: { fetch: async () => new Response("asset") } as unknown as Fetcher,
    MEDIA: {} as R2Bucket,
    GITHUB_CLIENT_ID: "client-id",
    GITHUB_CLIENT_SECRET: "client-secret",
    SESSION_SECRET: "test-secret-with-enough-entropy",
    ADMIN_GITHUB_USERS: "icebraker",
    APP_ORIGIN: "https://example.com",
  };
}

describe("auth routes", () => {
  it("rejects an OAuth callback with an unknown state", async () => {
    const response = await createApp().request(
      "/api/auth/github/callback?code=x&state=wrong",
      {},
      makeEnv(),
    );
    expect(response.status).toBe(400);
  });

  it("starts OAuth with a GitHub redirect", async () => {
    const response = await createApp().request("/api/auth/github", {}, makeEnv());
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("github.com/login/oauth/authorize");
  });
});
