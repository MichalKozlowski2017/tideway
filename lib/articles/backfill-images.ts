import { resolveArticleImageUrl, CATEGORY_FALLBACK_IMAGE } from "@/lib/articles/resolve-image";
import {
  isProfileOrAvatarImage,
  isWeakPreviewImage,
} from "@/lib/sources/extract-image";
import type { Category } from "@/lib/types";
import { getSql } from "@/lib/db/client";

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
  const sql = getSql();
  const limit = options?.limit ?? 500;
  const concurrency = options?.concurrency ?? 4;

  const articles = (await sql.query(
    `SELECT id, headline, category, source_item_ids
     FROM articles
     WHERE image_url IS NULL
     LIMIT $1`,
    [limit],
  )) as ArticleRow[];

  if (!articles.length) {
    return { processed: 0, updated: 0, failed: 0 };
  }

  let updated = 0;
  let failed = 0;

  await mapPool(articles, concurrency, async (article) => {
    const category = article.category as Category;
    const rawItemId = article.source_item_ids[0];

    if (!rawItemId) {
      const imageUrl =
        category === "ai" || category === "it"
          ? null
          : CATEGORY_FALLBACK_IMAGE[category] ?? CATEGORY_FALLBACK_IMAGE.tech;

      try {
        await sql.query(`UPDATE articles SET image_url = $1 WHERE id = $2`, [
          imageUrl,
          article.id,
        ]);
      } catch (err) {
        failed += 1;
        const message = err instanceof Error ? err.message : String(err);
        console.log(`✗ ${article.headline.slice(0, 50)} — ${message}`);
        return;
      }

      updated += 1;
      console.log(`✓ ${article.headline.slice(0, 60)} (fallback)`);
      return;
    }

    const rawRows = (await sql.query(
      `SELECT id, url, image_url FROM raw_items WHERE id = $1 LIMIT 1`,
      [rawItemId],
    )) as Array<{ id: string; url: string; image_url: string | null }>;
    const rawItem = rawRows[0];

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

    try {
      await sql.query(`UPDATE articles SET image_url = $1 WHERE id = $2`, [
        fallback,
        article.id,
      ]);
    } catch (err) {
      failed += 1;
      const message = err instanceof Error ? err.message : String(err);
      console.log(`✗ ${article.headline.slice(0, 50)} — ${message}`);
      return;
    }

    if (!rawItem.image_url && fallback) {
      await sql.query(`UPDATE raw_items SET image_url = $1 WHERE id = $2`, [
        fallback,
        rawItem.id,
      ]);
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
  const sql = getSql();
  const limit = options?.limit ?? 500;
  const concurrency = options?.concurrency ?? 4;

  const articles = (await sql.query(
    `SELECT id, headline, category, source_item_ids, image_url
     FROM articles
     WHERE image_url IS NOT NULL
       AND (
         image_url ILIKE '%opengraph.githubassets.com%'
         OR image_url ILIKE '%repository-images.githubusercontent.com%'
       )
     LIMIT $1`,
    [limit],
  )) as WeakArticleRow[];

  if (!articles.length) {
    return { processed: 0, updated: 0, failed: 0 };
  }

  let updated = 0;
  let failed = 0;

  await mapPool(articles, concurrency, async (article) => {
    if (!isWeakPreviewImage(article.image_url)) return;

    const category = article.category as Category;
    const rawItemId = article.source_item_ids[0];
    let resolved: string | null = null;

    if (rawItemId) {
      const rawRows = (await sql.query(
        `SELECT id, url, image_url FROM raw_items WHERE id = $1 LIMIT 1`,
        [rawItemId],
      )) as Array<{ id: string; url: string; image_url: string | null }>;
      const rawItem = rawRows[0];

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

    try {
      await sql.query(`UPDATE articles SET image_url = $1 WHERE id = $2`, [
        imageUrl,
        article.id,
      ]);
    } catch (err) {
      failed += 1;
      const message = err instanceof Error ? err.message : String(err);
      console.log(`✗ ${article.headline.slice(0, 50)} — ${message}`);
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
  const sql = getSql();
  const limit = options?.limit ?? 500;
  const concurrency = options?.concurrency ?? 4;

  const articles = (await sql.query(
    `SELECT id, headline, category, source_item_ids, image_url
     FROM articles
     WHERE image_url IS NOT NULL
       AND (
         image_url ILIKE '%profile_image%'
         OR image_url ILIKE '%gravatar.com%'
         OR image_url ILIKE '%avatars.githubusercontent.com%'
       )
     LIMIT $1`,
    [limit],
  )) as BadImageArticleRow[];

  if (!articles.length) {
    return { processed: 0, updated: 0, failed: 0 };
  }

  let updated = 0;
  let failed = 0;

  await mapPool(articles, concurrency, async (article) => {
    if (!isProfileOrAvatarImage(article.image_url)) return;

    const category = article.category as Category;
    const rawItemId = article.source_item_ids[0];
    let resolved: string | null = null;

    if (rawItemId) {
      const rawRows = (await sql.query(
        `SELECT id, url, image_url FROM raw_items WHERE id = $1 LIMIT 1`,
        [rawItemId],
      )) as Array<{ id: string; url: string; image_url: string | null }>;
      const rawItem = rawRows[0];

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

    try {
      await sql.query(`UPDATE articles SET image_url = $1 WHERE id = $2`, [
        imageUrl,
        article.id,
      ]);
    } catch (err) {
      failed += 1;
      const message = err instanceof Error ? err.message : String(err);
      console.log(`✗ ${article.headline.slice(0, 50)} — ${message}`);
      return;
    }

    updated += 1;
    console.log(`✓ ${article.headline.slice(0, 60)} (avatar → ${imageUrl ? "image" : "gradient"})`);
  });

  return { processed: articles.length, updated, failed };
}
