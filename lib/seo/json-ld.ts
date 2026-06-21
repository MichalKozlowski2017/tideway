import type { Article } from "@/lib/types";

export function articleJsonLd(article: Article, url: string) {
  return {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.headline,
    description: article.seo_description,
    datePublished: article.published_at,
    dateModified: article.updated_at,
    keywords: article.tags.join(", "),
    url,
    author: {
      "@type": "Organization",
      name: "TrendPulse",
    },
    publisher: {
      "@type": "Organization",
      name: "TrendPulse",
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
