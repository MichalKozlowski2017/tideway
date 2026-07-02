import { resolveArticleImageUrl, CATEGORY_FALLBACK_IMAGE } from "@/lib/articles/resolve-image";
import {
  isProfileOrAvatarImage,
  isWeakPreviewImage,
} from "@/lib/sources/extract-image";
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
    const category = article.category as Category;
    const rawItemId = article.source_item_ids[0];

    if (!rawItemId) {
      const imageUrl =
        category === "ai" || category === "it"
          ? null
          : CATEGORY_FALLBACK_IMAGE[category] ?? CATEGORY_FALLBACK_IMAGE.tech;

      const { error: articleError } = await supabase
        .from("articles")
        .update({ image_url: imageUrl })
        .eq("id", article.id);

      if (articleError) {
        failed += 1;
        console.log(`✗ ${article.headline.slice(0, 50)} — ${articleError.message}`);
        return;
      }

      updated += 1;
      console.log(`✓ ${article.headline.slice(0, 60)} (fallback)`);
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

    const imageUrl = await resolveArticleImageUrl({
        sourceImageUrl: rawItem.image_url,
        pageUrl: rawItem.url,
        category,
      });

    const fallback =
      imageUrl ??
      (category === "ai" || category === "it"
        ? null
        : CATEGORY_FALLBACK_IMAGE[category] ?? CATEGORY_FALLBACK_IMAGE.tech);

    const { error: articleError } = await supabase
      .from("articles")
      .update({ image_url: fallback })
      .eq("id", article.id);

    if (articleError) {
      failed += 1;
      console.log(`✗ ${article.headline.slice(0, 50)} — ${articleError.message}`);
      return;
    }

    if (!rawItem.image_url && fallback) {
      await supabase
        .from("raw_items")
        .update({ image_url: fallback })
        .eq("id", rawItem.id);
    }

    updated += 1;
    console.log(`✓ ${article.headline.slice(0, 60)}`);
  });

  return { processed: articles.length, updated, failed };
}

type WeakArticleRow = ArticleRow & { image_url: string };

export async function replaceWeakArticleImages(options?: {
  limit?: number;
  concurrency?: number;
}) {
  const supabase = getSupabaseAdmin();
  const limit = options?.limit ?? 500;
  const concurrency = options?.concurrency ?? 4;

  const { data: articles, error } = await supabase
    .from("articles")
    .select("id, headline, category, source_item_ids, image_url")
    .not("image_url", "is", null)
    .or(
      "image_url.ilike.%opengraph.githubassets.com%,image_url.ilike.%repository-images.githubusercontent.com%",
    )
    .limit(limit);

  if (error) throw error;
  if (!articles?.length) {
    return { processed: 0, updated: 0, failed: 0 };
  }

  let updated = 0;
  let failed = 0;

  await mapPool(articles as WeakArticleRow[], concurrency, async (article) => {
    if (!isWeakPreviewImage(article.image_url)) return;

    const category = article.category as Category;
    const rawItemId = article.source_item_ids[0];
    let resolved: string | null = null;

    if (rawItemId) {
      const { data: rawItem } = await supabase
        .from("raw_items")
        .select("id, url, image_url")
        .eq("id", rawItemId)
        .maybeSingle();

      if (rawItem?.url) {
        resolved = await resolveArticleImageUrl({
          sourceImageUrl: rawItem.image_url,
          pageUrl: rawItem.url,
          category,
        });
      }
    }

    const imageUrl =
      resolved ??
      (category === "ai" || category === "it"
        ? null
        : CATEGORY_FALLBACK_IMAGE[category] ?? CATEGORY_FALLBACK_IMAGE.tech);

    const { error: articleError } = await supabase
      .from("articles")
      .update({ image_url: imageUrl })
      .eq("id", article.id);

    if (articleError) {
      failed += 1;
      console.log(`✗ ${article.headline.slice(0, 50)} — ${articleError.message}`);
      return;
    }

    updated += 1;
    console.log(`✓ ${article.headline.slice(0, 60)} (weak → ${imageUrl ? "image" : "gradient"})`);
  });

  return { processed: articles.length, updated, failed };
}

type BadImageArticleRow = ArticleRow & { image_url: string };

export async function replaceProfileAvatarImages(options?: {
  limit?: number;
  concurrency?: number;
}) {
  const supabase = getSupabaseAdmin();
  const limit = options?.limit ?? 500;
  const concurrency = options?.concurrency ?? 4;

  const { data: articles, error } = await supabase
    .from("articles")
    .select("id, headline, category, source_item_ids, image_url")
    .not("image_url", "is", null)
    .or(
      "image_url.ilike.%profile_image%,image_url.ilike.%gravatar.com%,image_url.ilike.%avatars.githubusercontent.com%",
    )
    .limit(limit);

  if (error) throw error;
  if (!articles?.length) {
    return { processed: 0, updated: 0, failed: 0 };
  }

  let updated = 0;
  let failed = 0;

  await mapPool(articles as BadImageArticleRow[], concurrency, async (article) => {
    if (!isProfileOrAvatarImage(article.image_url)) return;

    const category = article.category as Category;
    const rawItemId = article.source_item_ids[0];
    let resolved: string | null = null;

    if (rawItemId) {
      const { data: rawItem } = await supabase
        .from("raw_items")
        .select("id, url, image_url")
        .eq("id", rawItemId)
        .maybeSingle();

      if (rawItem?.url) {
        resolved = await resolveArticleImageUrl({
          sourceImageUrl: rawItem.image_url,
          pageUrl: rawItem.url,
          category,
        });
      }
    }

    const imageUrl =
      resolved ??
      (category === "ai" || category === "it"
        ? null
        : CATEGORY_FALLBACK_IMAGE[category] ?? CATEGORY_FALLBACK_IMAGE.tech);

    const { error: articleError } = await supabase
      .from("articles")
      .update({ image_url: imageUrl })
      .eq("id", article.id);

    if (articleError) {
      failed += 1;
      console.log(`✗ ${article.headline.slice(0, 50)} — ${articleError.message}`);
      return;
    }

    updated += 1;
    console.log(`✓ ${article.headline.slice(0, 60)} (avatar → ${imageUrl ? "image" : "gradient"})`);
  });

  return { processed: articles.length, updated, failed };
}
