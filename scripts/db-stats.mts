import { readFileSync } from "fs";
import { resolve } from "path";

for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  process.env[trimmed.slice(0, eq)] ??= trimmed.slice(eq + 1);
}

import { getSql } from "../lib/db/client.ts";

const sql = getSql();

async function count(
  table: string,
  filter: Record<string, string | boolean> = {},
): Promise<number> {
  const entries = Object.entries(filter);
  const where =
    entries.length === 0
      ? ""
      : ` WHERE ${entries.map(([k], i) => `${k} = $${i + 1}`).join(" AND ")}`;
  const rows = await sql.query(
    `SELECT count(*)::int AS count FROM ${table}${where}`,
    entries.map(([, v]) => v),
  );
  return (rows[0] as { count: number } | undefined)?.count ?? 0;
}

const categories = ["ai", "gaming", "sport", "finance", "it", "tech"] as const;
const articleTypes = ["trend_item", "daily_digest", "weekly_digest", "rising_falling"] as const;

const articlesPublished = await count("articles", { is_published: true });
const articlesTotal = await count("articles");
const pending = await count("raw_items", { status: "pending" });
const processed = await count("raw_items", { status: "processed" });
const failed = await count("raw_items", { status: "failed" });
const skipped = await count("raw_items", { status: "skipped" });
const processing = await count("raw_items", { status: "processing" });
const redirects = await count("article_slug_redirects");

const byCategory: Record<string, number> = {};
for (const c of categories) {
  byCategory[c] = await count("articles", { is_published: true, category: c });
}

const byType: Record<string, number> = {};
for (const t of articleTypes) {
  byType[t] = await count("articles", { is_published: true, article_type: t });
}

const first = (await sql.query(
  `SELECT published_at FROM articles
   WHERE is_published = true
   ORDER BY published_at ASC
   LIMIT 1`,
)) as Array<{ published_at: string }>;
const latest = (await sql.query(
  `SELECT published_at FROM articles
   WHERE is_published = true
   ORDER BY published_at DESC
   LIMIT 1`,
)) as Array<{ published_at: string }>;

const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
const articlesLast7dRows = await sql.query(
  `SELECT count(*)::int AS count FROM articles
   WHERE is_published = true AND published_at >= $1`,
  [weekAgo],
);
const articlesLast7d =
  (articlesLast7dRows[0] as { count: number } | undefined)?.count ?? 0;

const withImageRows = await sql.query(
  `SELECT count(*)::int AS count FROM articles
   WHERE is_published = true AND image_url IS NOT NULL`,
);
const withImage =
  (withImageRows[0] as { count: number } | undefined)?.count ?? 0;

const sources = (await sql.query(
  `SELECT type, enabled FROM sources`,
)) as Array<{ type: string; enabled: boolean }>;
const srcByType: Record<string, number> = {};
let srcEnabled = 0;
for (const s of sources) {
  srcByType[s.type] = (srcByType[s.type] ?? 0) + 1;
  if (s.enabled) srcEnabled += 1;
}

const rollups = await count("daily_rollups");

const recentArts = (await sql.query(
  `SELECT published_at FROM articles
   WHERE is_published = true AND published_at >= $1`,
  [weekAgo],
)) as Array<{ published_at: string }>;
const dailyArts: Record<string, number> = {};
for (const a of recentArts) {
  const d = a.published_at.slice(0, 10);
  dailyArts[d] = (dailyArts[d] ?? 0) + 1;
}

console.log(
  JSON.stringify(
    {
      asOf: new Date().toISOString().slice(0, 10),
      articles: {
        total: articlesTotal,
        published: articlesPublished,
        unpublished: articlesTotal - articlesPublished,
        withImage,
        last7d: articlesLast7d,
        first: first[0]?.published_at?.slice(0, 10),
        latest: latest[0]?.published_at?.slice(0, 10),
        byCategory,
        byType,
        dailyLast7d: dailyArts,
      },
      raw_items: {
        total: pending + processed + failed + skipped + processing,
        pending,
        processed,
        failed,
        skipped,
        processing,
      },
      article_slug_redirects: redirects,
      sources: { total: sources.length, enabled: srcEnabled, byType: srcByType },
      rollups,
    },
    null,
    2,
  ),
);
