export type Locale = "pl" | "en";

export type Category = "technology" | "gaming" | "ai" | "sport" | "finance";

/** Categories shown in nav and on the home page */
export const MAIN_CATEGORIES: Category[] = [
  "technology",
  "gaming",
  "ai",
  "sport",
  "finance",
];

/** Round-robin order for generation — understaffed categories first */
export const GENERATION_CATEGORIES: Category[] = [
  "ai",
  "sport",
  "finance",
  "gaming",
  "technology",
];

export type SourceType =
  | "reddit"
  | "rss"
  | "youtube"
  | "google_trends"
  | "hacker_news"
  | "lobsters";

export type RawItemStatus = "pending" | "processed" | "skipped" | "failed";

export type ArticleType =
  | "trend_item"
  | "daily_digest"
  | "weekly_digest"
  | "rising_falling";

export interface Source {
  id: string;
  type: SourceType;
  config: Record<string, string>;
  category: string;
  locale: string;
  enabled: boolean;
  fetch_interval_min: number;
}

export interface RawItem {
  id: string;
  source_id: string;
  external_id: string;
  title: string;
  description: string | null;
  url: string;
  engagement_score: number;
  published_at: string | null;
  fetched_at: string;
  content_hash: string;
  status: RawItemStatus;
  image_url: string | null;
}

export interface Article {
  id: string;
  slug: string;
  locale: string;
  category: string;
  article_type: ArticleType;
  seo_title: string;
  seo_description: string;
  headline: string;
  lead: string;
  summary: unknown;
  why_it_matters: string;
  tags: string[];
  source_item_ids: string[];
  published_at: string;
  updated_at: string;
  is_published: boolean;
  image_url: string | null;
}

export interface NormalizedItem {
  externalId: string;
  title: string;
  description: string;
  url: string;
  imageUrl?: string | null;
  engagementScore: number;
  publishedAt: Date | null;
  sourceLabel: string;
}

export const CATEGORY_SLUGS: Record<Locale, Record<Category, string>> = {
  pl: {
    technology: "technologia",
    gaming: "gry",
    ai: "ai",
    sport: "sport",
    finance: "finanse",
  },
  en: {
    technology: "technology",
    gaming: "gaming",
    ai: "ai",
    sport: "sport",
    finance: "finance",
  },
};

export const SLUG_TO_CATEGORY: Record<string, Category> = {
  technologia: "technology",
  technology: "technology",
  gry: "gaming",
  gaming: "gaming",
  ai: "ai",
  sport: "sport",
  finanse: "finance",
  finance: "finance",
};

export function categoryFromSlug(slug: string): Category | null {
  return SLUG_TO_CATEGORY[slug] ?? null;
}

export function categorySlug(locale: Locale, category: Category): string {
  return CATEGORY_SLUGS[locale][category];
}
