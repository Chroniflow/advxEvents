import { Hono } from "hono";

import type { AuthVariables } from "../auth/middleware";
import { requireUser } from "../auth/middleware";
import { readSessionCookie, SessionStore } from "../auth/session";
import { StoryRepository } from "../data/stories";
import type { Env } from "../env";
import { likeDirectory } from "./client";

export function likeRoutes() {
  const routes = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

  routes.get("/hottest", async (context) => {
    const response = await likeDirectory(context.env).fetch(
      new Request("https://likes/hottest?limit=100"),
    );
    return new Response(response.body, response);
  });

  routes.get("/:storyId", async (context) => {
    const story = await new StoryRepository(context.env.CONTENT).getPublishedRevision(context.req.param("storyId"));
    if (!story || story.status !== "published") return context.json({ error: "Story not found" }, 404);
    const token = readSessionCookie(context.req.header("Cookie") ?? null);
    const session = token
      ? await new SessionStore(context.env.CONTENT, context.env.SESSION_SECRET).resolve(token)
      : null;
    const url = new URL(`https://likes/stories/${encodeURIComponent(context.req.param("storyId"))}`);
    if (session) url.searchParams.set("userId", session.githubId);
    const response = await likeDirectory(context.env).fetch(new Request(url));
    return new Response(response.body, response);
  });

  routes.put("/:storyId", requireUser(), async (context) => {
    const story = await new StoryRepository(context.env.CONTENT).getPublishedRevision(
      context.req.param("storyId"),
    );
    if (!story || story.status !== "published") {
      return context.json({ error: "Story not found" }, 404);
    }
    const response = await likeDirectory(context.env).fetch(
      new Request(`https://likes/stories/${encodeURIComponent(story.storyId)}`, {
        method: "PUT",
        body: JSON.stringify({ userId: context.get("user").githubId }),
      }),
    );
    return new Response(response.body, response);
  });

  routes.delete("/:storyId", requireUser(), async (context) => {
    const story = await new StoryRepository(context.env.CONTENT).getPublishedRevision(context.req.param("storyId"));
    if (!story || story.status !== "published") return context.json({ error: "Story not found" }, 404);
    const response = await likeDirectory(context.env).fetch(
      new Request(
        `https://likes/stories/${encodeURIComponent(context.req.param("storyId"))}`,
        {
          method: "DELETE",
          body: JSON.stringify({ userId: context.get("user").githubId }),
        },
      ),
    );
    return new Response(response.body, response);
  });

  return routes;
}
