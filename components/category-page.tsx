import type { Locale } from "@/lib/types";
import { ui } from "@/lib/i18n/config";
import { ArticleCard } from "@/components/article-card";
import { PageHeader } from "@/components/page-header";
import type { Article } from "@/lib/types";
import { categoryLabels } from "@/lib/i18n/config";

export function CategoryPage({
  locale,
  category,
  articles,
}: {
  locale: Locale;
  category: string;
  articles: Article[];
}) {
  const labels = categoryLabels[locale][category] ?? {
    title: category,
    description: "",
  };
  const t = ui[locale];

  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      <PageHeader title={labels.title} description={labels.description} />
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
