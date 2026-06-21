const TOKEN_URL = "https://www.reddit.com/api/v1/access_token";

type TokenCache = { token: string; expiresAt: number };
let cache: TokenCache | null = null;

export function redditUserAgent(): string {
  return (
    process.env.REDDIT_USER_AGENT ??
    "web:tideway:v1.0.0 (by /u/tideway_bot)"
  );
}

export function hasRedditCredentials(): boolean {
  return Boolean(process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET);
}

async function requestToken(
  body: Record<string, string>,
): Promise<TokenCache> {
  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Missing REDDIT_CLIENT_ID or REDDIT_CLIENT_SECRET");
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": redditUserAgent(),
    },
    body: new URLSearchParams(body).toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Reddit OAuth failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in: number;
  };

  return {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
}

export async function getRedditAccessToken(): Promise<string> {
  if (cache && Date.now() < cache.expiresAt) {
    return cache.token;
  }

  if (process.env.REDDIT_REFRESH_TOKEN) {
    cache = await requestToken({
      grant_type: "refresh_token",
      refresh_token: process.env.REDDIT_REFRESH_TOKEN,
    });
    return cache.token;
  }

  if (process.env.REDDIT_USERNAME && process.env.REDDIT_PASSWORD) {
    cache = await requestToken({
      grant_type: "password",
      username: process.env.REDDIT_USERNAME,
      password: process.env.REDDIT_PASSWORD,
    });
    return cache.token;
  }

  cache = await requestToken({ grant_type: "client_credentials" });
  return cache.token;
}
