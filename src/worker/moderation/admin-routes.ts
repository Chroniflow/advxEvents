import { Hono } from "hono";

import { roleChangeSchema } from "../../shared/schemas";
import type { AuthVariables } from "../auth/middleware";
import { requireAdmin } from "../auth/middleware";
import { parseBootstrapLogins } from "../auth/permissions";
import { AuditRepository } from "../data/audit";
import { UserRepository } from "../data/users";
import type { Env } from "../env";
import { AdminService } from "./admin-service";
import { garbageCollection } from "../gc/service";

export function adminRoutes() {
  const routes = new Hono<{ Bindings: Env; Variables: AuthVariables }>();
  routes.use("*", requireAdmin());

  routes.get("/users", async (context) => {
    const users = await new UserRepository(context.env.CONTENT).search(
      context.req.query("query") ?? "",
    );
    return context.json({ users });
  });

  routes.patch("/users/:githubId/role", async (context) => {
    const input = roleChangeSchema.safeParse(await context.req.json());
    if (!input.success) return context.json({ error: input.error.flatten() }, 400);
    try {
      const user = await new AdminService(
        new UserRepository(context.env.CONTENT),
        new AuditRepository(context.env.CONTENT),
        parseBootstrapLogins(context.env.ADMIN_GITHUB_USERS),
      ).setRole(context.get("user"), context.req.param("githubId"), input.data.role);
      return context.json(user);
    } catch (error) {
      return context.json({ error: (error as Error).message }, 409);
    }
  });

  routes.post("/gc", async (context) => context.json(await garbageCollection(context.env).run()));

  return routes;
}
