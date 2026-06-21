import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { ArticleCard } from "@/components/article-card";
import { PageHeader } from "@/components/page-header";
import { getArticles } from "@/lib/db/queries";
import { ui, categoryPath, categoryNavLabel } from "@/lib/i18n/config";
import { SITE_NAME } from "@/lib/site";
import { categorySlug, MAIN_CATEGORIES, type Category } from "@/lib/types";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Tideway — co dziś w trendach",
  description:
    "Automatyczne podsumowania trendów: technologia, gry, AI, sport i finanse.",
};

export default async function HomePage() {
  const locale = "pl" as const;
  const t = ui[locale];
  const articles = await getArticles({ locale, limit: 12 });

  return (
    <>
      <SiteHeader locale={locale} />
      <main className="mx-auto max-w-6xl px-4 py-12 md:py-16">
        <section className="rounded-3xl bg-white px-6 py-10 shadow-sm ring-1 ring-zinc-950/5 md:px-10 md:py-12">
          <p className="text-sm font-medium uppercase tracking-widest text-blue-600">
            {locale === "pl" ? "Codzienne podsumowania" : "Daily summaries"}
          </p>
          <h1 className="mt-3 max-w-2xl text-4xl font-semibold tracking-tight text-zinc-900 md:text-5xl">
            {t.homeTitle.replace(`${SITE_NAME} — `, "")}
          </h1>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-zinc-500">
            {t.homeDescription}
          </p>

          <div className="mt-8 flex flex-wrap gap-2">
            {MAIN_CATEGORIES.map((cat) => (
              <Link
                key={cat}
                href={categoryPath(locale, categorySlug(locale, cat))}
                className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900"
              >
                {categoryNavLabel(locale, cat as Category)}
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-14">
          <PageHeader
            title={t.latest}
            description={
              locale === "pl"
                ? "Świeże artykuły ze wszystkich kategorii."
                : "Fresh articles across all categories."
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
        </section>
      </main>
    </>
  );
}
