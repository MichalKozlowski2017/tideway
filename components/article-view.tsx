import type { Article, Locale } from "@/lib/types";
import { ui } from "@/lib/i18n/config";
import { ArticleCard } from "@/components/article-card";

export function AdSlot() {
  return (
    <div
      className="my-6 flex h-24 items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-zinc-50 text-sm text-zinc-400"
      aria-hidden
    >
      Ad slot
    </div>
  );
}

export function ArticleView({
  article,
  locale,
  sources,
  related,
}: {
  article: Article;
  locale: Locale;
  sources: Array<{ title: string; url: string }>;
  related: Article[];
}) {
  const t = ui[locale];

  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <time className="text-sm text-zinc-500">
        {new Date(article.published_at).toLocaleString(
          locale === "pl" ? "pl-PL" : "en-US",
        )}
      </time>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-zinc-900">
        {article.headline}
      </h1>
      <p className="mt-4 text-lg leading-relaxed text-zinc-700">{article.lead}</p>

      <AdSlot />

      <section className="mt-8">
        <h2 className="text-xl font-semibold text-zinc-900">{t.keyPoints}</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-zinc-700">
          {article.summary.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold text-zinc-900">{t.whyItMatters}</h2>
        <p className="mt-3 text-zinc-700">{article.why_it_matters}</p>
      </section>

      {sources.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xl font-semibold text-zinc-900">{t.sources}</h2>
          <ul className="mt-3 space-y-2">
            {sources.map((source) => (
              <li key={source.url}>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  {source.title}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-sm font-medium text-zinc-500">{t.tags}</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {article.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-zinc-100 px-3 py-1 text-sm text-zinc-600"
            >
              {tag}
            </span>
          ))}
        </div>
      </section>

      {related.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xl font-semibold text-zinc-900">{t.related}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {related.map((item) => (
              <ArticleCard key={item.id} article={item} locale={locale} />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
