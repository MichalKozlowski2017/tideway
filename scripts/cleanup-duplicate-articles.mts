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

import { getSupabaseAdmin } from "../lib/db/supabase.ts";
import {
  normalizeSourceUrl,
  storyFingerprint,
  titleSimilarity,
} from "../lib/articles/dedup.ts";

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
  const supabase = getSupabaseAdmin();
  const since = new Date(Date.now() - LOOKBACK_MS).toISOString();
  const dryRun = process.argv.includes("--dry-run");

  const { data: articles, error } = await supabase
    .from("articles")
    .select("id, slug, headline, locale, category, published_at, source_item_ids")
    .eq("is_published", true)
    .eq("article_type", "trend_item")
    .gte("published_at", since)
    .order("published_at", { ascending: false });

  if (error) throw error;

  const rows = (articles ?? []) as ArticleRow[];
  const toUnpublish = new Set<string>();
  const reasons = new Map<string, string>();

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
      reasons.set(
        article.id,
        `shared source_item ${sourceId.slice(0, 8)}… (keep /${keeper.slug})`,
      );
    }
  }

  const sourceIds = [...new Set(rows.flatMap((a) => a.source_item_ids ?? []))];
  const sourceMeta = new Map<string, { title: string; url: string }>();
  if (sourceIds.length) {
    const { data: rawRows } = await supabase
      .from("raw_items")
      .select("id, title, url")
      .in("id", sourceIds);
    for (const row of rawRows ?? []) {
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
      reasons.set(article.id, `same story ${fp} (keep /${keeper.slug})`);
    }
  }

  for (let i = 0; i < rows.length; i += 1) {
    for (let j = i + 1; j < rows.length; j += 1) {
      const a = rows[i];
      const b = rows[j];
      if (a.locale !== b.locale || a.category !== b.category) continue;
      if (toUnpublish.has(a.id) || toUnpublish.has(b.id)) continue;

      const aSource = a.source_item_ids?.[0]
        ? sourceMeta.get(a.source_item_ids[0])?.title
        : undefined;
      const bSource = b.source_item_ids?.[0]
        ? sourceMeta.get(b.source_item_ids[0])?.title
        : undefined;

      const texts = [
        [a.headline, b.headline],
        [a.headline, bSource ?? ""],
        [aSource ?? "", b.headline],
        [aSource ?? "", bSource ?? ""],
      ];

      const similar = texts.some(
        ([left, right]) =>
          left && right && titleSimilarity(left, right) >= SIMILAR_THRESHOLD,
      );
      if (!similar) continue;

      const keeper = pickKeeper([a, b]);
      const drop = keeper.id === a.id ? b : a;
      toUnpublish.add(drop.id);
      reasons.set(
        drop.id,
        `similar title to /${keeper.slug} (${drop.headline.slice(0, 48)}…)`,
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

  const ids = victims.map((a) => a.id);
  const { error: updateError } = await supabase
    .from("articles")
    .update({ is_published: false })
    .in("id", ids);

  if (updateError) throw updateError;
  console.log(`\nUnpublished ${ids.length} duplicate article(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
