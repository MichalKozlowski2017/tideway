import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleView } from "@/components/article-view";
import { SiteHeader } from "@/components/site-header";
import { buildArticleMetadata } from "@/lib/seo/article-metadata";
import { articlePageJsonLd } from "@/lib/seo/json-ld";
import { resolveDigestItems } from "@/lib/digest/resolve";
import { getArticleBySlug, getRelatedArticles } from "@/lib/db/queries";
import { getSourceItemsForArticle } from "@/lib/sources/ingest";
import { articlePath } from "@/lib/i18n/config";
import { siteUrl } from "@/lib/site";

export const revalidate = 3600;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticleBySlug("en", slug);
  if (!article) return {};
  return buildArticleMetadata(article, "en");
}

export default async function EnArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = await getArticleBySlug("en", slug);
  if (!article) notFound();

  const [sources, related, digestItems] = await Promise.all([
    getSourceItemsForArticle(article.source_item_ids),
    getRelatedArticles(article),
    resolveDigestItems(article),
  ]);

  const url = `${siteUrl()}${articlePath("en", slug)}`;
  const sourceUrls = sources.map((s) => s.url);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            articlePageJsonLd(article, url, "en", { sourceUrls }),
          ),
        }}
      />
      <SiteHeader locale="en" />
      <ArticleView
        article={article}
        locale="en"
        sources={sources}
        related={related}
        digestItems={digestItems}
      />
    </>
  );
}
