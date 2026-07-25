export class LikeLedger {
  private readonly likes = new Map<string, Set<string>>();

  like(storyId: string, userId: string): void {
    const users = this.likes.get(storyId) ?? new Set<string>();
    users.add(userId);
    this.likes.set(storyId, users);
  }

  unlike(storyId: string, userId: string): void {
    this.likes.get(storyId)?.delete(userId);
  }

  hasLiked(storyId: string, userId: string): boolean {
    return this.likes.get(storyId)?.has(userId) ?? false;
  }

  count(storyId: string): number {
    return this.likes.get(storyId)?.size ?? 0;
  }

  hottest(storyIds: string[]): Array<{ storyId: string; count: number }> {
    return storyIds
      .map((storyId) => ({ storyId, count: this.count(storyId) }))
      .sort((left, right) => right.count - left.count || left.storyId.localeCompare(right.storyId));
  }
}

