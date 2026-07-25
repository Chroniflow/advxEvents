import type { StoryStatus } from "../../shared/contracts";

export type StoryEvent =
  | "submit"
  | "approve"
  | "reject"
  | "withdraw"
  | "revise"
  | "publish"
  | "unpublish"
  | "restore";

const transitions: Partial<
  Record<StoryStatus, Partial<Record<StoryEvent, StoryStatus>>>
> = {
  draft: { submit: "pending" },
  pending: {
    approve: "published",
    reject: "rejected",
    withdraw: "withdrawn",
  },
  rejected: { revise: "draft" },
  withdrawn: { revise: "draft" },
  published: { unpublish: "unpublished" },
  unpublished: { restore: "published" },
};

export function transitionStory(
  status: StoryStatus,
  event: StoryEvent,
): StoryStatus {
  const next = transitions[status]?.[event];
  if (!next) {
    throw new Error(`Invalid story transition: ${status} -> ${event}`);
  }
  return next;
}
