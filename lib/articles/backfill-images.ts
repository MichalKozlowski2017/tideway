import { resolveArticleImageUrl, CATEGORY_FALLBACK_IMAGE } from "@/lib/articles/resolve-image";
import type { Category } from "@/lib/types";
import { getSupabaseAdmin } from "@/lib/db/supabase";

type ArticleRow = {
  id: string;
  headline: string;
  category: string;
  source_item_ids: string[];
};

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await fn(items[current]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
  return results;
}

export async function backfillArticleImages(options?: {
  limit?: number;
  concurrency?: number;
}) {
  const supabase = getSupabaseAdmin();
  const limit = options?.limit ?? 500;
  const concurrency = options?.concurrency ?? 4;

  const { data: articles, error } = await supabase
    .from("articles")
    .select("id, headline, category, source_item_ids")
    .is("image_url", null)
    .limit(limit);

  if (error) throw error;
  if (!articles?.length) {
    return { processed: 0, updated: 0, failed: 0 };
  }

  let updated = 0;
  let failed = 0;

  await mapPool(articles as ArticleRow[], concurrency, async (article) => {
    const rawItemId = article.source_item_ids[0];
    if (!rawItemId) {
      failed += 1;
      console.log(`✗ ${article.headline.slice(0, 50)} — brak źródła`);
      return;
    }

    const { data: rawItem } = await supabase
      .from("raw_items")
      .select("id, url, image_url")
      .eq("id", rawItemId)
      .maybeSingle();

    if (!rawItem?.url) {
      failed += 1;
      console.log(`✗ ${article.headline.slice(0, 50)} — brak URL`);
      return;
    }

    const imageUrl =
      (await resolveArticleImageUrl({
        sourceImageUrl: rawItem.image_url,
        pageUrl: rawItem.url,
        category: article.category as Category,
      })) ?? CATEGORY_FALLBACK_IMAGE[article.category as Category] ?? CATEGORY_FALLBACK_IMAGE.technology;

    const { error: articleError } = await supabase
      .from("articles")
      .update({ image_url: imageUrl })
      .eq("id", article.id);

    if (articleError) {
      failed += 1;
      console.log(`✗ ${article.headline.slice(0, 50)} — ${articleError.message}`);
      return;
    }

    if (!rawItem.image_url) {
      await supabase
        .from("raw_items")
        .update({ image_url: imageUrl })
        .eq("id", rawItem.id);
    }

    updated += 1;
    console.log(`✓ ${article.headline.slice(0, 60)}`);
  });

  return { processed: articles.length, updated, failed };
}
