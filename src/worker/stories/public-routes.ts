import { Hono } from "hono";

import type { PublicStoryWithLikes } from "../../shared/contracts";
import { StoryRepository } from "../data/stories";
import type { Env } from "../env";
import { likeDirectory } from "../likes/client";
import { orderPublicStories, type StorySort } from "./public-service";
import { toPublicStory } from "./serialize";

interface HotItem {
  storyId: string;
  count: number;
}

async function hotItems(env: Env): Promise<HotItem[]> {
  try {
    const response = await likeDirectory(env).fetch(
      new Request("https://likes/hottest?limit=500"),
    );
    return response.ok ? response.json<HotItem[]>() : [];
  } catch {
    return [];
  }
}

export function publicStoryRoutes() {
  const routes = new Hono<{ Bindings: Env }>();

  routes.get("/", async (context) => {
    const requested = context.req.query("sort");
    const sort: StorySort =
      requested === "hottest" || requested === "random" ? requested : "latest";
    const [revisions, hot] = await Promise.all([
      new StoryRepository(context.env.CONTENT).listPublished(200),
      hotItems(context.env),
    ]);
    const counts = new Map(hot.map((item) => [item.storyId, item.count]));
    const ordered = orderPublicStories(
      revisions,
      sort,
      hot.map((item) => item.storyId),
    );
    const stories: PublicStoryWithLikes[] = ordered.map((revision) => ({
      ...toPublicStory(revision),
      likeCount: counts.get(revision.storyId) ?? 0,
    }));
    return context.json({ stories, sort });
  });

  routes.get("/:storyId", async (context) => {
    const revision = await new StoryRepository(context.env.CONTENT).getPublishedRevision(
      context.req.param("storyId"),
    );
    if (!revision || revision.status !== "published") {
      return context.json({ error: "Story not found" }, 404);
    }
    const likeResponse = await likeDirectory(context.env).fetch(
      new Request(`https://likes/stories/${encodeURIComponent(revision.storyId)}`),
    );
    const like = likeResponse.ok
      ? await likeResponse.json<{ count: number }>()
      : { count: 0 };
    return context.json({ ...toPublicStory(revision), likeCount: like.count });
  });

  return routes;
}

