import type { MetadataRoute } from "next";
import { getAllArticleSlugs } from "@/lib/db/queries";
import { articlePath, categoryPath, dailyDigestPath, weeklyDigestPath } from "@/lib/i18n/config";
import { categorySlug, type Category, type Locale } from "@/lib/types";
import { hasSupabaseConfig } from "@/lib/db/supabase";

const CATEGORIES: Category[] = ["technology", "gaming", "ai"];
const LOCALES: Locale[] = ["pl", "en"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://trendpulse.app";
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: "hourly", priority: 1 },
    { url: `${base}/en`, changeFrequency: "hourly", priority: 1 },
    { url: `${base}${dailyDigestPath("pl")}`, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}${weeklyDigestPath("pl")}`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}${dailyDigestPath("en")}`, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}${weeklyDigestPath("en")}`, changeFrequency: "weekly", priority: 0.8 },
  ];

  for (const locale of LOCALES) {
    for (const category of CATEGORIES) {
      staticRoutes.push({
        url: `${base}${categoryPath(locale, categorySlug(locale, category))}`,
        changeFrequency: "hourly",
        priority: 0.9,
      });
    }
  }

  if (!hasSupabaseConfig()) return staticRoutes;

  try {
    const slugs = await getAllArticleSlugs();
    const articleRoutes: MetadataRoute.Sitemap = slugs.map((item) => ({
      url: `${base}${articlePath(item.locale as Locale, item.slug)}`,
      lastModified: item.updated_at,
      changeFrequency: "daily",
      priority: 0.7,
    }));
    return [...staticRoutes, ...articleRoutes];
  } catch {
    return staticRoutes;
  }
}
