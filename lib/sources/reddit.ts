import type { NormalizedItem, Source } from "@/lib/types";

export async function fetchRedditItems(source: Source): Promise<NormalizedItem[]> {
  const subreddit = source.config.subreddit;
  if (!subreddit) return [];

  const response = await fetch(
    `https://www.reddit.com/r/${subreddit}/hot.json?limit=20`,
    {
      headers: { "User-Agent": "TrendPulse/1.0 (trend aggregator)" },
      next: { revalidate: 0 },
    },
  );

  if (!response.ok) {
    throw new Error(`Reddit API error: ${response.status}`);
  }

  const data = (await response.json()) as {
    data: {
      children: Array<{
        data: {
          id: string;
          title: string;
          selftext: string;
          url: string;
          permalink: string;
          score: number;
          num_comments: number;
          created_utc: number;
          stickied: boolean;
        };
      }>;
    };
  };

  return data.data.children
    .filter(({ data: post }) => !post.stickied)
    .map(({ data: post }) => ({
      externalId: post.id,
      title: post.title,
      description: post.selftext?.slice(0, 500) ?? "",
      url: post.url.startsWith("http")
        ? post.url
        : `https://www.reddit.com${post.permalink}`,
      engagementScore: post.score + post.num_comments,
      publishedAt: new Date(post.created_utc * 1000),
      sourceLabel: `Reddit r/${subreddit}`,
    }));
}
