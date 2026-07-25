import type { StoryRevision } from "../../shared/contracts";

export async function hashStoryContent(revision: StoryRevision): Promise<string> {
  const content = JSON.stringify({
    title: revision.title,
    body: revision.body,
    anonymous: revision.anonymous,
    images: revision.images.map(({ assetId, order, caption }) => ({ assetId, order, caption })),
  });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(content));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
