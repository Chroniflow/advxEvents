import type { Permission, PrincipalRole, Role } from "../../shared/contracts";

const permissions: Record<PrincipalRole, ReadonlySet<Permission>> = {
  ANONYMOUS: new Set(),
  USER: new Set(["story:create", "story:like"]),
  STAFF: new Set([
    "story:create",
    "story:like",
    "story:review",
    "story:unpublish",
  ]),
  ADMIN: new Set([
    "story:create",
    "story:like",
    "story:review",
    "story:unpublish",
    "roles:manage",
    "settings:manage",
  ]),
};

export function can(role: PrincipalRole, permission: Permission): boolean {
  return permissions[role].has(permission);
}

interface ResolveRoleInput {
  storedRole: Role;
  login: string;
  bootstrapLogins: string[];
}

export function resolveRole({
  storedRole,
  login,
  bootstrapLogins,
}: ResolveRoleInput): Role {
  const normalizedLogin = login.toLowerCase();
  const isBootstrap = bootstrapLogins.some(
    (candidate) => candidate.trim().toLowerCase() === normalizedLogin,
  );

  return isBootstrap ? "ADMIN" : storedRole;
}

export function parseBootstrapLogins(value: string): string[] {
  return value
    .split(",")
    .map((login) => login.trim().toLowerCase())
    .filter(Boolean);
}

