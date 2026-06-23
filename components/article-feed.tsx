"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Article, Locale } from "@/lib/types";
import { ui } from "@/lib/i18n/config";
import { formatArticleCount } from "@/lib/i18n/plural";
import { ArticleCard } from "@/components/article-card";
import { ArticleCardSkeleton } from "@/components/article-card-skeleton";

export type ArticleFeedQuery = {
  category?: string;
  tag?: string;
  articleType?: string;
};

type ArticleFeedProps = {
  locale: Locale;
  initialArticles: Article[];
  total: number;
  totalPages: number;
  query: ArticleFeedQuery;
};

type FeedResponse = {
  articles: Article[];
  total: number;
  page: number;
  totalPages: number;
};

export function ArticleFeed({
  locale,
  initialArticles,
  total,
  totalPages,
  query,
}: ArticleFeedProps) {
  const t = ui[locale];
  const [articles, setArticles] = useState(initialArticles);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(totalPages > 1);
  const [error, setError] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);
  const category = query.category;
  const tag = query.tag;
  const articleType = query.articleType;

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore) return;

    const nextPage = page + 1;
    loadingRef.current = true;
    setLoading(true);
    setError(false);

    try {
      const params = new URLSearchParams({
        locale,
        page: String(nextPage),
      });
      if (category) params.set("category", category);
      if (tag) params.set("tag", tag);
      if (articleType) params.set("articleType", articleType);

      const res = await fetch(`/api/articles?${params.toString()}`);
      if (!res.ok) throw new Error("fetch failed");

      const data = (await res.json()) as FeedResponse;
      setArticles((prev) => [...prev, ...data.articles]);
      setPage(nextPage);
      setHasMore(nextPage < data.totalPages);
    } catch {
      setError(true);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [hasMore, page, locale, category, tag, articleType]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { rootMargin: "320px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore, hasMore]);

  if (articles.length === 0) {
    return <p className="text-zinc-500">{t.noArticles}</p>;
  }

  const progressLabel = t.feedProgress
    .replace("{shown}", String(articles.length))
    .replace("{total}", String(total));

  const endLabel =
    locale === "pl"
      ? `To wszystko — ${formatArticleCount(locale, total)}`
      : `You're all caught up — ${formatArticleCount(locale, total)}`;

  return (
    <>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {articles.map((article) => (
          <div key={article.id} className="article-feed-item">
            <ArticleCard article={article} locale={locale} />
          </div>
        ))}
        {loading &&
          Array.from({ length: 3 }).map((_, i) => (
            <ArticleCardSkeleton key={`skel-${i}`} />
          ))}
      </div>

      <div ref={sentinelRef} className="h-px w-full" aria-hidden />

      <div className="mt-10 flex flex-col items-center gap-3 text-center">
        {loading && (
          <p className="flex items-center gap-2 text-sm text-zinc-500">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-zinc-200 border-t-blue-600" />
            {t.feedLoading}
          </p>
        )}

        {!loading && error && (
          <button
            type="button"
            onClick={() => void loadMore()}
            className="text-sm font-medium text-blue-600 transition hover:text-blue-800"
          >
            {t.feedRetry}
          </button>
        )}

        {!loading && !error && hasMore && (
          <p className="text-sm text-zinc-400">{progressLabel}</p>
        )}

        {!hasMore && !error && (
          <p className="text-sm text-zinc-400">{endLabel}</p>
        )}
      </div>
    </>
  );
}
