import type { Sql } from "@/lib/db/client";
import type { Source } from "@/lib/types";

type RawItemRow = {
  id: string;
  title: string;
  description: string | null;
  url: string;
  engagement_score: number;
  fetched_at: string;
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

function mapTrendContextRow(row: Record<string, unknown>): RawItemRow {
  return {
    id: row.id as string,
    title: row.title as string,
    description: (row.description as string | null) ?? null,
    url: row.url as string,
    engagement_score: Number(row.engagement_score),
    fetched_at: row.fetched_at as string,
    source_id: row.source_id as string,
    sources: {
      category: row.source_category as string,
      locale: row.source_locale as string,
      type: row.source_type as Source["type"],
      config: (row.source_config ?? {}) as Record<string, string>,
    },
  };
}

export async function buildTrendContext(
  sql: Sql,
  params: { query: string; category: string; limit?: number },
): Promise<{ description: string; matches: RawItemRow[] }> {
  const limit = params.limit ?? 3;
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const data = (await sql.query(
    `SELECT r.id, r.title, r.description, r.url, r.engagement_score,
            r.fetched_at, r.source_id,
            s.category AS source_category,
            s.locale AS source_locale,
            s.type AS source_type,
            s.config AS source_config
     FROM raw_items r
     JOIN sources s ON s.id = r.source_id
     WHERE r.status = ANY(ARRAY['pending','processed']::raw_item_status[])
       AND r.fetched_at >= $1
     ORDER BY r.fetched_at DESC
     LIMIT 80`,
    [since],
  )) as Record<string, unknown>[];

  const ranked = data
    .map(mapTrendContextRow)
    .filter((row) => row.sources?.type !== "google_trends")
    .filter((row) => row.sources?.category === params.category)
    .map((row) => ({
      row,
      score:
        overlapScore(params.query, row.title) * 3 +
        overlapScore(params.query, row.description ?? "") +
        (row.sources?.category === params.category ? 2 : 0),
    }))
    .filter((entry) => entry.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        Number(b.row.engagement_score) - Number(a.row.engagement_score),
    );

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
        `Context ${index + 1} (${row.url}):\nTitle: ${row.title}\n${(row.description ?? "").slice(0, 800)}`,
    )
    .join("\n\n---\n\n");

  return { description, matches };
}
