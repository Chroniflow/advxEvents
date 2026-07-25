import type { PublicStory, StoryRevision } from "../../shared/contracts";

export function toPublicStory(revision: StoryRevision): PublicStory {
  if (!revision.publishedAt || revision.status !== "published") {
    throw new Error("Only published revisions can be serialized publicly");
  }

  return {
    storyId: revision.storyId,
    revisionId: revision.revisionId,
    title: revision.title,
    body: revision.body,
    images: revision.images,
    publishedAt: revision.publishedAt,
    author: revision.anonymous
      ? { anonymous: true }
      : {
          anonymous: false,
          login: revision.authorLogin,
          name: revision.authorName,
          avatarUrl: revision.authorAvatarUrl,
          profileUrl: revision.authorProfileUrl,
        },
  };
}
