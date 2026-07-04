import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { ArticleCard } from "@/components/article-card";
import { PageHeader } from "@/components/page-header";
import { getArticles } from "@/lib/db/queries";
import { ui } from "@/lib/i18n/config";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "Tygodniowy przegląd | Tideway",
  description: "Top trendy tygodnia — co rosło, co spadało.",
};

export default async function WeeklyDigestPage() {
  const locale = "pl" as const;
  const t = ui[locale];
  const articles = await getArticles({
    locale,
    articleType: "weekly_digest",
    limit: 20,
  });

  return (
    <>
      <SiteHeader locale={locale} />
      <main className="mx-auto max-w-6xl px-4 py-12">
        <PageHeader
          title={t.weeklyDigest}
          description={
            locale === "pl"
              ? "Podsumowanie tygodnia — najważniejsze wątki i trendy."
              : "Week in review — top stories and trends."
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
