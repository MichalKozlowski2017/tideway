import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { ArticleView } from "@/components/article-view";
import { SiteHeader } from "@/components/site-header";
import { buildArticleMetadata } from "@/lib/seo/article-metadata";
import {
  articleRedirectPath,
  resolveArticleRedirectSlug,
} from "@/lib/seo/resolve-article-redirect";
import { articlePageJsonLd } from "@/lib/seo/json-ld";
import { resolveDigestItems } from "@/lib/digest/resolve";
import { getArticleBySlug, getRelatedArticles } from "@/lib/db/queries";
import { getSourceItemsForArticle } from "@/lib/sources/ingest";
import { articlePath } from "@/lib/i18n/config";
import { siteUrl } from "@/lib/site";

export const revalidate = 86400;

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
  if (!article) {
    const target = await resolveArticleRedirectSlug("pl", slug);
    if (target) permanentRedirect(articleRedirectPath("pl", target));
    notFound();
  }

  const [sources, related, digestItems] = await Promise.all([
    getSourceItemsForArticle(article.source_item_ids),
    getRelatedArticles(article),
    resolveDigestItems(article),
  ]);

  const url = `${siteUrl()}${articlePath("pl", slug)}`;
  const sourceUrls = sources.map((s) => s.url);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            articlePageJsonLd(article, url, "pl", { sourceUrls }),
          ),
        }}
      />
      <SiteHeader locale="pl" />
      <ArticleView
        article={article}
        locale="pl"
        sources={sources}
        related={related}
        digestItems={digestItems}
      />
    </>
  );
}
