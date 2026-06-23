import { articlePath } from "@/lib/i18n/config";
import { CONTACT_EMAIL, SITE_NAME, siteUrl } from "@/lib/site";
import type { Article } from "@/lib/types";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toRfc822(date: string): string {
  return new Date(date).toUTCString();
}

export function buildRssFeed(articles: Article[], locale: "pl" | "en" = "pl"): string {
  const base = siteUrl();
  const feedUrl = `${base}/feed.xml`;
  const description =
    locale === "pl"
      ? "Co dziś grzeje w sieci — tech, gry, sport, finanse i AI."
      : "What's buzzing online today — tech, games, sports, finance, and AI.";

  const items = articles
    .map((article) => {
      const link = `${base}${articlePath(locale, article.slug)}`;
      const descriptionHtml = escapeXml(article.seo_description || article.lead);
      const enclosure = article.image_url
        ? `\n      <enclosure url="${escapeXml(article.image_url)}" type="image/jpeg" />`
        : "";

      return `    <item>
      <title>${escapeXml(article.headline)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(link)}</guid>
      <pubDate>${toRfc822(article.published_at)}</pubDate>
      <description>${descriptionHtml}</description>${enclosure}
    </item>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(SITE_NAME)}</title>
    <link>${escapeXml(base)}</link>
    <description>${escapeXml(description)}</description>
    <language>${locale === "pl" ? "pl-PL" : "en-US"}</language>
    <lastBuildDate>${toRfc822(new Date().toISOString())}</lastBuildDate>
    <managingEditor>${escapeXml(CONTACT_EMAIL)} (${escapeXml(SITE_NAME)})</managingEditor>
    <webMaster>${escapeXml(CONTACT_EMAIL)} (${escapeXml(SITE_NAME)})</webMaster>
    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;
}
