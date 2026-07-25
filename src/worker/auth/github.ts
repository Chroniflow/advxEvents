interface GithubTokenResponse {
  access_token?: string;
  error?: string;
}

export interface GithubUser {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string;
  html_url: string;
}

export function githubAuthorizeUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("state", input.state);
  url.searchParams.set("scope", "read:user");
  return url.toString();
}

export async function exchangeGithubCode(input: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  fetcher?: typeof fetch;
}): Promise<GithubUser> {
  const fetcher = input.fetcher ?? fetch;
  const tokenResponse = await fetcher(
    "https://github.com/login/oauth/access_token",
    {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: input.clientId,
        client_secret: input.clientSecret,
        code: input.code,
        redirect_uri: input.redirectUri,
      }),
    },
  );
  if (!tokenResponse.ok) throw new Error("GitHub token exchange failed");
  const token = await tokenResponse.json<GithubTokenResponse>();
  if (!token.access_token) throw new Error(token.error ?? "GitHub token missing");

  const userResponse = await fetcher("https://api.github.com/user", {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token.access_token}`,
      "User-Agent": "ADVX-Anecdotes",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!userResponse.ok) throw new Error("GitHub user lookup failed");
  return userResponse.json<GithubUser>();
}

