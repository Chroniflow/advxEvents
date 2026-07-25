import { Hono } from "hono";

import type { UserProfile } from "../../shared/contracts";
import type { Env } from "../env";
import { UserRepository } from "../data/users";
import { parseBootstrapLogins, resolveRole } from "./permissions";
import { exchangeGithubCode, githubAuthorizeUrl } from "./github";
import {
  clearSessionCookie,
  readSessionCookie,
  sessionCookie,
  SessionStore,
} from "./session";

const STATE_COOKIE = "advx_oauth_state";

function parseCookie(header: string | null, name: string): string | null {
  const pair = header
    ?.split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${name}=`));
  return pair ? decodeURIComponent(pair.slice(name.length + 1)) : null;
}

function oauthStateCookie(state: string, secure: boolean): string {
  return [
    `${STATE_COOKIE}=${encodeURIComponent(state)}`,
    "Path=/api/auth/github/callback",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=600",
    secure ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

export function authRoutes() {
  const routes = new Hono<{ Bindings: Env }>();

  routes.get("/github", async (context) => {
    const store = new SessionStore(context.env.CONTENT, context.env.SESSION_SECRET);
    const state = await store.createOAuthState();
    const redirectUri = `${context.env.APP_ORIGIN}/api/auth/github/callback`;
    context.header(
      "Set-Cookie",
      oauthStateCookie(state, context.env.APP_ORIGIN.startsWith("https://")),
    );
    return context.redirect(
      githubAuthorizeUrl({
        clientId: context.env.GITHUB_CLIENT_ID,
        redirectUri,
        state,
      }),
    );
  });

  routes.get("/github/callback", async (context) => {
    const code = context.req.query("code");
    const state = context.req.query("state");
    const cookieState = parseCookie(context.req.header("Cookie") ?? null, STATE_COOKIE);
    if (!code || !state || !cookieState || state !== cookieState) {
      return context.json({ error: "Invalid OAuth state" }, 400);
    }
    const store = new SessionStore(context.env.CONTENT, context.env.SESSION_SECRET);
    if (!(await store.consumeOAuthState(state))) {
      return context.json({ error: "Invalid OAuth state" }, 400);
    }

    try {
      const githubUser = await exchangeGithubCode({
        code,
        clientId: context.env.GITHUB_CLIENT_ID,
        clientSecret: context.env.GITHUB_CLIENT_SECRET,
        redirectUri: `${context.env.APP_ORIGIN}/api/auth/github/callback`,
      });
      const users = new UserRepository(context.env.CONTENT);
      const githubId = String(githubUser.id);
      const existing = await users.get(githubId);
      const now = new Date().toISOString();
      const profile: UserProfile = {
        githubId,
        login: githubUser.login,
        name: githubUser.name,
        avatarUrl: githubUser.avatar_url,
        profileUrl: githubUser.html_url,
        role: resolveRole({
          storedRole: existing?.role ?? "USER",
          login: githubUser.login,
          bootstrapLogins: parseBootstrapLogins(context.env.ADMIN_GITHUB_USERS),
        }),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      await users.upsert(profile);
      const token = await store.create(githubId);
      context.header(
        "Set-Cookie",
        sessionCookie(token, context.env.APP_ORIGIN.startsWith("https://")),
      );
      return context.redirect("/account");
    } catch {
      return context.json({ error: "GitHub authentication failed" }, 502);
    }
  });

  routes.post("/logout", async (context) => {
    const token = readSessionCookie(context.req.header("Cookie") ?? null);
    const secure = context.env.APP_ORIGIN.startsWith("https://");
    if (token) {
      await new SessionStore(context.env.CONTENT, context.env.SESSION_SECRET).revoke(token);
    }
    context.header("Set-Cookie", clearSessionCookie(secure));
    return context.json({ ok: true });
  });

  return routes;
}

