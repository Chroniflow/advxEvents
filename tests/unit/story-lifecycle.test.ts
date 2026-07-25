import { describe, expect, it } from "vitest";

import { transitionStory } from "../../src/worker/stories/lifecycle";

describe("story lifecycle", () => {
  it("rejects direct draft publication", () => {
    expect(() => transitionStory("draft", "publish")).toThrow(
      "Invalid story transition",
    );
  });

  it("supports review, rejection, and resubmission", () => {
    expect(transitionStory("draft", "submit")).toBe("pending");
    expect(transitionStory("pending", "reject")).toBe("rejected");
    expect(transitionStory("rejected", "revise")).toBe("draft");
  });

  it("supports withdrawing and restoring publication", () => {
    expect(transitionStory("pending", "withdraw")).toBe("withdrawn");
    expect(transitionStory("withdrawn", "revise")).toBe("draft");
    expect(transitionStory("published", "unpublish")).toBe("unpublished");
    expect(transitionStory("unpublished", "restore")).toBe("published");
  });
});

