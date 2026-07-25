import { Hono } from "hono";

import type { Env } from "./env";
import { authRoutes } from "./auth/routes";

export function createApp() {
  const app = new Hono<{ Bindings: Env }>();
  app.get("/api/health", (context) => context.json({ ok: true }));
  app.route("/api/auth", authRoutes());
  app.all("*", (context) => context.env.ASSETS.fetch(context.req.raw));
  return app;
}

