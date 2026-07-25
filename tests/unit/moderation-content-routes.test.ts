import { describe, expect, it } from "vitest";

import type { StoryRevision, UserProfile } from "../../src/shared/contracts";
import { createApp } from "../../src/worker/app";
import { SessionStore } from "../../src/worker/auth/session";
import { UserRepository } from "../../src/worker/data/users";
import { StoryRepository } from "../../src/worker/data/stories";
import type { Env } from "../../src/worker/env";
import { MemoryKv } from "../utils/memory-kv";

const secret = "test-secret-with-enough-entropy";

function env(kv: KVNamespace): Env {
  return { CONTENT: kv, ASSETS: { fetch: async () => new Response("asset") } as unknown as Fetcher, MEDIA: {} as R2Bucket, LIKES: {} as DurableObjectNamespace, SESSION_SECRET: secret, ADMIN_GITHUB_USERS: "", APP_ORIGIN: "https://example.com", GITHUB_CLIENT_ID: "id", GITHUB_CLIENT_SECRET: "secret" };
}

async function cookie(kv: KVNamespace, role: UserProfile["role"]): Promise<string> {
  const user = { githubId: role, login: role.toLowerCase(), name: role, avatarUrl: "", profileUrl: "", role, createdAt: "", updatedAt: "" } satisfies UserProfile;
  await new UserRepository(kv).upsert(user);
  return `advx_session=${await new SessionStore(kv, secret).create(user.githubId)}`;
}

const published = { storyId: "s1", revisionId: "r1", authorGithubId: "owner", authorLogin: "owner", authorName: null, authorAvatarUrl: "", authorProfileUrl: "", title: "已发布帖子", body: "正文", anonymous: false, images: [], status: "published", createdAt: "2026-07-01T00:00:00Z", updatedAt: "2026-07-01T00:00:00Z", submittedAt: null, publishedAt: "2026-07-01T00:00:00Z" } satisfies StoryRevision;

describe("后台已发布内容路由", () => {
  it("STAFF 可以读取已发布帖子", async () => {
    const kv = new MemoryKv() as unknown as KVNamespace;
    const stories = new StoryRepository(kv);
    await stories.create(published);
    await stories.publishRevision("s1", "r1", "test-publish");
    const response = await createApp().request("/api/admin/published", { headers: { Cookie: await cookie(kv, "STAFF") } }, env(kv));
    expect(response.status).toBe(200);
    expect((await response.json<{ stories: StoryRevision[] }>()).stories[0]?.title).toBe("已发布帖子");
  });

  it("普通用户不能读取已发布管理列表", async () => {
    const kv = new MemoryKv() as unknown as KVNamespace;
    const response = await createApp().request("/api/admin/published", { headers: { Cookie: await cookie(kv, "USER") } }, env(kv));
    expect(response.status).toBe(403);
  });
});
