import Parser from "rss-parser";
import type { NormalizedItem, Source } from "@/lib/types";
import { extractImageFromRssItem } from "@/lib/sources/extract-image";

const parser = new Parser({
  headers: {
    "User-Agent": "Tideway/1.0 (RSS aggregator)",
    Accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
  },
  customFields: {
    item: [
      ["media:content", "mediaContent", { keepArray: false }],
      ["media:thumbnail", "mediaThumbnail", { keepArray: false }],
      ["content:encoded", "contentEncoded"],
    ],
  },
});

export async function fetchRssItems(source: Source): Promise<NormalizedItem[]> {
  const feedUrl = source.config.feedUrl;
  if (!feedUrl) return [];

  const feed = await parser.parseURL(feedUrl);

  return (feed.items ?? []).slice(0, 20).map((item, index) => ({
    externalId: item.guid ?? item.link ?? `${feedUrl}-${index}`,
    title: item.title ?? "Untitled",
    description: (item.contentSnippet ?? item.content ?? "").slice(0, 500),
    url: item.link ?? feedUrl,
    imageUrl: extractImageFromRssItem(item),
    engagementScore: 0,
    publishedAt: item.pubDate ? new Date(item.pubDate) : null,
    sourceLabel: feed.title ?? new URL(feedUrl).hostname,
  }));
}
