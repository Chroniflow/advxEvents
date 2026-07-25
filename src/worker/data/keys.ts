export const keys = {
  user: (githubId: string) => `users:${githubId}`,
  storyMeta: (storyId: string) => `stories:${storyId}:meta`,
  storyRevision: (storyId: string, revisionId: string) =>
    `stories:${storyId}:revision:${revisionId}`,
  publishedIndex: (publishedAt: string, storyId: string) =>
    `indexes:published:${publishedAt}:${storyId}`,
  pendingIndex: (submittedAt: string, storyId: string, revisionId: string) =>
    `indexes:pending:${submittedAt}:${storyId}:${revisionId}`,
  ownerIndex: (githubId: string, storyId: string) =>
    `indexes:owner:${githubId}:${storyId}`,
  operation: (operationId: string) => `operations:${operationId}`,
  session: (digest: string) => `sessions:${digest}`,
  oauthState: (digest: string) => `oauth-state:${digest}`,
  asset: (assetId: string) => `assets:${assetId}`,
  review: (storyId: string, revisionId: string) =>
    `reviews:${storyId}:${revisionId}`,
  audit: (timestamp: string, eventId: string) => `audit:${timestamp}:${eventId}`,
};
