import { categoryPath } from "@/lib/i18n/config";
import { getSql, hasDatabaseConfig } from "@/lib/db/client";
import { getStoredArticleRedirectSlug } from "@/lib/seo/article-redirect-store";
import { ARTICLE_SLUG_REDIRECTS } from "@/lib/seo/article-redirects";
import { categorySlug, type Category, type Locale } from "@/lib/types";

export type ArticleRedirectTarget =
  | { kind: "article"; slug: string }
  | { kind: "category"; category: Category };

const NUMERIC_SUFFIX = /-\d+$/;

async function findPublishedSlug(
  locale: Locale,
  slug: string,
): Promise<string | null> {
  const sql = getSql();
  const rows = await sql.query(
    `SELECT slug FROM articles
     WHERE locale = $1 AND slug = $2 AND is_published = true
     LIMIT 1`,
    [locale, slug],
  );
  return (rows[0] as { slug: string } | undefined)?.slug ?? null;
}

/** When `foo` 404s but `foo-1` exists (ensureUniqueSlug), send users to the live URL. */
async function resolveNumericSuffixFallback(
  locale: Locale,
  slug: string,
): Promise<string | null> {
  if (NUMERIC_SUFFIX.test(slug)) return null;

  const sql = getSql();
  const rows = await sql.query(
    `SELECT slug FROM articles
     WHERE locale = $1 AND is_published = true AND slug LIKE $2
     ORDER BY published_at DESC
     LIMIT 1`,
    [locale, `${slug}-%`],
  );
  return (rows[0] as { slug: string } | undefined)?.slug ?? null;
}

export async function resolveArticleRedirectSlug(
  locale: Locale,
  slug: string,
  options?: { skipStatic?: boolean },
): Promise<ArticleRedirectTarget | null> {
  if (!options?.skipStatic) {
    const staticTarget = ARTICLE_SLUG_REDIRECTS[slug];
    if (staticTarget) {
      const live = await findPublishedSlug(locale, staticTarget);
      if (live) return { kind: "article", slug: live };
    }
  }

  const storedTarget = await getStoredArticleRedirectSlug(locale, slug);
  if (storedTarget) {
    const live = await findPublishedSlug(locale, storedTarget);
    if (live) return { kind: "article", slug: live };
  }

  if (!hasDatabaseConfig()) return null;

  const suffixTarget = await resolveNumericSuffixFallback(locale, slug);
  if (suffixTarget) {
    return { kind: "article", slug: suffixTarget };
  }

  const sql = getSql();
  const deadRows = await sql.query(
    `SELECT slug, category, source_item_ids FROM articles
     WHERE locale = $1 AND slug = $2 AND is_published = false
     LIMIT 1`,
    [locale, slug],
  );
  const dead = deadRows[0] as
    | { slug: string; category: string; source_item_ids: string[] }
    | undefined;

  if (!dead) return null;

  const sourceId = dead.source_item_ids?.[0];
  if (sourceId) {
    const published = await sql.query(
      `SELECT slug FROM articles
       WHERE locale = $1 AND is_published = true
         AND source_item_ids @> ARRAY[$2]::uuid[]
       ORDER BY published_at DESC
       LIMIT 1`,
      [locale, sourceId],
    );
    const publishedSlug = (published[0] as { slug: string } | undefined)?.slug;
    if (publishedSlug) {
      return { kind: "article", slug: publishedSlug };
    }
  }

  const category = dead.category as Category;
  if (category) {
    return { kind: "category", category };
  }

  return null;
}

export function articleRedirectPath(
  locale: Locale,
  target: ArticleRedirectTarget,
): string {
  if (target.kind === "article") {
    return locale === "pl"
      ? `/artykul/${target.slug}`
      : `/en/article/${target.slug}`;
  }
  return categoryPath(locale, categorySlug(locale, target.category));
}
