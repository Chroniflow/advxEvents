export const APP_NAME = "ADVX轶事";

export type Role = "USER" | "STAFF" | "ADMIN";
export type PrincipalRole = "ANONYMOUS" | Role;

export type Permission =
  | "story:create"
  | "story:like"
  | "story:review"
  | "story:unpublish"
  | "roles:manage"
  | "settings:manage";

export type StoryStatus =
  | "draft"
  | "pending"
  | "published"
  | "rejected"
  | "withdrawn"
  | "unpublished";

export interface UserProfile {
  githubId: string;
  login: string;
  name: string | null;
  avatarUrl: string;
  profileUrl: string;
  role: Role;
  createdAt: string;
  updatedAt: string;
}

export interface StoryImage {
  assetId: string;
  objectKey: string;
  contentType: "image/jpeg" | "image/png" | "image/webp";
  width: number;
  height: number;
  size: number;
  caption: string;
  order: number;
}

export interface StoryRevision {
  storyId: string;
  revisionId: string;
  authorGithubId: string;
  authorLogin: string;
  authorName: string | null;
  authorAvatarUrl: string;
  authorProfileUrl: string;
  title: string;
  body: string;
  anonymous: boolean;
  images: StoryImage[];
  status: StoryStatus;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  publishedAt: string | null;
}

export interface PublicStoryAuthor {
  anonymous: false;
  login: string;
  name: string | null;
  avatarUrl: string;
  profileUrl: string;
}

export interface PublicAnonymousAuthor {
  anonymous: true;
}

export interface PublicStory {
  storyId: string;
  revisionId: string;
  title: string;
  body: string;
  images: StoryImage[];
  publishedAt: string;
  author: PublicStoryAuthor | PublicAnonymousAuthor;
}

