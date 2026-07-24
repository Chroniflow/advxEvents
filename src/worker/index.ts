import { Hono } from "hono";

import type { Env } from "./env";

const app = new Hono<{ Bindings: Env }>();

app.get("/api/health", (context) => context.json({ ok: true }));
app.all("*", (context) => context.env.ASSETS.fetch(context.req.raw));

export default app;

