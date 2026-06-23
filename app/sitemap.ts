import type { MetadataRoute } from "next";
import { getAllArticleSlugs, getDistinctTags } from "@/lib/db/queries";
import { articlePath, categoryPath, dailyDigestPath, weeklyDigestPath, tagPath, aboutPath, privacyPath, activeLocales } from "@/lib/i18n/config";
import { categorySlug, MAIN_CATEGORIES, type Locale } from "@/lib/types";
import { hasSupabaseConfig } from "@/lib/db/supabase";
import { siteUrl } from "@/lib/site";

const CATEGORIES = MAIN_CATEGORIES;
const LOCALES = activeLocales;

/** Regenerate sitemap from DB every 5 min (matches homepage / category pages). */
export const revalidate = 300;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: "hourly", priority: 1 },
    { url: `${base}${dailyDigestPath("pl")}`, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}${weeklyDigestPath("pl")}`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}${aboutPath("pl")}`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${base}${privacyPath("pl")}`, changeFrequency: "monthly", priority: 0.3 },
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

    const tagRoutes: MetadataRoute.Sitemap = [];
    for (const locale of LOCALES) {
      const tags = await getDistinctTags(locale);
      for (const tag of tags) {
        tagRoutes.push({
          url: `${base}${tagPath(locale as Locale, tag.slug)}`,
          changeFrequency: "daily",
          priority: 0.6,
        });
      }
    }

    return [...staticRoutes, ...articleRoutes, ...tagRoutes];
  } catch {
    return staticRoutes;
  }
}
