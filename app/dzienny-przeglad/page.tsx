import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { ArticleCard } from "@/components/article-card";
import { getArticles } from "@/lib/db/queries";
import { ui } from "@/lib/i18n/config";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Dzienny przegląd | TrendPulse",
  description: "Podsumowanie najważniejszych trendów dnia.",
};

export default async function DailyDigestPage() {
  const locale = "pl" as const;
  const t = ui[locale];
  const articles = await getArticles({
    locale,
    articleType: "daily_digest",
    limit: 20,
  });

  return (
    <>
      <SiteHeader locale={locale} />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-3xl font-bold text-zinc-900">{t.dailyDigest}</h1>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {articles.length === 0 ? (
            <p className="text-zinc-500">{t.noArticles}</p>
          ) : (
            articles.map((article) => (
              <ArticleCard key={article.id} article={article} locale={locale} />
            ))
          )}
        </div>
      </main>
    </>
  );
}
