import type { PublicStoryWithLikes, StoryDeletion, StoryRevision, StoryRevisionView, UserProfile } from "../../shared/contracts";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: init?.body instanceof FormData
      ? init.headers
      : { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    const payload: { error?: unknown } = await response
      .json<{ error?: unknown }>()
      .catch(() => ({}));
    throw new Error(typeof payload.error === "string" ? payload.error : `Request failed (${response.status})`);
  }
  return response.status === 204 ? (undefined as T) : response.json<T>();
}

export const api = {
  publicStories: (sort: string) => request<{ stories: PublicStoryWithLikes[] }>(`/api/public/stories?sort=${sort}`),
  publicStory: (storyId: string) => request<PublicStoryWithLikes>(`/api/public/stories/${storyId}`),
  likeState: (storyId: string) => request<{ count: number; liked: boolean }>(`/api/likes/${storyId}`),
  like: (storyId: string, liked: boolean) => request<{ count: number; liked: boolean }>(`/api/likes/${storyId}`, { method: liked ? "PUT" : "DELETE" }),
  me: () => request<UserProfile>("/api/auth/me"),
  logout: () => request<{ ok: true }>("/api/auth/logout", { method: "POST" }),
  myStories: () => request<{ stories: StoryRevisionView[] }>("/api/stories/mine"),
  deleteStory: (storyId: string) => request<StoryDeletion>(`/api/stories/${storyId}`, { method: "DELETE" }),
  restoreStory: (storyId: string) => request<StoryRevision>(`/api/stories/${storyId}/restore`, { method: "POST" }),
  createStory: (input: unknown) => request<StoryRevision>("/api/stories", { method: "POST", body: JSON.stringify(input) }),
  submitStory: (storyId: string) => request<StoryRevision>(`/api/stories/${storyId}/submit`, { method: "POST" }),
  upload: (form: FormData) => request<Record<string, unknown>>("/api/uploads", { method: "POST", body: form }),
  reviews: () => request<{ stories: StoryRevision[] }>("/api/admin/reviews"),
  review: (storyId: string, revisionId: string, decision: "approve" | "reject", reason?: string) => request<StoryRevision>(`/api/admin/reviews/${storyId}/${revisionId}`, { method: "POST", body: JSON.stringify({ decision, reason }) }),
  users: (query = "") => request<{ users: UserProfile[] }>(`/api/admin/users?query=${encodeURIComponent(query)}`),
  setRole: (githubId: string, role: string) => request<UserProfile>(`/api/admin/users/${githubId}/role`, { method: "PATCH", body: JSON.stringify({ role }) }),
};
