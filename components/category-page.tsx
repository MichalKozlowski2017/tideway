import type { Locale } from "@/lib/types";
import { categoryLabels, ui } from "@/lib/i18n/config";
import { ArticleCard } from "@/components/article-card";
import type { Article } from "@/lib/types";

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
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-bold text-zinc-900">{labels.title}</h1>
      <p className="mt-2 text-zinc-600">{labels.description}</p>

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
  );
}
