import { describe, expect, it } from "vitest";

import { APP_NAME } from "../../src/shared/contracts";

describe("application scaffold", () => {
  it("exposes the approved product name", () => {
    expect(APP_NAME).toBe("ADVX轶事");
  });
});
