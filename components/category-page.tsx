import type { Locale } from "@/lib/types";
import { formatArticleCount } from "@/lib/i18n/plural";
import { ArticleFeed } from "@/components/article-feed";
import { PageHeader } from "@/components/page-header";
import type { Article } from "@/lib/types";
import { categoryLabels } from "@/lib/i18n/config";

export function CategoryPage({
  locale,
  category,
  articles,
  total,
  totalPages,
}: {
  locale: Locale;
  category: string;
  articles: Article[];
  total: number;
  totalPages: number;
}) {
  const labels = categoryLabels[locale][category] ?? {
    title: category,
    description: "",
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      <PageHeader
        title={labels.title}
        description={labels.description}
        meta={formatArticleCount(locale, total)}
      />
      <ArticleFeed
        key={category}
        locale={locale}
        initialArticles={articles}
        total={total}
        totalPages={totalPages}
        query={{ category }}
      />
    </main>
  );
}
