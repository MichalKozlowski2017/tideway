import type { Sql } from "@/lib/db/client";

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "this",
  "that",
  "over",
  "after",
  "into",
  "oraz",
  "jest",
  "się",
  "nie",
  "jak",
  "dla",
  "czy",
  "już",
  "ale",
  "tylko",
  "przez",
  "pod",
  "nad",
  "bez",
  "ich",
  "jego",
  "jej",
  "tego",
  "ten",
  "ta",
  "to",
  "nowy",
  "nowa",
  "nowe",
  "co",
  "oznacza",
  "oznaczać",
]);

/** Strip tracking params and fragments so the same story URL dedupes cleanly. */
export function normalizeSourceUrl(url: string): string {
  try {
    const parsed = new URL(url.trim());
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return url.trim().toLowerCase();
  }
}

/** Stable id when publishers reuse story paths (BBC article id, ESPN numeric id, …). */
export function storyFingerprint(url: string): string | null {
  const normalized = normalizeSourceUrl(url);
  const bbc = normalized.match(/\/articles\/([a-z0-9]+)/i);
  if (bbc) return `bbc:${bbc[1].toLowerCase()}`;

  const espn = normalized.match(/\/id\/(\d+)/);
  if (espn) return `espn:${espn[1]}`;

  const bankier = normalized.match(/bankier\.pl\/wiadomosc\/([^/?#]+)/i);
  if (bankier) return `bankier:${bankier[1].toLowerCase()}`;

  return null;
}

export function tokenizeForSimilarity(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((word) => word.length > 2 && !STOP_WORDS.has(word)),
  );
}

export function titleSimilarity(a: string, b: string): number {
  const tokensA = tokenizeForSimilarity(a);
  const tokensB = tokenizeForSimilarity(b);
  if (!tokensA.size || !tokensB.size) return 0;

  let intersection = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) intersection += 1;
  }

  const union = new Set([...tokensA, ...tokensB]).size;
  return intersection / union;
}

const SIMILAR_STORY_THRESHOLD = 0.38;
const SIMILAR_STORY_LOOKBACK_MS = 72 * 60 * 60 * 1000;

/** Fuzzy token match (exodus/exodus, effect/effecta) for cross-language titles. */
function tokensShareFuzzy(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length < 5 || b.length < 5) return false;
  return a.startsWith(b) || b.startsWith(a);
}

function distinctiveSharedTokenCount(a: string, b: string): number {
  const tokensA = [...tokenizeForSimilarity(a)].filter((token) => token.length >= 5);
  const tokensB = [...tokenizeForSimilarity(b)].filter((token) => token.length >= 5);
  let shared = 0;
  const used = new Set<number>();
  for (const tokenA of tokensA) {
    const index = tokensB.findIndex(
      (tokenB, i) => !used.has(i) && tokensShareFuzzy(tokenA, tokenB),
    );
    if (index >= 0) {
      used.add(index);
      shared += 1;
    }
  }
  return shared;
}

/** Same story across PL/EN wording or category remaps. */
export function isLikelySameStory(a: string, b: string): boolean {
  if (!a.trim() || !b.trim()) return false;
  if (titleSimilarity(a, b) >= SIMILAR_STORY_THRESHOLD) return true;
  // e.g. both mention "Exodus" + "Mass Effect" despite low Jaccard
  return distinctiveSharedTokenCount(a, b) >= 2;
}

export async function claimRawItems(sql: Sql, ids: string[]): Promise<boolean> {
  for (const id of ids) {
    const rows = await sql.query(
      `UPDATE raw_items
       SET status = 'processing'
       WHERE id = $1 AND status = 'pending'
       RETURNING id`,
      [id],
    );
    if (!rows.length) return false;
  }
  return true;
}

export async function releaseRawItems(
  sql: Sql,
  ids: string[],
  status: "failed" | "skipped" | "pending",
): Promise<void> {
  if (!ids.length) return;
  await sql.query(`UPDATE raw_items SET status = $1 WHERE id = ANY($2::uuid[])`, [
    status,
    ids,
  ]);
}

export async function findDuplicateArticle(
  sql: Sql,
  params: {
    locale: string;
    category: string;
    rawItemIds: string[];
    sourceUrl: string;
    sourceTitle: string;
    headline?: string;
  },
): Promise<{ id: string; slug: string } | null> {
  if (params.rawItemIds.length) {
    const bySource = await sql.query(
      `SELECT id, slug FROM articles
       WHERE locale = $1 AND source_item_ids @> ARRAY[$2]::uuid[]
       LIMIT 1`,
      [params.locale, params.rawItemIds[0]],
    );
    if (bySource[0]) {
      return bySource[0] as { id: string; slug: string };
    }
  }

  const fingerprint = storyFingerprint(params.sourceUrl);
  const normalizedUrl = normalizeSourceUrl(params.sourceUrl);
  const since = new Date(Date.now() - SIMILAR_STORY_LOOKBACK_MS).toISOString();

  // Cross-category: remaps (gaming→tech) must still see the first article.
  const recent = (await sql.query(
    `SELECT id, slug, headline, source_item_ids FROM articles
     WHERE locale = $1 AND published_at >= $2
     ORDER BY published_at DESC
     LIMIT 80`,
    [params.locale, since],
  )) as Array<{
    id: string;
    slug: string;
    headline: string;
    source_item_ids: string[];
  }>;

  if (!recent.length) return null;

  const sourceIds = [...new Set(recent.flatMap((row) => row.source_item_ids ?? []))];
  const sourceTitlesById = new Map<string, { title: string; url: string }>();

  if (sourceIds.length) {
    const rawRows = (await sql.query(
      `SELECT id, title, url FROM raw_items WHERE id = ANY($1::uuid[])`,
      [sourceIds],
    )) as Array<{ id: string; title: string; url: string }>;

    for (const row of rawRows) {
      sourceTitlesById.set(row.id, { title: row.title, url: row.url });
    }
  }

  const candidateTitles = [params.sourceTitle, params.headline]
    .filter((value): value is string => Boolean(value?.trim()));

  for (const article of recent) {
    for (const title of candidateTitles) {
      if (isLikelySameStory(title, article.headline)) {
        return { id: article.id, slug: article.slug };
      }
    }

    for (const sourceId of article.source_item_ids ?? []) {
      const source = sourceTitlesById.get(sourceId);
      if (!source) continue;

      if (
        normalizeSourceUrl(source.url) === normalizedUrl ||
        (fingerprint && storyFingerprint(source.url) === fingerprint)
      ) {
        return { id: article.id, slug: article.slug };
      }

      for (const title of candidateTitles) {
        if (isLikelySameStory(title, source.title)) {
          return { id: article.id, slug: article.slug };
        }
      }
    }
  }

  return null;
}

export async function hasExistingArticleForItem(
  sql: Sql,
  item: {
    id: string;
    content_hash: string;
    url: string;
    title: string;
    sources: { locale: string; category: string };
  },
): Promise<boolean> {
  const byHash = await sql.query(
    `SELECT id FROM raw_items
     WHERE content_hash = $1 AND status = 'processed' AND id <> $2
     LIMIT 1`,
    [item.content_hash, item.id],
  );
  if (byHash.length) return true;

  const byUrl = await sql.query(
    `SELECT id FROM raw_items
     WHERE url = $1 AND status = ANY(ARRAY['processed','processing']::raw_item_status[])
       AND id <> $2
     LIMIT 1`,
    [item.url, item.id],
  );
  if (byUrl.length) return true;

  const normalizedUrl = normalizeSourceUrl(item.url);
  const fingerprint = storyFingerprint(item.url);
  const since = new Date(Date.now() - SIMILAR_STORY_LOOKBACK_MS).toISOString();

  const recentRaw = (await sql.query(
    `SELECT id, url, title, status FROM raw_items
     WHERE status = ANY(ARRAY['processed','processing','pending']::raw_item_status[])
       AND fetched_at >= $1 AND id <> $2
     LIMIT 200`,
    [since, item.id],
  )) as Array<{ id: string; url: string; title: string; status: string }>;

  for (const row of recentRaw) {
    if (normalizeSourceUrl(row.url) === normalizedUrl) return true;
    if (fingerprint && storyFingerprint(row.url) === fingerprint) return true;
    if (row.status !== "pending" && isLikelySameStory(item.title, row.title)) {
      return true;
    }
  }

  const duplicate = await findDuplicateArticle(sql, {
    locale: item.sources.locale,
    category: item.sources.category,
    rawItemIds: [item.id],
    sourceUrl: item.url,
    sourceTitle: item.title,
  });

  return duplicate !== null;
}

export async function hasRecentNormalizedUrl(
  sql: Sql,
  url: string,
): Promise<boolean> {
  const normalizedUrl = normalizeSourceUrl(url);
  const fingerprint = storyFingerprint(url);
  const since = new Date(Date.now() - SIMILAR_STORY_LOOKBACK_MS).toISOString();

  const data = (await sql.query(
    `SELECT id, url FROM raw_items
     WHERE fetched_at >= $1
     ORDER BY fetched_at DESC
     LIMIT 120`,
    [since],
  )) as Array<{ id: string; url: string }>;

  for (const row of data) {
    if (normalizeSourceUrl(row.url) === normalizedUrl) return true;
    if (fingerprint && storyFingerprint(row.url) === fingerprint) return true;
  }

  return false;
}
