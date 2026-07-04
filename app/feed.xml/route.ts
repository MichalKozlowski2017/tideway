import { getArticlesForFeed } from "@/lib/db/queries";
import { buildRssFeed } from "@/lib/seo/rss";

export const revalidate = 3600;

export async function GET() {
  const articles = await getArticlesForFeed({ locale: "pl", limit: 50 });
  const xml = buildRssFeed(articles, "pl");

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200",
    },
  });
}
