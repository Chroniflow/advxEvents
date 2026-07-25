import { keys } from "./keys";

export interface ReviewRecord {
  storyId: string;
  revisionId: string;
  reviewerGithubId: string;
  decision: "approve" | "reject";
  reason?: string;
  createdAt: string;
}

export class ReviewRepository {
  constructor(private readonly kv: KVNamespace) {}

  save(review: ReviewRecord): Promise<void> {
    return this.kv.put(
      keys.review(review.storyId, review.revisionId),
      JSON.stringify(review),
    );
  }
}

