import type { Source } from "@/lib/types";

export function buildSourceLabel(source: Pick<Source, "type" | "config">): string {
  switch (source.type) {
    case "reddit":
      return `Reddit r/${source.config.subreddit ?? "unknown"}`;
    case "hacker_news":
      return "Hacker News";
    case "lobsters": {
      const tag = source.config.tag;
      return tag && tag !== "default" ? `Lobsters /${tag}` : "Lobsters";
    }
    case "rss":
      try {
        return new URL(source.config.feedUrl ?? "").hostname;
      } catch {
        return "RSS";
      }
    case "google_trends":
      return `Google Trends (${source.config.geo ?? "?"})`;
    case "youtube":
      return `YouTube (${source.config.regionCode ?? "?"})`;
    default:
      return source.type;
  }
}

export const ARTICLE_SOURCE_PRIORITY: Record<string, number> = {
  hacker_news: 1,
  lobsters: 1,
  reddit: 2,
  rss: 3,
  youtube: 4,
  google_trends: 99,
};

export function isArticleSourceType(type: string): boolean {
  return type !== "google_trends";
}
