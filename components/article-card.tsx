import Link from "next/link";
import type { Article, Locale } from "@/lib/types";
import { articlePath } from "@/lib/i18n/config";

export function ArticleCard({
  article,
  locale,
}: {
  article: Article;
  locale: Locale;
}) {
  return (
    <article className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-zinc-300">
      <time className="text-xs text-zinc-500">
        {new Date(article.published_at).toLocaleDateString(
          locale === "pl" ? "pl-PL" : "en-US",
        )}
      </time>
      <h2 className="mt-2 text-lg font-semibold text-zinc-900">
        <Link href={articlePath(locale, article.slug)} className="hover:underline">
          {article.headline}
        </Link>
      </h2>
      <p className="mt-2 line-clamp-2 text-sm text-zinc-600">{article.lead}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {article.tags.slice(0, 3).map((tag) => (
          <span
            key={tag}
            className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600"
          >
            {tag}
          </span>
        ))}
      </div>
    </article>
  );
}
