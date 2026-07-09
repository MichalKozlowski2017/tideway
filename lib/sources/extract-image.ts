const TRACKER_HOSTS = [
  "pixel.",
  "tracker.",
  "1x1",
  "spacer.",
  "beacon.",
];

/** RSS/HTML often entity-encode query strings (&amp;) — breaks hotlinked CDN URLs. */
export function normalizeImageUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  const normalized = url
    .trim()
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/gi, "'");
  try {
    const parsed = new URL(normalized);
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    return parsed.href;
  } catch {
    return null;
  }
}

export function isValidImageUrl(url: string | null | undefined): url is string {
  const normalized = normalizeImageUrl(url);
  if (!normalized) return false;
  const lower = normalized.toLowerCase();
  if (lower.startsWith("data:")) return false;
  if (lower.endsWith(".svg") || lower.includes(".svg?")) return false;
  if (TRACKER_HOSTS.some((t) => lower.includes(t))) return false;
  return true;
}

/** User profile photos from forums, dev.to, Reddit, etc. — not licensed for reuse */
export function isProfileOrAvatarImage(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  try {
    const raw = url.trim();
    const decoded = decodeURIComponent(raw).toLowerCase();
    const lower = raw.toLowerCase();

    if (
      lower.includes("profile_image") ||
      decoded.includes("profile_image") ||
      lower.includes("/user/avatar") ||
      decoded.includes("/user/avatar")
    ) {
      return true;
    }

    const { hostname, pathname } = new URL(raw);
    const host = hostname.toLowerCase();
    const path = pathname.toLowerCase();

    if (host === "avatars.githubusercontent.com") return true;
    if (host.includes("gravatar.com")) return true;
    if (host === "www.redditstatic.com" && path.includes("/avatars/")) return true;
    if (host === "styles.redditmedia.com" && path.includes("avatar")) return true;

    return false;
  } catch {
    return false;
  }
}

/** Auto-generated social cards (GitHub repos, etc.) — poor fit for article thumbnails */
export function isWeakPreviewImage(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  try {
    const { hostname, pathname } = new URL(url.trim());
    const host = hostname.toLowerCase();

    if (host === "opengraph.githubassets.com") return true;
    if (host === "repository-images.githubusercontent.com") return true;
    if (host === "avatars.githubusercontent.com") return true;

    // github.com/*/opengraph/* social preview PNGs
    if (host === "github.com" && pathname.includes("/opengraph/")) return true;

    return false;
  } catch {
    return false;
  }
}

export function isUsableArticleImage(url: string | null | undefined): url is string {
  const normalized = normalizeImageUrl(url);
  if (!normalized) return false;
  return !isWeakPreviewImage(normalized) && !isProfileOrAvatarImage(normalized);
}

export function usableArticleImageUrl(url: string | null | undefined): string | null {
  const normalized = normalizeImageUrl(url);
  if (!normalized) return null;
  if (isWeakPreviewImage(normalized) || isProfileOrAvatarImage(normalized)) return null;
  return normalized;
}

export function pickLargestImageUrl(candidates: Array<string | undefined | null>): string | null {
  for (const url of candidates) {
    const normalized = normalizeImageUrl(url);
    if (normalized && isValidImageUrl(normalized)) return normalized;
  }
  return null;
}

export function extractImageFromHtml(html: string | undefined | null): string | null {
  if (!html) return null;

  const metaPatterns = [
    /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["']/i,
    /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["']/i,
  ];

  for (const pattern of metaPatterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      const normalized = normalizeImageUrl(match[1]);
      if (normalized && isValidImageUrl(normalized)) return normalized;
    }
  }

  const linkMatch = html.match(
    /<link[^>]+rel=["'](?:image_src|apple-touch-icon)["'][^>]+href=["']([^"']+)["']/i,
  );
  if (linkMatch?.[1]) {
    const normalized = normalizeImageUrl(linkMatch[1]);
    if (normalized && isValidImageUrl(normalized)) return normalized;
  }

  const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imgMatch?.[1]) {
    const normalized = normalizeImageUrl(imgMatch[1]);
    if (normalized && isValidImageUrl(normalized)) return normalized;
  }

  return null;
}

type RssMedia = { $?: { url?: string; medium?: string; type?: string } };
type RssItem = {
  enclosure?: { url?: string; type?: string };
  mediaContent?: RssMedia | RssMedia[];
  mediaThumbnail?: RssMedia | RssMedia[];
  content?: string;
  contentEncoded?: string;
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
    extractImageFromHtml(item.contentEncoded),
    extractImageFromHtml(item["content:encoded"]),
  ]);
}
