import type { Locale } from "@/lib/types";
import { ui } from "@/lib/i18n/config";
import { ArticleCard } from "@/components/article-card";
import { PageHeader } from "@/components/page-header";
import type { Article } from "@/lib/types";

export function TagPage({
  locale,
  tag,
  articles,
}: {
  locale: Locale;
  tag: string;
  articles: Article[];
}) {
  const t = ui[locale];
  const title = t.tagPageTitle.replace("{tag}", tag);
  const description = t.tagPageDescription.replace("{tag}", tag);
  const countLabel =
    locale === "pl"
      ? articles.length === 1
        ? "1 artykuł"
        : articles.length < 5
          ? `${articles.length} artykuły`
          : `${articles.length} artykułów`
      : articles.length === 1
        ? "1 article"
        : `${articles.length} articles`;

  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      <PageHeader title={title} description={description} meta={countLabel} />
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
  );
}
