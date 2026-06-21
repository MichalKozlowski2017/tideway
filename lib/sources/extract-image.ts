const TRACKER_HOSTS = [
  "pixel.",
  "tracker.",
  "1x1",
  "spacer.",
  "beacon.",
];

export function isValidImageUrl(url: string | null | undefined): url is string {
  if (!url?.trim()) return false;
  try {
    const parsed = new URL(url.trim());
    if (!["http:", "https:"].includes(parsed.protocol)) return false;
    const lower = parsed.href.toLowerCase();
    if (lower.startsWith("data:")) return false;
    if (lower.endsWith(".svg") || lower.includes(".svg?")) return false;
    if (TRACKER_HOSTS.some((t) => lower.includes(t))) return false;
    return true;
  } catch {
    return false;
  }
}

export function pickLargestImageUrl(candidates: Array<string | undefined | null>): string | null {
  for (const url of candidates) {
    if (isValidImageUrl(url)) return url.trim();
  }
  return null;
}

export function extractImageFromHtml(html: string | undefined | null): string | null {
  if (!html) return null;

  const ogMatch = html.match(
    /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i,
  );
  if (ogMatch?.[1] && isValidImageUrl(ogMatch[1])) return ogMatch[1];

  const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imgMatch?.[1] && isValidImageUrl(imgMatch[1])) return imgMatch[1];

  return null;
}

type RssMedia = { $?: { url?: string; medium?: string; type?: string } };
type RssItem = {
  enclosure?: { url?: string; type?: string };
  mediaContent?: RssMedia | RssMedia[];
  mediaThumbnail?: RssMedia | RssMedia[];
  content?: string;
  "content:encoded"?: string;
  itunes?: { image?: string };
};

function mediaUrl(entry: RssMedia | RssMedia[] | undefined): string | undefined {
  if (!entry) return undefined;
  const list = Array.isArray(entry) ? entry : [entry];
  for (const item of list) {
    const url = item.$?.url;
    const type = item.$?.type ?? "";
    const medium = item.$?.medium ?? "";
    if (!url) continue;
    if (medium === "image" || type.startsWith("image/")) return url;
    if (!type && !medium) return url;
  }
  return list[0]?.$?.url;
}

export function extractImageFromRssItem(item: RssItem): string | null {
  const enclosure = item.enclosure;
  if (enclosure?.url && (!enclosure.type || enclosure.type.startsWith("image/"))) {
    if (isValidImageUrl(enclosure.url)) return enclosure.url;
  }

  return pickLargestImageUrl([
    mediaUrl(item.mediaContent),
    mediaUrl(item.mediaThumbnail),
    item.itunes?.image,
    extractImageFromHtml(item.content),
    extractImageFromHtml(item["content:encoded"]),
  ]);
}
