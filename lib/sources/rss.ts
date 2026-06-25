import Parser from "rss-parser";
import type { NormalizedItem, Source } from "@/lib/types";
import { extractImageFromRssItem } from "@/lib/sources/extract-image";
import { stripHtml, truncateText } from "@/lib/sources/extract-text";

const MAX_RSS_DESCRIPTION = 2_000;

type RssItem = Parser.Item & {
  contentEncoded?: string;
  "content:encoded"?: string;
};

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

function buildRssDescription(item: RssItem): string {
  const encoded = item.contentEncoded ?? item["content:encoded"];
  const fromEncoded = encoded ? stripHtml(encoded) : "";
  const snippet = stripHtml(item.contentSnippet ?? item.content ?? "");
  const raw = fromEncoded.length > snippet.length ? fromEncoded : snippet;
  return truncateText(raw, MAX_RSS_DESCRIPTION);
}

export async function fetchRssItems(source: Source): Promise<NormalizedItem[]> {
  const feedUrl = source.config.feedUrl;
  if (!feedUrl) return [];

  const feed = await parser.parseURL(feedUrl);

  return (feed.items ?? []).slice(0, 20).map((item, index) => ({
    externalId: item.guid ?? item.link ?? `${feedUrl}-${index}`,
    title: item.title ?? "Untitled",
    description: buildRssDescription(item as RssItem),
    url: item.link ?? feedUrl,
    imageUrl: extractImageFromRssItem(item),
    engagementScore: 0,
    publishedAt: item.pubDate ? new Date(item.pubDate) : null,
    sourceLabel: feed.title ?? new URL(feedUrl).hostname,
  }));
}
