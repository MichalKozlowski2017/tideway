import type { MetadataRoute } from "next";
import { getAllArticleSlugs, getDistinctTags } from "@/lib/db/queries";
import {
  articlePath,
  categoryPath,
  dailyDigestPath,
  weeklyDigestPath,
  tagPath,
  aboutPath,
  privacyPath,
  activeLocales,
} from "@/lib/i18n/config";
import { categorySlug, MAIN_CATEGORIES, type Locale } from "@/lib/types";
import { hasDatabaseConfig } from "@/lib/db/client";
import { RSS_FEED_PATH, siteUrl } from "@/lib/site";

const CATEGORIES = MAIN_CATEGORIES;
const LOCALES = activeLocales;
/** Tags need several articles before they earn a sitemap slot. */
const TAG_SITEMAP_MIN_COUNT = 5;

/** Regenerate sitemap from DB every 4h (cuts Neon wake-ups). */
export const revalidate = 14400;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}${dailyDigestPath("pl")}`, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}${weeklyDigestPath("pl")}`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}${aboutPath("pl")}`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${base}${privacyPath("pl")}`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${base}${RSS_FEED_PATH}`, changeFrequency: "daily", priority: 0.5 },
  ];

  for (const locale of LOCALES) {
    for (const category of CATEGORIES) {
      staticRoutes.push({
        url: `${base}${categoryPath(locale, categorySlug(locale, category))}`,
        changeFrequency: "daily",
        priority: 0.9,
      });
    }
  }

  if (!hasDatabaseConfig()) return staticRoutes;

  try {
    const slugs = (await getAllArticleSlugs()).filter((item) =>
      LOCALES.includes(item.locale as Locale),
    );
    const articleRoutes: MetadataRoute.Sitemap = slugs.map((item) => ({
      url: `${base}${articlePath(item.locale as Locale, item.slug)}`,
      lastModified: item.updated_at,
      changeFrequency: "daily",
      priority: 0.7,
    }));

    const tagRoutes: MetadataRoute.Sitemap = [];
    for (const locale of LOCALES) {
      const tags = await getDistinctTags(locale, { minCount: TAG_SITEMAP_MIN_COUNT });
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
