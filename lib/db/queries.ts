import { cache } from "react";
import {
  ARTICLE_DETAIL_COLUMNS,
  ARTICLE_FEED_COLUMNS,
  ARTICLE_LIST_COLUMNS,
} from "@/lib/db/article-columns";
import { getSql, hasDatabaseConfig } from "@/lib/db/client";
import { normalizeListSummary } from "@/lib/ai/article-body";
import { tagSlug } from "@/lib/tags";
import type { Article } from "@/lib/types";

export const ARTICLES_PAGE_SIZE = 48;

export type PaginatedArticles = {
  articles: Article[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

function listSummaryFromRow(row: Record<string, unknown>): unknown {
  if (row.summary !== undefined && row.summary !== null) return row.summary;
  if (row.format !== undefined && row.format !== null) {
    return { format: row.format };
  }
  return undefined;
}

function mapArticle(row: Record<string, unknown>): Article {
  const hasFullSummary =
    row.summary != null &&
    typeof row.summary === "object" &&
    !Array.isArray(row.summary);

  const summary = hasFullSummary
    ? row.summary
    : normalizeListSummary(listSummaryFromRow(row));

  return {
    id: row.id as string,
    slug: row.slug as string,
    locale: row.locale as string,
    category: row.category as string,
    article_type: row.article_type as Article["article_type"],
    seo_title: row.seo_title as string,
    seo_description: row.seo_description as string,
    headline: row.headline as string,
    lead: row.lead as string,
    summary,
    why_it_matters: (row.why_it_matters as string) ?? "",
    tags: (row.tags as string[]) ?? [],
    source_item_ids: (row.source_item_ids as string[]) ?? [],
    published_at: row.published_at as string,
    updated_at: row.updated_at as string,
    is_published: row.is_published as boolean,
    image_url: (row.image_url as string | null) ?? null,
  };
}

function mapFeedArticle(row: Record<string, unknown>): Article {
  return {
    id: "",
    slug: row.slug as string,
    locale: "pl",
    category: "",
    article_type: "trend_item",
    seo_title: "",
    seo_description: (row.seo_description as string) ?? "",
    headline: row.headline as string,
    lead: row.lead as string,
    summary: { format: "brief", highlights: [] },
    why_it_matters: "",
    tags: [],
    source_item_ids: [],
    published_at: row.published_at as string,
    updated_at: row.published_at as string,
    is_published: true,
    image_url: (row.image_url as string | null) ?? null,
  };
}

function paginate(page: number, pageSize: number) {
  const safePage = Math.max(1, page);
  const offset = (safePage - 1) * pageSize;
  return { offset, page: safePage, limit: pageSize };
}

function toPaginatedResult(
  rows: Record<string, unknown>[],
  total: number,
  page: number,
  pageSize: number,
): PaginatedArticles {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return {
    articles: rows.map(mapArticle),
    total,
    page,
    pageSize,
    totalPages,
  };
}

export async function getArticles(params: {
  locale: string;
  category?: string;
  articleType?: string;
  limit?: number;
}): Promise<Article[]> {
  if (!hasDatabaseConfig()) return [];
  const sql = getSql();
  const articleType = params.articleType ?? "trend_item";
  const limit = params.limit ?? 20;

  const rows = params.category
    ? await sql.query(
        `SELECT ${ARTICLE_LIST_COLUMNS}
         FROM articles
         WHERE locale = $1 AND is_published = true AND article_type = $2 AND category = $3
         ORDER BY published_at DESC
         LIMIT $4`,
        [params.locale, articleType, params.category, limit],
      )
    : await sql.query(
        `SELECT ${ARTICLE_LIST_COLUMNS}
         FROM articles
         WHERE locale = $1 AND is_published = true AND article_type = $2
         ORDER BY published_at DESC
         LIMIT $3`,
        [params.locale, articleType, limit],
      );

  return (rows as Record<string, unknown>[]).map(mapArticle);
}

export async function getArticlesForFeed(params: {
  locale: string;
  limit?: number;
}): Promise<Article[]> {
  if (!hasDatabaseConfig()) return [];
  const sql = getSql();
  const rows = await sql.query(
    `SELECT ${ARTICLE_FEED_COLUMNS}
     FROM articles
     WHERE locale = $1 AND is_published = true AND article_type = 'trend_item'
     ORDER BY published_at DESC
     LIMIT $2`,
    [params.locale, params.limit ?? 50],
  );
  return (rows as Record<string, unknown>[]).map(mapFeedArticle);
}

export async function getDigestLinkSources(params: {
  locale: string;
  category: string;
  days: number;
  limit?: number;
}): Promise<Array<{ headline: string; slug: string }>> {
  if (!hasDatabaseConfig()) return [];

  const since = new Date();
  since.setDate(since.getDate() - params.days);

  const sql = getSql();
  const rows = await sql.query(
    `SELECT headline, slug
     FROM articles
     WHERE locale = $1 AND category = $2 AND article_type = 'trend_item'
       AND is_published = true AND published_at >= $3
     ORDER BY published_at DESC
     LIMIT $4`,
    [params.locale, params.category, since.toISOString(), params.limit ?? 30],
  );

  return (rows as Array<{ headline: string; slug: string }>).map((row) => ({
    headline: row.headline,
    slug: row.slug,
  }));
}

export async function getArticlesPaginated(params: {
  locale: string;
  category?: string;
  articleType?: string;
  page?: number;
  pageSize?: number;
}): Promise<PaginatedArticles> {
  if (!hasDatabaseConfig()) {
    return { articles: [], total: 0, page: 1, pageSize: ARTICLES_PAGE_SIZE, totalPages: 1 };
  }

  const pageSize = params.pageSize ?? ARTICLES_PAGE_SIZE;
  const { offset, page, limit } = paginate(params.page ?? 1, pageSize);
  const articleType = params.articleType ?? "trend_item";
  const sql = getSql();

  if (params.category) {
    const countRows = await sql.query(
      `SELECT count(*)::int AS count FROM articles
       WHERE locale = $1 AND is_published = true AND article_type = $2 AND category = $3`,
      [params.locale, articleType, params.category],
    );
    const rows = await sql.query(
      `SELECT ${ARTICLE_LIST_COLUMNS}
       FROM articles
       WHERE locale = $1 AND is_published = true AND article_type = $2 AND category = $3
       ORDER BY published_at DESC
       LIMIT $4 OFFSET $5`,
      [params.locale, articleType, params.category, limit, offset],
    );
    return toPaginatedResult(
      rows as Record<string, unknown>[],
      Number((countRows[0] as { count: number }).count),
      page,
      pageSize,
    );
  }

  const countRows = await sql.query(
    `SELECT count(*)::int AS count FROM articles
     WHERE locale = $1 AND is_published = true AND article_type = $2`,
    [params.locale, articleType],
  );
  const rows = await sql.query(
    `SELECT ${ARTICLE_LIST_COLUMNS}
     FROM articles
     WHERE locale = $1 AND is_published = true AND article_type = $2
     ORDER BY published_at DESC
     LIMIT $3 OFFSET $4`,
    [params.locale, articleType, limit, offset],
  );
  return toPaginatedResult(
    rows as Record<string, unknown>[],
    Number((countRows[0] as { count: number }).count),
    page,
    pageSize,
  );
}

export const getArticleBySlug = cache(
  async (locale: string, slug: string): Promise<Article | null> => {
    if (!hasDatabaseConfig()) return null;
    const sql = getSql();
    const rows = await sql.query(
      `SELECT ${ARTICLE_DETAIL_COLUMNS}
       FROM articles
       WHERE locale = $1 AND slug = $2 AND is_published = true
       LIMIT 1`,
      [locale, slug],
    );
    const row = (rows as Record<string, unknown>[])[0];
    return row ? mapArticle(row) : null;
  },
);

export async function getRelatedArticles(
  article: Article,
  limit = 4,
): Promise<Article[]> {
  if (!hasDatabaseConfig()) return [];
  const sql = getSql();
  const tags = (article.tags ?? []).filter(Boolean);

  if (tags.length > 0) {
    const rows = await sql.query(
      `SELECT ${ARTICLE_LIST_COLUMNS}
       FROM articles
       WHERE locale = $1 AND is_published = true AND id <> $2 AND tags && $3::text[]
       ORDER BY published_at DESC
       LIMIT 12`,
      [article.locale, article.id, tags],
    );

    const tagSet = new Set(tags);
    const ranked = (rows as Record<string, unknown>[])
      .map((row) => mapArticle(row))
      .sort((a, b) => {
        const overlapDiff =
          b.tags.filter((tag) => tagSet.has(tag)).length -
          a.tags.filter((tag) => tagSet.has(tag)).length;
        if (overlapDiff !== 0) return overlapDiff;
        return (
          new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
        );
      });

    if (ranked.length >= limit) return ranked.slice(0, limit);

    const picked = new Set(ranked.map((item) => item.id));
    const fallback = await sql.query(
      `SELECT ${ARTICLE_LIST_COLUMNS}
       FROM articles
       WHERE locale = $1 AND category = $2 AND is_published = true AND id <> $3
       ORDER BY published_at DESC
       LIMIT $4`,
      [article.locale, article.category, article.id, limit],
    );

    for (const row of fallback as Record<string, unknown>[]) {
      if (ranked.length >= limit) break;
      if (picked.has(row.id as string)) continue;
      ranked.push(mapArticle(row));
      picked.add(row.id as string);
    }

    return ranked.slice(0, limit);
  }

  const rows = await sql.query(
    `SELECT ${ARTICLE_LIST_COLUMNS}
     FROM articles
     WHERE locale = $1 AND category = $2 AND is_published = true AND id <> $3
     ORDER BY published_at DESC
     LIMIT $4`,
    [article.locale, article.category, article.id, limit],
  );
  return (rows as Record<string, unknown>[]).map(mapArticle);
}

export async function getArticlesByTag(params: {
  locale: string;
  tag: string;
  limit?: number;
}): Promise<Article[]> {
  if (!hasDatabaseConfig()) return [];
  const sql = getSql();
  const rows = await sql.query(
    `SELECT ${ARTICLE_LIST_COLUMNS}
     FROM articles
     WHERE locale = $1 AND is_published = true AND article_type = 'trend_item'
       AND tags @> ARRAY[$2]::text[]
     ORDER BY published_at DESC
     LIMIT $3`,
    [params.locale, params.tag, params.limit ?? 24],
  );
  return (rows as Record<string, unknown>[]).map(mapArticle);
}

export async function getArticlesByTagPaginated(params: {
  locale: string;
  tag: string;
  page?: number;
  pageSize?: number;
}): Promise<PaginatedArticles> {
  if (!hasDatabaseConfig()) {
    return { articles: [], total: 0, page: 1, pageSize: ARTICLES_PAGE_SIZE, totalPages: 1 };
  }

  const pageSize = params.pageSize ?? ARTICLES_PAGE_SIZE;
  const { offset, page, limit } = paginate(params.page ?? 1, pageSize);
  const sql = getSql();

  const countRows = await sql.query(
    `SELECT count(*)::int AS count FROM articles
     WHERE locale = $1 AND is_published = true AND article_type = 'trend_item'
       AND tags @> ARRAY[$2]::text[]`,
    [params.locale, params.tag],
  );
  const rows = await sql.query(
    `SELECT ${ARTICLE_LIST_COLUMNS}
     FROM articles
     WHERE locale = $1 AND is_published = true AND article_type = 'trend_item'
       AND tags @> ARRAY[$2]::text[]
     ORDER BY published_at DESC
     LIMIT $3 OFFSET $4`,
    [params.locale, params.tag, limit, offset],
  );

  return toPaginatedResult(
    rows as Record<string, unknown>[],
    Number((countRows[0] as { count: number }).count),
    page,
    pageSize,
  );
}

export async function getDistinctTags(
  locale: string,
  options?: { minCount?: number },
): Promise<Array<{ name: string; slug: string; count: number }>> {
  if (!hasDatabaseConfig()) return [];
  const minCount = options?.minCount ?? 1;
  const sql = getSql();

  try {
    const rows = await sql.query(
      `SELECT name, cnt FROM get_tag_counts($1, $2)`,
      [locale, minCount],
    );
    return (rows as Array<{ name: string; cnt: number }>).map((row) => ({
      name: row.name,
      slug: tagSlug(row.name),
      count: Number(row.cnt),
    }));
  } catch {
    const rows = await sql.query(
      `SELECT tags FROM articles
       WHERE locale = $1 AND is_published = true AND article_type = 'trend_item'`,
      [locale],
    );

    const counts = new Map<string, number>();
    for (const row of rows as Array<{ tags: string[] }>) {
      for (const tag of row.tags ?? []) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }

    return [...counts.entries()]
      .map(([name, count]) => ({ name, slug: tagSlug(name), count }))
      .filter((item) => item.slug.length > 0 && item.count >= minCount)
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, locale));
  }
}

export async function resolveTagName(
  locale: string,
  slug: string,
): Promise<string | null> {
  const tags = await getDistinctTags(locale);
  return tags.find((item) => item.slug === slug)?.name ?? null;
}

export async function getAllArticleSlugs(): Promise<
  Array<{ locale: string; slug: string; updated_at: string }>
> {
  if (!hasDatabaseConfig()) return [];
  const sql = getSql();
  const rows = await sql.query(
    `SELECT locale, slug, updated_at
     FROM articles
     WHERE is_published = true
     ORDER BY published_at DESC`,
  );
  return rows as Array<{ locale: string; slug: string; updated_at: string }>;
}

export async function getArticleSlugsForLocale(
  locale: string,
): Promise<Array<{ slug: string }>> {
  if (!hasDatabaseConfig()) return [];
  const sql = getSql();
  const rows = await sql.query(
    `SELECT slug
     FROM articles
     WHERE locale = $1 AND is_published = true
     ORDER BY published_at DESC`,
    [locale],
  );
  return rows as Array<{ slug: string }>;
}

export async function getLatestJobStatus() {
  if (!hasDatabaseConfig()) return [];
  const sql = getSql();
  const rows = await sql.query(
    `SELECT id, job_type, status, started_at, finished_at, items_processed, error
     FROM generation_jobs
     ORDER BY started_at DESC
     LIMIT 5`,
  );
  return rows ?? [];
}
