import type { Article } from "@/lib/types";
import { getDigestLinkSources } from "@/lib/db/queries";
import {
  linkDigestBullets,
  parseDigestSummary,
  type DigestItem,
} from "@/lib/digest/items";

export async function resolveDigestItems(
  article: Article,
): Promise<DigestItem[]> {
  const isDigest =
    article.article_type === "daily_digest" ||
    article.article_type === "weekly_digest";

  if (!isDigest) return [];

  let items = parseDigestSummary(article.summary);
  if (!items.length) return [];

  if (items.every((item) => item.slug)) return items;

  const days = article.article_type === "weekly_digest" ? 7 : 1;
  const sources = await getDigestLinkSources({
    locale: article.locale,
    category: article.category,
    days,
  });

  return linkDigestBullets(items, sources);
}
