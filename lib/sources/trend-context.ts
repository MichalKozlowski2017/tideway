import type { Source } from "@/lib/types";
import type { getSupabaseAdmin } from "@/lib/db/supabase";

type RawItemRow = {
  id: string;
  title: string;
  description: string | null;
  url: string;
  image_url: string | null;
  engagement_score: number;
  published_at: string | null;
  fetched_at: string;
  content_hash: string;
  status: string;
  source_id: string;
  sources: Pick<Source, "category" | "locale" | "type" | "config">;
};

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length > 2);
}

function overlapScore(query: string, text: string): number {
  const queryTokens = new Set(tokenize(query));
  if (queryTokens.size === 0) return 0;
  let hits = 0;
  for (const token of tokenize(text)) {
    if (queryTokens.has(token)) hits += 1;
  }
  return hits;
}

export async function buildTrendContext(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  params: { query: string; category: string; limit?: number },
): Promise<{ description: string; matches: RawItemRow[] }> {
  const limit = params.limit ?? 3;
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("raw_items")
    .select("*, sources(category, locale, type, config)")
    .in("status", ["pending", "processed"])
    .gte("fetched_at", since)
    .order("fetched_at", { ascending: false })
    .limit(250);

  if (error) throw error;

  const ranked = ((data ?? []) as RawItemRow[])
    .filter((row) => row.sources?.type !== "google_trends")
    .map((row) => ({
      row,
      score:
        overlapScore(params.query, row.title) * 3 +
        overlapScore(params.query, row.description ?? "") +
        (row.sources?.category === params.category ? 2 : 0),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || Number(b.row.engagement_score) - Number(a.row.engagement_score));

  const matches = ranked.slice(0, limit).map((entry) => entry.row);

  if (matches.length === 0) {
    return {
      description: `Rising search query in Poland: "${params.query}". Category: ${params.category}. Write for what Polish users are searching right now — use widely known public facts only.`,
      matches: [],
    };
  }

  const description = matches
    .map(
      (row, index) =>
        `Context ${index + 1} (${row.url}):\nTitle: ${row.title}\n${row.description ?? ""}`,
    )
    .join("\n\n---\n\n");

  return { description, matches };
}
