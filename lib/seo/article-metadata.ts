import type { Metadata } from "next";
import type { Article, Locale } from "@/lib/types";
import { articlePath } from "@/lib/i18n/config";
import { SITE_NAME, siteUrl } from "@/lib/site";

export function buildArticleMetadata(
  article: Article,
  locale: Locale,
): Metadata {
  const path = articlePath(locale, article.slug);
  const url = `${siteUrl()}${path}`;
  const images = article.image_url
    ? [{ url: article.image_url, width: 1200, height: 630, alt: article.headline }]
    : undefined;

  return {
    title: article.seo_title,
    description: article.seo_description,
    keywords: article.tags,
    alternates: {
      canonical: url,
    },
    openGraph: {
      type: "article",
      locale: locale === "pl" ? "pl_PL" : "en_US",
      url,
      title: article.headline,
      description: article.seo_description,
      siteName: SITE_NAME,
      publishedTime: article.published_at,
      modifiedTime: article.updated_at,
      tags: article.tags,
      images,
    },
    twitter: {
      card: images ? "summary_large_image" : "summary",
      title: article.headline,
      description: article.seo_description,
      images: article.image_url ? [article.image_url] : undefined,
    },
  };
}
