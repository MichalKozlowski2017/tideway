import { fetchOgImage } from "@/lib/sources/og-image";
import { isValidImageUrl } from "@/lib/sources/extract-image";
import type { NormalizedItem } from "@/lib/types";

const HN_HOSTS = new Set(["news.ycombinator.com", "www.news.ycombinator.com"]);

export async function enrichItemImageUrl(
  item: Pick<NormalizedItem, "url" | "imageUrl">,
): Promise<string | null> {
  if (isValidImageUrl(item.imageUrl)) {
    return item.imageUrl.trim();
  }

  try {
    const host = new URL(item.url).hostname;
    if (HN_HOSTS.has(host)) return null;
  } catch {
    return null;
  }

  return fetchOgImage(item.url);
}
