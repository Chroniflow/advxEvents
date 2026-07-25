import { Hono } from "hono";

import { reviewDecisionSchema } from "../../shared/schemas";
import type { AuthVariables } from "../auth/middleware";
import { requireStaff } from "../auth/middleware";
import { AuditRepository } from "../data/audit";
import { ReviewRepository } from "../data/reviews";
import { StoryRepository } from "../data/stories";
import type { Env } from "../env";
import { AssetRepository } from "../uploads/assets";
import { ModerationService } from "./service";

export function moderationRoutes() {
  const routes = new Hono<{ Bindings: Env; Variables: AuthVariables }>();
  routes.use("*", requireStaff());

  routes.get("/reviews", async (context) => {
    const stories = await new StoryRepository(context.env.CONTENT).listPending();
    return context.json({ stories });
  });

  routes.post("/reviews/:storyId/:revisionId", async (context) => {
    const input = reviewDecisionSchema.safeParse(await context.req.json());
    if (!input.success) return context.json({ error: input.error.flatten() }, 400);
    const actor = context.get("user");
    const service = new ModerationService(
      new StoryRepository(context.env.CONTENT),
      new AssetRepository(context.env.CONTENT),
      new AuditRepository(context.env.CONTENT),
    );
    try {
      const revision =
        input.data.decision === "approve"
          ? await service.approve(
              actor,
              context.req.param("storyId"),
              context.req.param("revisionId"),
            )
          : await service.reject(
              actor,
              context.req.param("storyId"),
              context.req.param("revisionId"),
              input.data.reason,
            );
      await new ReviewRepository(context.env.CONTENT).save({
        storyId: revision.storyId,
        revisionId: revision.revisionId,
        reviewerGithubId: actor.githubId,
        decision: input.data.decision,
        reason: input.data.reason,
        createdAt: new Date().toISOString(),
      });
      return context.json(revision);
    } catch (error) {
      return context.json({ error: (error as Error).message }, 409);
    }
  });

  routes.post("/stories/:storyId/unpublish", async (context) => {
    try {
      return context.json(
        await new ModerationService(
          new StoryRepository(context.env.CONTENT),
          new AssetRepository(context.env.CONTENT),
          new AuditRepository(context.env.CONTENT),
        ).setPublication(context.get("user"), context.req.param("storyId"), false),
      );
    } catch (error) {
      return context.json({ error: (error as Error).message }, 409);
    }
  });

  routes.post("/stories/:storyId/restore", async (context) => {
    try {
      return context.json(
        await new ModerationService(
          new StoryRepository(context.env.CONTENT),
          new AssetRepository(context.env.CONTENT),
          new AuditRepository(context.env.CONTENT),
        ).setPublication(context.get("user"), context.req.param("storyId"), true),
      );
    } catch (error) {
      return context.json({ error: (error as Error).message }, 409);
    }
  });

  return routes;
}

