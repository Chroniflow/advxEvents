export interface Env {
  ASSETS: Fetcher;
  CONTENT: KVNamespace;
  MEDIA: R2Bucket;
  LIKES: DurableObjectNamespace;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  SESSION_SECRET: string;
  ADMIN_GITHUB_USERS: string;
  APP_ORIGIN: string;
}
