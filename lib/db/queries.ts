import { cache } from "react";
import {
  ARTICLE_DETAIL_COLUMNS,
  ARTICLE_FEED_COLUMNS,
  ARTICLE_LIST_COLUMNS,
} from "@/lib/db/article-columns";
import {
  getSupabaseAdmin,
  getSupabasePublic,
  hasSupabaseConfig,
} from "@/lib/db/supabase";
import { normalizeListSummary } from "@/lib/ai/article-body";
import { tagSlug } from "@/lib/tags";
import type { Article } from "@/lib/types";

export const ARTICLES_PAGE_SIZE = 24;

/** Supabase/PostgREST returns at most 1000 rows per request. */
const SUPABASE_PAGE_SIZE = 1000;

async function fetchAllRows<T>(
  fetchPage: (from: number, to: number) => Promise<{ data: T[] | null; error: Error | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await fetchPage(offset, offset + SUPABASE_PAGE_SIZE - 1);
    if (error) throw error;
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < SUPABASE_PAGE_SIZE) break;
    offset += SUPABASE_PAGE_SIZE;
  }

  return rows;
}

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

export async function getArticles(params: {
  locale: string;
  category?: string;
  articleType?: string;
  limit?: number;
}): Promise<Article[]> {
  if (!hasSupabaseConfig()) return [];
  const client = getSupabasePublic();
  let query = client
    .from("articles")
    .select(ARTICLE_LIST_COLUMNS)
    .eq("locale", params.locale)
    .eq("is_published", true)
    .order("published_at", { ascending: false })
    .limit(params.limit ?? 20);

  if (params.category) query = query.eq("category", params.category);
  if (params.articleType) {
    query = query.eq("article_type", params.articleType);
  } else {
    query = query.eq("article_type", "trend_item");
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(mapArticle);
}

export async function getArticlesForFeed(params: {
  locale: string;
  limit?: number;
}): Promise<Article[]> {
  if (!hasSupabaseConfig()) return [];
  const client = getSupabasePublic();
  const { data, error } = await client
    .from("articles")
    .select(ARTICLE_FEED_COLUMNS)
    .eq("locale", params.locale)
    .eq("is_published", true)
    .eq("article_type", "trend_item")
    .order("published_at", { ascending: false })
    .limit(params.limit ?? 50);

  if (error) throw error;
  return (data ?? []).map(mapFeedArticle);
}

export async function getDigestLinkSources(params: {
  locale: string;
  category: string;
  days: number;
  limit?: number;
}): Promise<Array<{ headline: string; slug: string }>> {
  if (!hasSupabaseConfig()) return [];

  const since = new Date();
  since.setDate(since.getDate() - params.days);

  const client = getSupabasePublic();
  const { data, error } = await client
    .from("articles")
    .select("headline, slug")
    .eq("locale", params.locale)
    .eq("category", params.category)
    .eq("article_type", "trend_item")
    .eq("is_published", true)
    .gte("published_at", since.toISOString())
    .order("published_at", { ascending: false })
    .limit(params.limit ?? 30);

  if (error) throw error;
  return (data ?? []).map((row) => ({
    headline: row.headline as string,
    slug: row.slug as string,
  }));
}

function paginateRange(page: number, pageSize: number) {
  const safePage = Math.max(1, page);
  const from = (safePage - 1) * pageSize;
  return { from, to: from + pageSize - 1, page: safePage };
}

function toPaginatedResult(
  rows: Record<string, unknown>[] | null,
  count: number | null,
  page: number,
  pageSize: number,
): PaginatedArticles {
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return {
    articles: (rows ?? []).map(mapArticle),
    total,
    page,
    pageSize,
    totalPages,
  };
}

export async function getArticlesPaginated(params: {
  locale: string;
  category?: string;
  articleType?: string;
  page?: number;
  pageSize?: number;
}): Promise<PaginatedArticles> {
  if (!hasSupabaseConfig()) {
    return { articles: [], total: 0, page: 1, pageSize: ARTICLES_PAGE_SIZE, totalPages: 1 };
  }

  const pageSize = params.pageSize ?? ARTICLES_PAGE_SIZE;
  const { from, to, page } = paginateRange(params.page ?? 1, pageSize);
  const client = getSupabasePublic();

  let query = client
    .from("articles")
    .select(ARTICLE_LIST_COLUMNS, { count: "exact" })
    .eq("locale", params.locale)
    .eq("is_published", true)
    .order("published_at", { ascending: false });

  if (params.category) query = query.eq("category", params.category);
  if (params.articleType) {
    query = query.eq("article_type", params.articleType);
  } else {
    query = query.eq("article_type", "trend_item");
  }

  const { data, error, count } = await query.range(from, to);
  if (error) throw error;
  return toPaginatedResult(data, count, page, pageSize);
}

export const getArticleBySlug = cache(
  async (locale: string, slug: string): Promise<Article | null> => {
    if (!hasSupabaseConfig()) return null;
    const client = getSupabasePublic();
    const { data, error } = await client
      .from("articles")
      .select(ARTICLE_DETAIL_COLUMNS)
      .eq("locale", locale)
      .eq("slug", slug)
      .eq("is_published", true)
      .maybeSingle();

    if (error) throw error;
    return data ? mapArticle(data) : null;
  },
);

export async function getRelatedArticles(
  article: Article,
  limit = 4,
): Promise<Article[]> {
  if (!hasSupabaseConfig()) return [];
  const client = getSupabasePublic();
  const tags = (article.tags ?? []).filter(Boolean);

  if (tags.length > 0) {
    const { data, error } = await client
      .from("articles")
      .select(ARTICLE_LIST_COLUMNS)
      .eq("locale", article.locale)
      .eq("is_published", true)
      .neq("id", article.id)
      .overlaps("tags", tags)
      .order("published_at", { ascending: false })
      .limit(12);

    if (error) throw error;

    const tagSet = new Set(tags);
    const ranked = (data ?? [])
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
    const { data: fallback, error: fallbackError } = await client
      .from("articles")
      .select(ARTICLE_LIST_COLUMNS)
      .eq("locale", article.locale)
      .eq("category", article.category)
      .eq("is_published", true)
      .neq("id", article.id)
      .order("published_at", { ascending: false })
      .limit(limit);

    if (fallbackError) throw fallbackError;

    for (const row of fallback ?? []) {
      if (ranked.length >= limit) break;
      if (picked.has(row.id as string)) continue;
      ranked.push(mapArticle(row));
      picked.add(row.id as string);
    }

    return ranked.slice(0, limit);
  }

  const { data, error } = await client
    .from("articles")
    .select(ARTICLE_LIST_COLUMNS)
    .eq("locale", article.locale)
    .eq("category", article.category)
    .eq("is_published", true)
    .neq("id", article.id)
    .order("published_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []).map(mapArticle);
}

export async function getArticlesByTag(params: {
  locale: string;
  tag: string;
  limit?: number;
}): Promise<Article[]> {
  if (!hasSupabaseConfig()) return [];
  const client = getSupabasePublic();
  const { data, error } = await client
    .from("articles")
    .select(ARTICLE_LIST_COLUMNS)
    .eq("locale", params.locale)
    .eq("is_published", true)
    .eq("article_type", "trend_item")
    .contains("tags", [params.tag])
    .order("published_at", { ascending: false })
    .limit(params.limit ?? 24);

  if (error) throw error;
  return (data ?? []).map(mapArticle);
}

export async function getArticlesByTagPaginated(params: {
  locale: string;
  tag: string;
  page?: number;
  pageSize?: number;
}): Promise<PaginatedArticles> {
  if (!hasSupabaseConfig()) {
    return { articles: [], total: 0, page: 1, pageSize: ARTICLES_PAGE_SIZE, totalPages: 1 };
  }

  const pageSize = params.pageSize ?? ARTICLES_PAGE_SIZE;
  const { from, to, page } = paginateRange(params.page ?? 1, pageSize);
  const client = getSupabasePublic();

  const { data, error, count } = await client
    .from("articles")
    .select(ARTICLE_LIST_COLUMNS, { count: "exact" })
    .eq("locale", params.locale)
    .eq("is_published", true)
    .eq("article_type", "trend_item")
    .contains("tags", [params.tag])
    .order("published_at", { ascending: false })
    .range(from, to);

  if (error) throw error;
  return toPaginatedResult(data, count, page, pageSize);
}

export async function getDistinctTags(
  locale: string,
  options?: { minCount?: number },
): Promise<Array<{ name: string; slug: string; count: number }>> {
  if (!hasSupabaseConfig()) return [];
  const minCount = options?.minCount ?? 1;
  const client = getSupabaseAdmin();

  const { data, error } = await client.rpc("get_tag_counts", {
    p_locale: locale,
    p_min_count: minCount,
  });

  if (error) {
    // Fallback if RPC not deployed yet
    const rows = await fetchAllRows<{ tags: string[] }>(async (from, to) => {
      const { data: page, error: pageError } = await client
        .from("articles")
        .select("tags")
        .eq("locale", locale)
        .eq("is_published", true)
        .eq("article_type", "trend_item")
        .range(from, to);
      return { data: page, error: pageError };
    });

    const counts = new Map<string, number>();
    for (const row of rows) {
      for (const tag of row.tags ?? []) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }

    return [...counts.entries()]
      .map(([name, count]) => ({ name, slug: tagSlug(name), count }))
      .filter((item) => item.slug.length > 0 && item.count >= minCount)
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, locale));
  }

  return (data ?? []).map((row: { name: string; cnt: number }) => ({
    name: row.name,
    slug: tagSlug(row.name),
    count: Number(row.cnt),
  }));
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
  if (!hasSupabaseConfig()) return [];
  const client = getSupabaseAdmin();
  return fetchAllRows(async (from, to) => {
    const { data, error } = await client
      .from("articles")
      .select("locale, slug, updated_at")
      .eq("is_published", true)
      .order("published_at", { ascending: false })
      .range(from, to);
    return { data, error };
  });
}

export async function getLatestJobStatus() {
  if (!hasSupabaseConfig()) return [];
  const client = getSupabaseAdmin();
  const { data } = await client
    .from("generation_jobs")
    .select("id, job_type, status, started_at, finished_at, items_processed, error")
    .order("started_at", { ascending: false })
    .limit(5);
  return data ?? [];
}
