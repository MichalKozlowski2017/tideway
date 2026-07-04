import type { getSupabaseAdmin } from "@/lib/db/supabase";

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

type SupabaseAdmin = ReturnType<typeof getSupabaseAdmin>;

export async function claimRawItems(
  supabase: SupabaseAdmin,
  ids: string[],
): Promise<boolean> {
  for (const id of ids) {
    const { data } = await supabase
      .from("raw_items")
      .update({ status: "processing" })
      .eq("id", id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();

    if (!data) return false;
  }
  return true;
}

export async function releaseRawItems(
  supabase: SupabaseAdmin,
  ids: string[],
  status: "failed" | "skipped" | "pending",
): Promise<void> {
  if (!ids.length) return;
  await supabase.from("raw_items").update({ status }).in("id", ids);
}

export async function findDuplicateArticle(
  supabase: SupabaseAdmin,
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
    const { data: bySource } = await supabase
      .from("articles")
      .select("id, slug")
      .eq("locale", params.locale)
      .contains("source_item_ids", [params.rawItemIds[0]])
      .limit(1);

    if (bySource?.[0]) return bySource[0];
  }

  const fingerprint = storyFingerprint(params.sourceUrl);
  const normalizedUrl = normalizeSourceUrl(params.sourceUrl);
  const since = new Date(Date.now() - SIMILAR_STORY_LOOKBACK_MS).toISOString();

  const { data: recent } = await supabase
    .from("articles")
    .select("id, slug, headline, source_item_ids")
    .eq("locale", params.locale)
    .eq("category", params.category)
    .gte("published_at", since)
    .order("published_at", { ascending: false })
    .limit(40);

  if (!recent?.length) return null;

  const sourceIds = [
    ...new Set(recent.flatMap((row) => row.source_item_ids ?? [])),
  ];
  const sourceTitlesById = new Map<string, { title: string; url: string }>();

  if (sourceIds.length) {
    const { data: rawRows } = await supabase
      .from("raw_items")
      .select("id, title, url")
      .in("id", sourceIds);

    for (const row of rawRows ?? []) {
      sourceTitlesById.set(row.id, { title: row.title, url: row.url });
    }
  }

  for (const article of recent) {
    for (const sourceId of article.source_item_ids ?? []) {
      const source = sourceTitlesById.get(sourceId);
      if (!source) continue;

      if (
        normalizeSourceUrl(source.url) === normalizedUrl ||
        (fingerprint && storyFingerprint(source.url) === fingerprint)
      ) {
        return { id: article.id, slug: article.slug };
      }

      if (
        titleSimilarity(params.sourceTitle, source.title) >=
        SIMILAR_STORY_THRESHOLD
      ) {
        return { id: article.id, slug: article.slug };
      }
    }
  }

  return null;
}

export async function hasExistingArticleForItem(
  supabase: SupabaseAdmin,
  item: {
    id: string;
    content_hash: string;
    url: string;
    title: string;
    sources: { locale: string; category: string };
  },
): Promise<boolean> {
  const { data: byHash } = await supabase
    .from("raw_items")
    .select("id")
    .eq("content_hash", item.content_hash)
    .eq("status", "processed")
    .neq("id", item.id)
    .limit(1);

  if (byHash?.length) return true;

  const { data: byUrl } = await supabase
    .from("raw_items")
    .select("id")
    .eq("url", item.url)
    .in("status", ["processed", "processing"])
    .neq("id", item.id)
    .limit(1);

  if (byUrl?.length) return true;

  const normalizedUrl = normalizeSourceUrl(item.url);
  const fingerprint = storyFingerprint(item.url);
  const since = new Date(Date.now() - SIMILAR_STORY_LOOKBACK_MS).toISOString();

  const { data: recentRaw } = await supabase
    .from("raw_items")
    .select("id, url, title, status")
    .in("status", ["processed", "processing", "pending"])
    .gte("fetched_at", since)
    .neq("id", item.id)
    .limit(200);

  for (const row of recentRaw ?? []) {
    if (normalizeSourceUrl(row.url) === normalizedUrl) return true;
    if (fingerprint && storyFingerprint(row.url) === fingerprint) return true;
    if (
      row.status !== "pending" &&
      titleSimilarity(item.title, row.title) >= SIMILAR_STORY_THRESHOLD
    ) {
      return true;
    }
  }

  const duplicate = await findDuplicateArticle(supabase, {
    locale: item.sources.locale,
    category: item.sources.category,
    rawItemIds: [item.id],
    sourceUrl: item.url,
    sourceTitle: item.title,
  });

  return duplicate !== null;
}

export async function hasRecentNormalizedUrl(
  supabase: SupabaseAdmin,
  url: string,
): Promise<boolean> {
  const normalizedUrl = normalizeSourceUrl(url);
  const fingerprint = storyFingerprint(url);
  const since = new Date(Date.now() - SIMILAR_STORY_LOOKBACK_MS).toISOString();

  const { data } = await supabase
    .from("raw_items")
    .select("id, url")
    .gte("fetched_at", since)
    .order("fetched_at", { ascending: false })
    .limit(120);

  for (const row of data ?? []) {
    if (normalizeSourceUrl(row.url) === normalizedUrl) return true;
    if (fingerprint && storyFingerprint(row.url) === fingerprint) return true;
  }

  return false;
}
