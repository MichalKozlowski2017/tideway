import { readFileSync } from "fs";
import { resolve } from "path";

for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  process.env[trimmed.slice(0, eq)] ??= trimmed.slice(eq + 1);
}

import { matchesLocale } from "../lib/ai/locale-check.ts";
import { getSql } from "../lib/db/client.ts";
import { recordArticleSlugRedirect } from "../lib/seo/article-redirect-store.ts";
import { resolveArticleRedirectSlug } from "../lib/seo/resolve-article-redirect.ts";

console.log("Tideway — pipeline maintenance…\n");

const sql = getSql();

const unpublished = (await sql.query(
  `SELECT id FROM articles WHERE is_published = false`,
)) as Array<{ id: string }>;

if (unpublished.length) {
  for (const row of unpublished) {
    const articleRows = (await sql.query(
      `SELECT slug FROM articles WHERE id = $1 LIMIT 1`,
      [row.id],
    )) as Array<{ slug: string }>;
    const article = articleRows[0];

    if (!article?.slug) continue;

    const target = await resolveArticleRedirectSlug("pl", article.slug, {
      skipStatic: true,
    });
    if (target?.kind === "article") {
      await recordArticleSlugRedirect("pl", article.slug, target.slug);
    }
  }

  const ids = unpublished.map((a) => a.id);
  await sql.query(`DELETE FROM articles WHERE id = ANY($1::uuid[])`, [ids]);
  console.log(`Usunięto ${ids.length} nieopublikowanych artykułów.`);
} else {
  console.log("Brak nieopublikowanych artykułów.");
}

const failed = (await sql.query(
  `SELECT r.id, r.title, s.locale
   FROM raw_items r
   LEFT JOIN sources s ON s.id = r.source_id
   WHERE r.status = 'failed'`,
)) as Array<{ id: string; title: string; locale: string | null }>;

const toSkip = failed.filter((row) => {
  const locale = row.locale ?? "pl";
  return locale === "pl" && !matchesLocale(row.title, "pl");
});

if (toSkip.length) {
  await sql.query(
    `UPDATE raw_items SET status = 'skipped' WHERE id = ANY($1::uuid[])`,
    [toSkip.map((r) => r.id)],
  );
  console.log(`Przeklasyfikowano ${toSkip.length} failed → skipped (źródła EN).`);
} else {
  console.log("Brak failed EN do przeklasyfikowania.");
}

const statuses = ["pending", "processed", "failed", "skipped"] as const;
const counts: Record<string, number> = {};

for (const status of statuses) {
  const rows = await sql.query(
    `SELECT count(*)::int AS count FROM raw_items WHERE status = $1`,
    [status],
  );
  counts[status] = (rows[0] as { count: number } | undefined)?.count ?? 0;
}

console.log("\nStan raw_items:", counts);
