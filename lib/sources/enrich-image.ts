import { fetchOgImage } from "@/lib/sources/og-image";
import { usableArticleImageUrl } from "@/lib/sources/extract-image";
import type { NormalizedItem } from "@/lib/types";

const HN_HOSTS = new Set(["news.ycombinator.com", "www.news.ycombinator.com"]);

export async function enrichItemImageUrl(
  item: Pick<NormalizedItem, "url" | "imageUrl">,
): Promise<string | null> {
  const usable = usableArticleImageUrl(item.imageUrl);
  if (usable) return usable;

  try {
    const host = new URL(item.url).hostname;
    if (HN_HOSTS.has(host)) return null;
  } catch {
    return null;
  }

  const og = await fetchOgImage(item.url);
  return usableArticleImageUrl(og);
}
