/** RSS feed URLs assigned to the IT (developer) category */
export const IT_RSS_FEED_URLS = [
  "https://dev.to/feed",
  "https://www.theregister.com/headlines.atom",
  "https://feeds.feedburner.com/TheHackersNews",
  "https://hnrss.org/newest?q=security&points=50",
] as const;

export const IT_SOURCE_TYPES = ["hacker_news", "lobsters"] as const;

export function isItSource(type: string, feedUrl?: string | null): boolean {
  if ((IT_SOURCE_TYPES as readonly string[]).includes(type)) return true;
  if (!feedUrl) return false;
  return (IT_RSS_FEED_URLS as readonly string[]).includes(feedUrl);
}
