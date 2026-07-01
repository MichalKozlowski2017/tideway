import {
  getSupabaseAdmin,
  getSupabasePublic,
  hasSupabaseConfig,
} from "@/lib/db/supabase";
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

function mapArticle(row: Record<string, unknown>): Article {
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
    summary: row.summary,
    why_it_matters: row.why_it_matters as string,
    tags: (row.tags as string[]) ?? [],
    source_item_ids: (row.source_item_ids as string[]) ?? [],
    published_at: row.published_at as string,
    updated_at: row.updated_at as string,
    is_published: row.is_published as boolean,
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
    .select("*")
    .eq("locale", params.locale)
    .eq("is_published", true)
    .order("published_at", { ascending: false })
    .limit(params.limit ?? 20);

  if (params.category) query = query.eq("category", params.category);
  if (params.articleType) query = query.eq("article_type", params.articleType);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(mapArticle);
}

export async function getArticlesForFeed(params: {
  locale: string;
  limit?: number;
}): Promise<Article[]> {
  return getArticles({
    locale: params.locale,
    limit: params.limit ?? 50,
  });
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
    .select("*", { count: "exact" })
    .eq("locale", params.locale)
    .eq("is_published", true)
    .order("published_at", { ascending: false });

  if (params.category) query = query.eq("category", params.category);
  if (params.articleType) query = query.eq("article_type", params.articleType);

  const { data, error, count } = await query.range(from, to);
  if (error) throw error;
  return toPaginatedResult(data, count, page, pageSize);
}

export async function getArticleBySlug(
  locale: string,
  slug: string,
): Promise<Article | null> {
  if (!hasSupabaseConfig()) return null;
  const client = getSupabasePublic();
  const { data, error } = await client
    .from("articles")
    .select("*")
    .eq("locale", locale)
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();

  if (error) throw error;
  return data ? mapArticle(data) : null;
}

export async function getRelatedArticles(
  article: Article,
  limit = 4,
): Promise<Article[]> {
  if (!hasSupabaseConfig()) return [];
  const client = getSupabasePublic();
  const { data, error } = await client
    .from("articles")
    .select("*")
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
    .select("*")
    .eq("locale", params.locale)
    .eq("is_published", true)
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
    .select("*", { count: "exact" })
    .eq("locale", params.locale)
    .eq("is_published", true)
    .contains("tags", [params.tag])
    .order("published_at", { ascending: false })
    .range(from, to);

  if (error) throw error;
  return toPaginatedResult(data, count, page, pageSize);
}

export async function getDistinctTags(
  locale: string,
): Promise<Array<{ name: string; slug: string; count: number }>> {
  if (!hasSupabaseConfig()) return [];
  const client = getSupabaseAdmin();
  const data = await fetchAllRows<{ tags: string[] }>(async (from, to) => {
    const { data: page, error } = await client
      .from("articles")
      .select("tags")
      .eq("locale", locale)
      .eq("is_published", true)
      .range(from, to);
    return { data: page, error };
  });

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    for (const tag of (row.tags as string[]) ?? []) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([name, count]) => ({ name, slug: tagSlug(name), count }))
    .filter((item) => item.slug.length > 0)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, locale));
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
    .select("*")
    .order("started_at", { ascending: false })
    .limit(5);
  return data ?? [];
}
