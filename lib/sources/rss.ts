import Parser from "rss-parser";
import type { NormalizedItem, Source } from "@/lib/types";

const parser = new Parser();

export async function fetchRssItems(source: Source): Promise<NormalizedItem[]> {
  const feedUrl = source.config.feedUrl;
  if (!feedUrl) return [];

  const feed = await parser.parseURL(feedUrl);

  return (feed.items ?? []).slice(0, 20).map((item, index) => ({
    externalId: item.guid ?? item.link ?? `${feedUrl}-${index}`,
    title: item.title ?? "Untitled",
    description: (item.contentSnippet ?? item.content ?? "").slice(0, 500),
    url: item.link ?? feedUrl,
    engagementScore: 0,
    publishedAt: item.pubDate ? new Date(item.pubDate) : null,
    sourceLabel: feed.title ?? new URL(feedUrl).hostname,
  }));
}
