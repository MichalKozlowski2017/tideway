import Parser from "rss-parser";
import type { NormalizedItem, Source } from "@/lib/types";

const parser = new Parser();

const LOBSTERS_FEEDS: Record<string, string> = {
  default: "https://lobste.rs/rss",
  programming: "https://lobste.rs/t/programming.rss",
  hardware: "https://lobste.rs/t/hardware.rss",
  compsci: "https://lobste.rs/t/compsci.rss",
  culture: "https://lobste.rs/t/culture.rss",
};

export async function fetchLobstersItems(
  source: Source,
): Promise<NormalizedItem[]> {
  const tag = source.config.tag ?? "default";
  const feedUrl = LOBSTERS_FEEDS[tag] ?? LOBSTERS_FEEDS.default;

  const feed = await parser.parseURL(feedUrl);

  return (feed.items ?? []).slice(0, 20).map((item, index) => {
    const commentsMatch = item.link?.match(/#comments-(\d+)/);
    const description = [
      "Source: Lobsters",
      item.creator ? `Author: ${item.creator}` : null,
      item.contentSnippet ? `Summary: ${item.contentSnippet.slice(0, 800)}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    return {
      externalId: commentsMatch?.[1] ?? item.guid ?? item.link ?? `lobsters-${index}`,
      title: item.title ?? "Untitled",
      description,
      url: item.link?.split("#")[0] ?? feedUrl,
      engagementScore: 0,
      publishedAt: item.pubDate ? new Date(item.pubDate) : null,
      sourceLabel: tag === "default" ? "Lobsters" : `Lobsters /${tag}`,
    };
  });
}
