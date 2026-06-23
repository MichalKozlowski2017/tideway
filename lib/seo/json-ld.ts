import type { Article } from "@/lib/types";
import { PUBLISHER_LOGO_URL, SITE_NAME } from "@/lib/site";

export function articleJsonLd(article: Article, url: string) {
  const image = article.image_url
    ? {
        "@type": "ImageObject",
        url: article.image_url,
      }
    : undefined;

  return {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.headline,
    description: article.seo_description,
    datePublished: article.published_at,
    dateModified: article.updated_at,
    keywords: article.tags.join(", "),
    url,
    image,
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
