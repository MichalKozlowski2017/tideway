import Link from "next/link";
import type { Article, Locale } from "@/lib/types";
import { parseArticleBody } from "@/lib/ai/article-body";
import { articlePath, categoryNavLabel } from "@/lib/i18n/config";
import { ArticleImage } from "@/components/article-image";
import { TagLink } from "@/components/tag-link";
import type { Category } from "@/lib/types";

const FORMAT_LABELS: Record<string, { pl: string; en: string }> = {
  story: { pl: "Reportaż", en: "Story" },
  brief: { pl: "Skrót", en: "Brief" },
  community: { pl: "Dyskusja", en: "Community" },
  analysis: { pl: "Analiza", en: "Analysis" },
  essay: { pl: "Esej", en: "Essay" },
  synthesis: { pl: "Synteza", en: "Synthesis" },
};

export function ArticleCard({
  article,
  locale,
}: {
  article: Article;
  locale: Locale;
}) {
  const content = parseArticleBody(article.summary);
  const snippet =
    content.body
      ?.split("\n\n")
      .find((block) => !block.trim().startsWith("## "))
      ?.replace(/^##\s+/, "")
      .slice(0, 160) ?? article.lead;
  const formatLabel =
    FORMAT_LABELS[content.format]?.[locale] ?? content.format;
  const categoryLabel = categoryNavLabel(
    locale,
    article.category as Category,
  );

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-zinc-950/5 transition hover:shadow-md hover:ring-zinc-950/10">
      <Link href={articlePath(locale, article.slug)} className="block overflow-hidden">
        <ArticleImage
          imageUrl={article.image_url}
          category={article.category}
          alt={article.headline}
          variant="card"
        />
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-blue-600">
            {categoryLabel}
          </span>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
            {formatLabel}
          </span>
        </div>
        <h2 className="mt-3 text-lg font-semibold leading-snug tracking-tight text-zinc-900">
          <Link
            href={articlePath(locale, article.slug)}
            className="transition group-hover:text-blue-700"
          >
            {article.headline}
          </Link>
        </h2>
        <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-zinc-500">
          {snippet}
        </p>
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-zinc-100 pt-4">
          <time className="text-xs text-zinc-400">
            {new Date(article.published_at).toLocaleDateString(
              locale === "pl" ? "pl-PL" : "en-US",
            )}
          </time>
          <div className="flex flex-wrap justify-end gap-1.5">
            {article.tags.slice(0, 2).map((tag) => (
              <TagLink key={tag} tag={tag} locale={locale} />
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}
