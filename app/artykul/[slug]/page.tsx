import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleView } from "@/components/article-view";
import { SiteHeader } from "@/components/site-header";
import { buildArticleMetadata } from "@/lib/seo/article-metadata";
import { articleJsonLd } from "@/lib/seo/json-ld";
import { getArticleBySlug, getRelatedArticles } from "@/lib/db/queries";
import { getSourceItemsForArticle } from "@/lib/sources/ingest";
import { articlePath } from "@/lib/i18n/config";
import { siteUrl } from "@/lib/site";

export const revalidate = 3600;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticleBySlug("pl", slug);
  if (!article) return {};
  return buildArticleMetadata(article, "pl");
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = await getArticleBySlug("pl", slug);
  if (!article) notFound();

  const [sources, related] = await Promise.all([
    getSourceItemsForArticle(article.source_item_ids),
    getRelatedArticles(article),
  ]);

  const url = `${siteUrl()}${articlePath("pl", slug)}`;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(articleJsonLd(article, url)),
        }}
      />
      <SiteHeader locale="pl" />
      <ArticleView
        article={article}
        locale="pl"
        sources={sources}
        related={related}
      />
    </>
  );
}
