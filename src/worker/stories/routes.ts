import { Hono } from "hono";

import { draftInputSchema } from "../../shared/schemas";
import type { AuthVariables } from "../auth/middleware";
import { requireUser } from "../auth/middleware";
import { StoryRepository } from "../data/stories";
import type { Env } from "../env";
import { AssetRepository } from "../uploads/assets";
import { StoryService } from "./service";
import { StoryDeletionService } from "./deletion-service";

export function storyRoutes() {
  const routes = new Hono<{ Bindings: Env; Variables: AuthVariables }>();
  routes.use("*", requireUser());

  routes.get("/mine", async (context) => {
    const stories = await new StoryRepository(context.env.CONTENT).listOwner(
      context.get("user").githubId,
    );
    return context.json({ stories });
  });

  routes.post("/", async (context) => {
    const input = draftInputSchema.safeParse(await context.req.json());
    if (!input.success) return context.json({ error: input.error.flatten() }, 400);
    const assets = new AssetRepository(context.env.CONTENT);
    try {
      await Promise.all(
        input.data.images.map((image) =>
          assets.getOwned(image.assetId, context.get("user").githubId),
        ),
      );
    } catch (error) {
      return context.json({ error: (error as Error).message }, 403);
    }
    const revision = await new StoryService(
      new StoryRepository(context.env.CONTENT),
    ).createDraft(context.get("user"), input.data);
    return context.json(revision, 201);
  });

  routes.put("/:storyId/draft", async (context) => {
    const input = draftInputSchema.safeParse(await context.req.json());
    if (!input.success) return context.json({ error: input.error.flatten() }, 400);
    try {
      const assets = new AssetRepository(context.env.CONTENT);
      await Promise.all(
        input.data.images.map((image) =>
          assets.getOwned(image.assetId, context.get("user").githubId),
        ),
      );
      const revision = await new StoryService(
        new StoryRepository(context.env.CONTENT),
      ).updateDraft(context.get("user"), context.req.param("storyId"), input.data);
      return context.json(revision);
    } catch (error) {
      return context.json({ error: (error as Error).message }, 409);
    }
  });

  routes.post("/:storyId/submit", async (context) => {
    try {
      return context.json(
        await new StoryService(new StoryRepository(context.env.CONTENT)).submit(
          context.get("user"),
          context.req.param("storyId"),
        ),
      );
    } catch (error) {
      return context.json({ error: (error as Error).message }, 409);
    }
  });

  routes.post("/:storyId/withdraw", async (context) => {
    try {
      return context.json(
        await new StoryService(new StoryRepository(context.env.CONTENT)).withdraw(
          context.get("user"),
          context.req.param("storyId"),
        ),
      );
    } catch (error) {
      return context.json({ error: (error as Error).message }, 409);
    }
  });

  routes.delete("/:storyId", async (context) => {
    try {
      const deletion = await new StoryDeletionService(new StoryRepository(context.env.CONTENT)).delete(
        context.get("user"), context.req.param("storyId"),
      );
      return context.json(deletion);
    } catch (error) {
      const message = (error as Error).message;
      const status = message === "Insufficient permissions" ? 403 : message === "Story not found" ? 404 : 409;
      return context.json({ error: message }, status);
    }
  });

  routes.post("/:storyId/restore", async (context) => {
    try {
      return context.json(await new StoryDeletionService(new StoryRepository(context.env.CONTENT)).restore(
        context.get("user"), context.req.param("storyId"),
      ));
    } catch (error) {
      const message = (error as Error).message;
      const status = message === "Insufficient permissions" ? 403 : message === "Deleted story not found" ? 404 : 409;
      return context.json({ error: message }, status);
    }
  });

  return routes;
}
