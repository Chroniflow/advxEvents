import { describe, expect, it } from "vitest";

import { draftInputSchema, reviewDecisionSchema } from "../../src/shared/schemas";

describe("request schemas", () => {
  it("accepts a text-only anecdote", () => {
    expect(
      draftInputSchema.parse({ title: "那个凌晨", body: "我们终于完成了。", anonymous: true, images: [] }),
    ).toMatchObject({ anonymous: true, images: [] });
  });

  it("requires a reason when rejecting", () => {
    expect(() => reviewDecisionSchema.parse({ decision: "reject", reason: "" })).toThrow();
  });
});
