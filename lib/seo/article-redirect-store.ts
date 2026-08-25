import { getSql, hasDatabaseConfig } from "@/lib/db/client";
import type { Locale } from "@/lib/types";

export async function recordArticleSlugRedirect(
  locale: Locale,
  fromSlug: string,
  toSlug: string,
): Promise<void> {
  if (!hasDatabaseConfig() || fromSlug === toSlug) return;

  const sql = getSql();
  await sql.query(
    `INSERT INTO article_slug_redirects (locale, from_slug, to_slug)
     VALUES ($1, $2, $3)
     ON CONFLICT (locale, from_slug)
     DO UPDATE SET to_slug = EXCLUDED.to_slug`,
    [locale, fromSlug, toSlug],
  );
}

export async function getStoredArticleRedirectSlug(
  locale: Locale,
  slug: string,
): Promise<string | null> {
  if (!hasDatabaseConfig()) return null;

  const sql = getSql();
  const rows = await sql.query(
    `SELECT to_slug FROM article_slug_redirects
     WHERE locale = $1 AND from_slug = $2
     LIMIT 1`,
    [locale, slug],
  );
  return (rows[0] as { to_slug: string } | undefined)?.to_slug ?? null;
}
