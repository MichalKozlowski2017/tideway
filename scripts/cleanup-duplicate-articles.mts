import { readFileSync } from "fs";
import { resolve } from "path";

for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split(
  "\n",
)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  process.env[trimmed.slice(0, eq)] ??= trimmed.slice(eq + 1);
}

import { getSql } from "../lib/db/client.ts";
import {
  normalizeSourceUrl,
  storyFingerprint,
  titleSimilarity,
} from "../lib/articles/dedup.ts";
import { recordArticleSlugRedirect } from "../lib/seo/article-redirect-store.ts";

type ArticleRow = {
  id: string;
  slug: string;
  headline: string;
  locale: string;
  category: string;
  published_at: string;
  source_item_ids: string[];
};

const SIMILAR_THRESHOLD = 0.38;
const LOOKBACK_MS = 72 * 60 * 60 * 1000;

function pickKeeper(articles: ArticleRow[]): ArticleRow {
  return [...articles].sort(
    (a, b) =>
      new Date(b.published_at).getTime() - new Date(a.published_at).getTime(),
  )[0];
}

async function main() {
  const sql = getSql();
  const since = new Date(Date.now() - LOOKBACK_MS).toISOString();
  const dryRun = process.argv.includes("--dry-run");

  const articles = (await sql.query(
    `SELECT id, slug, headline, locale, category, published_at, source_item_ids
     FROM articles
     WHERE is_published = true
       AND article_type = 'trend_item'
       AND published_at >= $1
     ORDER BY published_at DESC`,
    [since],
  )) as ArticleRow[];

  const rows = articles;
  const toUnpublish = new Set<string>();
  const reasons = new Map<string, string>();
  const redirectTargets = new Map<string, string>();

  const bySourceId = new Map<string, ArticleRow[]>();
  for (const article of rows) {
    for (const sourceId of article.source_item_ids ?? []) {
      const group = bySourceId.get(sourceId) ?? [];
      group.push(article);
      bySourceId.set(sourceId, group);
    }
  }

  for (const [sourceId, group] of bySourceId) {
    if (group.length < 2) continue;
    const unique = [...new Map(group.map((a) => [a.id, a])).values()];
    if (unique.length < 2) continue;
    const keeper = pickKeeper(unique);
    for (const article of unique) {
      if (article.id === keeper.id) continue;
      toUnpublish.add(article.id);
      redirectTargets.set(article.id, keeper.slug);
      reasons.set(
        article.id,
        `shared source_item ${sourceId.slice(0, 8)}… (keep /${keeper.slug})`,
      );
    }
  }

  const sourceIds = [...new Set(rows.flatMap((a) => a.source_item_ids ?? []))];
  const sourceMeta = new Map<string, { title: string; url: string }>();
  if (sourceIds.length) {
    const rawRows = (await sql.query(
      `SELECT id, title, url FROM raw_items WHERE id = ANY($1::uuid[])`,
      [sourceIds],
    )) as Array<{ id: string; title: string; url: string }>;
    for (const row of rawRows) {
      sourceMeta.set(row.id, { title: row.title, url: row.url });
    }
  }

  const byFingerprint = new Map<string, ArticleRow[]>();
  for (const article of rows) {
    if (toUnpublish.has(article.id)) continue;
    const sourceId = article.source_item_ids?.[0];
    const meta = sourceId ? sourceMeta.get(sourceId) : undefined;
    if (!meta) continue;
    const fp =
      storyFingerprint(meta.url) ?? `url:${normalizeSourceUrl(meta.url)}`;
    const group = byFingerprint.get(fp) ?? [];
    group.push(article);
    byFingerprint.set(fp, group);
  }

  for (const [fp, group] of byFingerprint) {
    if (group.length < 2) continue;
    const keeper = pickKeeper(group);
    for (const article of group) {
      if (article.id === keeper.id) continue;
      toUnpublish.add(article.id);
      redirectTargets.set(article.id, keeper.slug);
      reasons.set(article.id, `same story ${fp} (keep /${keeper.slug})`);
    }
  }

  for (let i = 0; i < rows.length; i += 1) {
    for (let j = i + 1; j < rows.length; j += 1) {
      const a = rows[i];
      const b = rows[j];
      if (a.locale !== b.locale || a.category !== b.category) continue;
      if (toUnpublish.has(a.id) || toUnpublish.has(b.id)) continue;

      const aSourceId = a.source_item_ids?.[0];
      const bSourceId = b.source_item_ids?.[0];
      if (!aSourceId || !bSourceId || aSourceId === bSourceId) continue;

      const aSource = sourceMeta.get(aSourceId)?.title;
      const bSource = sourceMeta.get(bSourceId)?.title;
      if (!aSource || !bSource) continue;

      if (titleSimilarity(aSource, bSource) < SIMILAR_THRESHOLD) continue;

      const keeper = pickKeeper([a, b]);
      const drop = keeper.id === a.id ? b : a;
      toUnpublish.add(drop.id);
      redirectTargets.set(drop.id, keeper.slug);
      reasons.set(
        drop.id,
        `similar source story (keep /${keeper.slug})`,
      );
    }
  }

  const victims = rows.filter((a) => toUnpublish.has(a.id));
  console.log(
    `Found ${victims.length} duplicate article(s) to unpublish${dryRun ? " [dry-run]" : ""}:\n`,
  );
  for (const article of victims) {
    console.log(`  - /${article.slug}`);
    console.log(`    ${reasons.get(article.id)}`);
  }

  if (!victims.length) {
    console.log("Nothing to clean up.");
    return;
  }

  if (dryRun) return;

  for (const article of victims) {
    const keeperSlug = redirectTargets.get(article.id);
    if (keeperSlug) {
      await recordArticleSlugRedirect("pl", article.slug, keeperSlug);
    }
  }

  const ids = victims.map((a) => a.id);
  await sql.query(
    `UPDATE articles SET is_published = false WHERE id = ANY($1::uuid[])`,
    [ids],
  );
  console.log(`\nUnpublished ${ids.length} duplicate article(s).`);
  console.log(
    "Run: npx tsx scripts/audit-article-404s.mts --write  (refresh 301 redirects)",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
