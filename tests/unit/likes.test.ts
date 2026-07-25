import { describe, expect, it } from "vitest";

import { LikeLedger } from "../../src/worker/likes/ledger";

describe("LikeLedger", () => {
  it("counts one like per user and story", () => {
    const ledger = new LikeLedger();
    ledger.like("story-1", "user-1");
    ledger.like("story-1", "user-1");
    expect(ledger.count("story-1")).toBe(1);
  });

  it("unlikes idempotently and ranks hottest stories", () => {
    const ledger = new LikeLedger();
    ledger.like("story-1", "user-1");
    ledger.like("story-2", "user-1");
    ledger.like("story-2", "user-2");
    ledger.unlike("story-1", "user-1");
    ledger.unlike("story-1", "user-1");
    expect(ledger.hottest(["story-1", "story-2"])).toEqual([
      { storyId: "story-2", count: 2 },
      { storyId: "story-1", count: 0 },
    ]);
  });
});
