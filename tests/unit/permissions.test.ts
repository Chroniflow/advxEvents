import { describe, expect, it } from "vitest";

import { can, resolveRole } from "../../src/worker/auth/permissions";

describe("role permissions", () => {
  it("allows staff moderation but denies role management", () => {
    expect(can("STAFF", "story:review")).toBe(true);
    expect(can("STAFF", "roles:manage")).toBe(false);
  });

  it("allows admins to manage roles", () => {
    expect(can("ADMIN", "roles:manage")).toBe(true);
  });

  it("always resolves a bootstrap login as ADMIN", () => {
    expect(
      resolveRole({
        storedRole: "USER",
        login: "IceBraker",
        bootstrapLogins: ["icebraker"],
      }),
    ).toBe("ADMIN");
  });
});

