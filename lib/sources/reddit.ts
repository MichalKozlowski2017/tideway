import { getRedditAccessToken, hasRedditCredentials, redditUserAgent } from "@/lib/sources/reddit-auth";
import type { NormalizedItem, Source } from "@/lib/types";

interface RedditPost {
  id: string;
  title: string;
  selftext: string;
  url: string;
  permalink: string;
  score: number;
  num_comments: number;
  created_utc: number;
  stickied: boolean;
  link_flair_text?: string | null;
  author: string;
  domain: string;
  is_self: boolean;
}

function buildRedditDescription(post: RedditPost, subreddit: string): string {
  const parts = [
    `Subreddit: r/${subreddit}`,
    `Score: ${post.score} upvotes`,
    `Comments: ${post.num_comments}`,
    `Author: u/${post.author}`,
    post.link_flair_text ? `Flair: ${post.link_flair_text}` : null,
    post.is_self ? "Type: text discussion" : `Type: link post (${post.domain})`,
  ].filter(Boolean);

  if (post.selftext?.trim()) {
    parts.push("", "Post body:", post.selftext.slice(0, 1200));
  }

  return parts.join("\n");
}

export async function fetchRedditItems(source: Source): Promise<NormalizedItem[]> {
  const subreddit = source.config.subreddit;
  if (!subreddit) return [];

  if (!hasRedditCredentials()) {
    console.warn("Reddit credentials missing — skip r/" + subreddit);
    return [];
  }

  const token = await getRedditAccessToken();
  const response = await fetch(
    `https://oauth.reddit.com/r/${subreddit}/hot?limit=25&raw_json=1`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": redditUserAgent(),
      },
      next: { revalidate: 0 },
    },
  );

  if (!response.ok) {
    throw new Error(`Reddit API error: ${response.status}`);
  }

  const data = (await response.json()) as {
    data: { children: Array<{ data: RedditPost }> };
  };

  return data.data.children
    .filter(({ data: post }) => !post.stickied && post.title?.trim())
    .map(({ data: post }) => ({
      externalId: post.id,
      title: post.title,
      description: buildRedditDescription(post, subreddit),
      url: post.url.startsWith("http")
        ? post.url
        : `https://www.reddit.com${post.permalink}`,
      engagementScore: post.score + post.num_comments * 2,
      publishedAt: new Date(post.created_utc * 1000),
      sourceLabel: `Reddit r/${subreddit}`,
    }));
}
