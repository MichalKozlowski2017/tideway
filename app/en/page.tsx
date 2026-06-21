import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { ArticleCard } from "@/components/article-card";
import { getArticles } from "@/lib/db/queries";
import { ui } from "@/lib/i18n/config";
import { categorySlug, type Category } from "@/lib/types";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "TrendPulse — today's trends",
  description:
    "Automated trend summaries: technology, gaming, AI, and more.",
};

const FEATURED: Category[] = ["technology", "gaming", "ai"];

export default async function EnHomePage() {
  const locale = "en" as const;
  const t = ui[locale];
  const articles = await getArticles({ locale, limit: 12 });

  return (
    <>
      <SiteHeader locale={locale} />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-3xl font-bold text-zinc-900">{t.homeTitle}</h1>
        <p className="mt-2 max-w-2xl text-zinc-600">{t.homeDescription}</p>

        <div className="mt-6 flex flex-wrap gap-3">
          {FEATURED.map((cat) => (
            <a
              key={cat}
              href={`/en/trends/${categorySlug(locale, cat)}`}
              className="rounded-full bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-700"
            >
              {cat === "technology" ? "Technology" : cat === "gaming" ? "Gaming" : "AI"}
            </a>
          ))}
        </div>

        <h2 className="mt-10 text-xl font-semibold text-zinc-900">{t.latest}</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
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
