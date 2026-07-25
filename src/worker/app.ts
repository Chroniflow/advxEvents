import { Hono } from "hono";

import type { Env } from "./env";
import { authRoutes } from "./auth/routes";
import { storyRoutes } from "./stories/routes";
import { mediaRoutes, uploadRoutes } from "./uploads/routes";

export function createApp() {
  const app = new Hono<{ Bindings: Env }>();
  app.get("/api/health", (context) => context.json({ ok: true }));
  app.route("/api/auth", authRoutes());
  app.route("/api/stories", storyRoutes());
  app.route("/api/uploads", uploadRoutes());
  app.route("/api/media", mediaRoutes());
  app.all("*", (context) => context.env.ASSETS.fetch(context.req.raw));
  return app;
}
