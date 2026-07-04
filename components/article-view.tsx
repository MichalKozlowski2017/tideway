import type { Article, Locale } from "@/lib/types";
import type { DigestItem } from "@/lib/digest/items";
import { isLongReadFormat, parseArticleBody } from "@/lib/ai/article-body";
import { ArticleBodyContent } from "@/components/article-body-content";
import { estimateReadTimeMinutes, formatReadTime } from "@/lib/ai/read-time";
import Link from "next/link";
import { articlePath, ui } from "@/lib/i18n/config";
import { ArticleCard } from "@/components/article-card";
import { ArticleImage } from "@/components/article-image";
import { ArticleShare } from "@/components/article-share";
import { QuizPlayer } from "@/components/quiz-player";
import { TagLink } from "@/components/tag-link";
import { getQuizStats } from "@/lib/quiz/stats";
import { siteUrl } from "@/lib/site";

const FORMAT_LABELS: Record<string, { pl: string; en: string }> = {
  story: { pl: "Reportaż", en: "Story" },
  brief: { pl: "Skrót", en: "Brief" },
  community: { pl: "Dyskusja", en: "Community" },
  analysis: { pl: "Analiza", en: "Analysis" },
  essay: { pl: "Esej", en: "Essay" },
  synthesis: { pl: "Synteza", en: "Synthesis" },
  guide: { pl: "Poradnik", en: "Guide" },
  explainer: { pl: "Wyjaśnienie", en: "Explainer" },
  quiz: { pl: "Quiz", en: "Quiz" },
  list: { pl: "Ranking", en: "List" },
};

export async function ArticleView({
  article,
  locale,
  sources,
  related,
  digestItems = [],
}: {
  article: Article;
  locale: Locale;
  sources: Array<{ title: string; url: string }>;
  related: Article[];
  digestItems?: DigestItem[];
}) {
  const t = ui[locale];
  const content = parseArticleBody(article.summary);
  const isDigest =
    article.article_type === "daily_digest" ||
    article.article_type === "weekly_digest";
  const formatLabel = isDigest
    ? locale === "pl"
      ? "Przegląd"
      : "Digest"
    : (FORMAT_LABELS[content.format]?.[locale] ?? content.format);
  const highlightsTitle =
    content.sectionTitles?.highlights ?? t.keyPoints;
  const impactTitle =
    content.sectionTitles?.impact ?? t.whyItMatters;
  const shareUrl = `${siteUrl()}${articlePath(locale, article.slug)}`;
  const longRead = isLongReadFormat(content.format) && !content.quiz;
  const quizStats =
    content.quiz && content.format === "quiz"
      ? await getQuizStats(article.id)
      : null;
  const readTimeText = formatReadTime(
    estimateReadTimeMinutes(
      [
        article.lead,
        content.body ?? "",
        isDigest ? "" : article.why_it_matters,
      ].join(" "),
      locale,
    ),
    locale,
  );

  return (
    <article
      className={`mx-auto px-4 py-12 ${longRead ? "max-w-2xl" : "max-w-3xl"}`}
    >
      <ArticleImage
        imageUrl={article.image_url}
        category={article.category}
        alt={article.headline}
        variant="hero"
        priority
      />

      <header className="mt-10 border-b border-zinc-200/80 pb-10">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <time
            className="text-zinc-400"
            dateTime={article.published_at}
          >
            {new Date(article.published_at).toLocaleString(
              locale === "pl" ? "pl-PL" : "en-US",
            )}
          </time>
          <span aria-hidden className="text-zinc-300">
            ·
          </span>
          <span className="text-zinc-400">{readTimeText}</span>
          <span aria-hidden className="text-zinc-300">
            ·
          </span>
          <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide text-zinc-500">
            {formatLabel}
          </span>
          <span className="rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-700 ring-1 ring-violet-200">
            {t.aiDisclosure}
          </span>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">
          {locale === "pl"
            ? "Treść wygenerowana automatycznie na podstawie publicznych źródeł. Sprawdź oryginał w sekcji poniżej."
            : "Automatically generated from public sources. See the original link below."}
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-900 md:text-[2.5rem] md:leading-tight">
          {article.headline}
        </h1>
        <p className="mt-5 text-xl leading-relaxed text-zinc-500">
          {article.lead}
        </p>
        <ArticleShare
          url={shareUrl}
          title={article.headline}
          locale={locale}
        />
      </header>

      {content.format === "community" && content.contextNote && (
        <aside className="mt-8 rounded-2xl border border-amber-200 bg-amber-50/80 px-5 py-4 text-zinc-800">
          <p className="text-sm font-medium text-amber-900">
            {locale === "pl" ? "Kontekst dyskusji" : "Discussion context"}
          </p>
          <p className="mt-2 leading-relaxed">{content.contextNote}</p>
        </aside>
      )}

      {content.quiz && content.format === "quiz" ? (
        <QuizPlayer
          articleId={article.id}
          locale={locale}
          questions={content.quiz}
          initialStats={quizStats}
        />
      ) : (
        content.body && (
          <section className="mt-10">
            <ArticleBodyContent body={content.body} longRead={longRead} />
          </section>
        )
      )}

      {digestItems.length > 0 && (
        <section className="mt-10 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-zinc-950/5">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-900">
            {t.digestKeyPoints}
          </h2>
          <ul className="mt-4 space-y-3">
            {digestItems.map((item) => (
              <li
                key={`${item.slug ?? "plain"}-${item.text.slice(0, 48)}`}
                className="flex gap-3 leading-relaxed before:font-bold before:text-blue-500 before:content-['→']"
              >
                {item.slug ? (
                  <Link
                    href={articlePath(locale, item.slug)}
                    className="text-zinc-700 transition hover:text-blue-700"
                  >
                    {item.text}
                  </Link>
                ) : (
                  <span className="text-zinc-700">{item.text}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {!isDigest &&
        content.highlights &&
        content.highlights.length > 0 &&
        content.format !== "quiz" && (
        <section className="mt-10 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-zinc-950/5">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-900">
            {highlightsTitle}
          </h2>
          {content.format === "brief" || content.format === "list" ? (
            <ol className="mt-4 list-decimal space-y-3 pl-5 text-zinc-700">
              {content.highlights.map((point) => (
                <li key={point} className="pl-1 leading-relaxed">
                  {point}
                </li>
              ))}
            </ol>
          ) : (
            <ul className="mt-4 space-y-3">
              {content.highlights.map((point) => (
                <li
                  key={point}
                  className="flex gap-3 leading-relaxed text-zinc-700 before:font-bold before:text-blue-500 before:content-['→']"
                >
                  {point}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {!isDigest && (
        <section
          className={
            longRead
              ? "mt-10 rounded-2xl bg-blue-50/60 px-6 py-6 ring-1 ring-blue-100"
              : content.format === "analysis"
                ? "mt-8 rounded-2xl bg-blue-50/60 px-6 py-6 ring-1 ring-blue-100"
                : "mt-10"
          }
        >
          <h2 className="text-lg font-semibold tracking-tight text-zinc-900">
            {impactTitle}
          </h2>
          <p className="mt-3 leading-relaxed text-zinc-700">
            {article.why_it_matters}
          </p>
        </section>
      )}

      {sources.length > 0 && (
        <footer className="mt-12 border-t border-zinc-200/80 pt-10">
          <h2 className="text-xs font-medium uppercase tracking-widest text-zinc-400">
            {t.sources}
          </h2>
          <ul className="mt-4 space-y-2">
            {sources.map((source) => (
              <li key={source.url}>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 transition hover:text-blue-800"
                >
                  {source.title}
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-wrap gap-2">
            {article.tags.map((tag) => (
              <TagLink
                key={tag}
                tag={tag}
                locale={locale}
                className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-sm text-zinc-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
              />
            ))}
          </div>
        </footer>
      )}

      {related.length > 0 && (
        <section className="mt-16 border-t border-zinc-200/80 pt-12">
          <h2 className="text-xl font-semibold tracking-tight text-zinc-900">
            {t.related}
          </h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            {related.map((item) => (
              <ArticleCard key={item.id} article={item} locale={locale} />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
