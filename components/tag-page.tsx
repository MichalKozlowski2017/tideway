import type { Locale } from "@/lib/types";
import { ui } from "@/lib/i18n/config";
import { formatArticleCount } from "@/lib/i18n/plural";
import { ArticleFeed } from "@/components/article-feed";
import { PageHeader } from "@/components/page-header";
import type { Article } from "@/lib/types";

export function TagPage({
  locale,
  tag,
  articles,
  total,
  totalPages,
}: {
  locale: Locale;
  tag: string;
  articles: Article[];
  total: number;
  totalPages: number;
}) {
  const t = ui[locale];
  const title = t.tagPageTitle.replace("{tag}", tag);
  const description = t.tagPageDescription.replace("{tag}", tag);

  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      <PageHeader
        title={title}
        description={description}
        meta={formatArticleCount(locale, total)}
      />
      <ArticleFeed
        key={tag}
        locale={locale}
        initialArticles={articles}
        total={total}
        totalPages={totalPages}
        query={{ tag }}
      />
    </main>
  );
}
