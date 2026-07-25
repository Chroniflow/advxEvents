import type { StoryRevision } from "../../shared/contracts";

export type StorySort = "latest" | "hottest" | "random";

export function orderPublicStories(
  stories: StoryRevision[],
  sort: StorySort,
  hotOrder: string[] = [],
  random: () => number = Math.random,
): StoryRevision[] {
  const published = stories.filter(
    (story) => story.status === "published" && story.publishedAt,
  );
  if (sort === "hottest") {
    const rank = new Map(hotOrder.map((storyId, index) => [storyId, index]));
    return [...published].sort(
      (left, right) =>
        (rank.get(left.storyId) ?? Number.MAX_SAFE_INTEGER) -
          (rank.get(right.storyId) ?? Number.MAX_SAFE_INTEGER) ||
        (right.publishedAt ?? "").localeCompare(left.publishedAt ?? ""),
    );
  }
  if (sort === "random") {
    return [...published].sort(() => random() - 0.5);
  }
  return [...published].sort((left, right) =>
    (right.publishedAt ?? "").localeCompare(left.publishedAt ?? ""),
  );
}

