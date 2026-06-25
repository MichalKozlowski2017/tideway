import type { Article, Category, Locale } from "@/lib/types";
import { categorySlug } from "@/lib/types";
import {
  categoryNavLabel,
  categoryPath,
} from "@/lib/i18n/config";
import { PUBLISHER_LOGO_URL, SITE_NAME, siteUrl } from "@/lib/site";

export type BreadcrumbItem = { name: string; url: string };

export function breadcrumbJsonLd(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function articleJsonLd(
  article: Article,
  url: string,
  options?: { sourceUrls?: string[] },
) {
  const image = article.image_url
    ? {
        "@type": "ImageObject",
        url: article.image_url,
      }
    : undefined;

  const category = article.category as Category;
  const isBasedOn = options?.sourceUrls?.length
    ? options.sourceUrls.map((sourceUrl) => ({
        "@type": "CreativeWork",
        url: sourceUrl,
      }))
    : undefined;

  return {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.headline,
    description: article.seo_description,
    articleSection: category,
    datePublished: article.published_at,
    dateModified: article.updated_at,
    keywords: article.tags.join(", "),
    url,
    image,
    isBasedOn,
    author: {
      "@type": "Organization",
      name: SITE_NAME,
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: {
        "@type": "ImageObject",
        url: PUBLISHER_LOGO_URL,
        width: 512,
        height: 512,
      },
    },
  };
}

export function articlePageJsonLd(
  article: Article,
  url: string,
  locale: Locale,
  options?: { sourceUrls?: string[] },
) {
  const category = article.category as Category;
  const home = siteUrl();

  return {
    "@context": "https://schema.org",
    "@graph": [
      articleJsonLd(article, url, options),
      breadcrumbJsonLd([
        { name: SITE_NAME, url: home },
        {
          name: categoryNavLabel(locale, category),
          url: `${home}${categoryPath(locale, categorySlug(locale, category))}`,
        },
        { name: article.headline, url },
      ]),
    ],
  };
}

export function itemListJsonLd(
  name: string,
  items: Array<{ name: string; url: string }>,
) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      url: item.url,
    })),
  };
}
