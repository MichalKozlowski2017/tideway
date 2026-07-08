import { readFileSync } from "fs";
import { resolve } from "path";

for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  process.env[trimmed.slice(0, eq)] ??= trimmed.slice(eq + 1);
}

import { getSupabaseAdmin } from "../lib/db/supabase.ts";

const sb = getSupabaseAdmin();

async function count(
  table: string,
  filter: Record<string, string | boolean> = {},
): Promise<number> {
  let q = sb.from(table).select("*", { count: "exact", head: true });
  for (const [k, v] of Object.entries(filter)) q = q.eq(k, v);
  const { count: n, error } = await q;
  if (error) throw error;
  return n ?? 0;
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

const { data: first } = await sb
  .from("articles")
  .select("published_at")
  .eq("is_published", true)
  .order("published_at", { ascending: true })
  .limit(1);
const { data: latest } = await sb
  .from("articles")
  .select("published_at")
  .eq("is_published", true)
  .order("published_at", { ascending: false })
  .limit(1);

const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
const articlesWeek = await count("articles", { is_published: true });
const { count: articlesLast7d } = await sb
  .from("articles")
  .select("*", { count: "exact", head: true })
  .eq("is_published", true)
  .gte("published_at", weekAgo);

const withImage = await sb
  .from("articles")
  .select("*", { count: "exact", head: true })
  .eq("is_published", true)
  .not("image_url", "is", null);

const { data: sources } = await sb.from("sources").select("type, enabled");
const srcByType: Record<string, number> = {};
let srcEnabled = 0;
for (const s of sources ?? []) {
  srcByType[s.type] = (srcByType[s.type] ?? 0) + 1;
  if (s.enabled) srcEnabled += 1;
}

const rollups = await count("daily_rollups");

const { data: recentArts } = await sb
  .from("articles")
  .select("published_at")
  .eq("is_published", true)
  .gte("published_at", weekAgo);
const dailyArts: Record<string, number> = {};
for (const a of recentArts ?? []) {
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
        withImage: withImage.count ?? 0,
        last7d: articlesLast7d ?? 0,
        first: first?.[0]?.published_at?.slice(0, 10),
        latest: latest?.[0]?.published_at?.slice(0, 10),
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
      sources: { total: sources?.length ?? 0, enabled: srcEnabled, byType: srcByType },
      rollups,
    },
    null,
    2,
  ),
);
