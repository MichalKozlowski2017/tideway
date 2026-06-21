import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { ArticleCard } from "@/components/article-card";
import { PageHeader } from "@/components/page-header";
import { getArticles } from "@/lib/db/queries";
import { ui } from "@/lib/i18n/config";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Dzienny przegląd | Tideway",
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
      <main className="mx-auto max-w-6xl px-4 py-12">
        <PageHeader
          title={t.dailyDigest}
          description={
            locale === "pl"
              ? "Najważniejsze trendy ze wszystkich kategorii w jednym miejscu."
              : "Top trends across all categories in one place."
          }
        />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
