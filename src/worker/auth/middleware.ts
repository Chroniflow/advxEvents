import type { MiddlewareHandler } from "hono";

import type { Role, UserProfile } from "../../shared/contracts";
import type { Env } from "../env";
import { UserRepository } from "../data/users";
import { parseBootstrapLogins, resolveRole } from "./permissions";
import { readSessionCookie, SessionStore } from "./session";

export interface AuthVariables {
  user: UserProfile;
}

export function requireRole(minimum: Role): MiddlewareHandler<{
  Bindings: Env;
  Variables: AuthVariables;
}> {
  return async (context, next) => {
    const token = readSessionCookie(context.req.header("Cookie") ?? null);
    if (!token) return context.json({ error: "Authentication required" }, 401);
    const session = await new SessionStore(
      context.env.CONTENT,
      context.env.SESSION_SECRET,
    ).resolve(token);
    if (!session) return context.json({ error: "Authentication required" }, 401);
    const user = await new UserRepository(context.env.CONTENT).get(session.githubId);
    if (!user) return context.json({ error: "Authentication required" }, 401);
    const resolvedRole = resolveRole({
      storedRole: user.role,
      login: user.login,
      bootstrapLogins: parseBootstrapLogins(context.env.ADMIN_GITHUB_USERS),
    });
    const rank: Record<Role, number> = { USER: 1, STAFF: 2, ADMIN: 3 };
    if (rank[resolvedRole] < rank[minimum]) {
      return context.json({ error: "Insufficient permissions" }, 403);
    }
    context.set("user", { ...user, role: resolvedRole });
    await next();
  };
}

export const requireUser = () => requireRole("USER");
export const requireStaff = () => requireRole("STAFF");
export const requireAdmin = () => requireRole("ADMIN");

