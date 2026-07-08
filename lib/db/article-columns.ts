/** Full row — article pages only. */
export const ARTICLE_DETAIL_COLUMNS =
  "id, slug, locale, category, article_type, seo_title, seo_description, headline, lead, summary, why_it_matters, tags, source_item_ids, published_at, updated_at, is_published, image_url";

/** Listings, cards, related — format badge only (no body/highlights). */
export const ARTICLE_LIST_COLUMNS =
  "id, slug, locale, category, article_type, seo_title, seo_description, headline, lead, tags, source_item_ids, published_at, updated_at, is_published, image_url, summary->format";

/** RSS feed — minimal fields. */
export const ARTICLE_FEED_COLUMNS =
  "slug, headline, seo_description, lead, published_at, image_url";

/** Cron batch planning — skip heavy description until items are selected. */
export const RAW_ITEM_PLAN_COLUMNS =
  "id, title, url, engagement_score, fetched_at, status, source_id, image_url, content_hash, published_at";
