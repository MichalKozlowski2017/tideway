import { getSupabaseAdmin } from "@/lib/db/supabase";
import { fetchGoogleTrendsItems } from "@/lib/sources/google-trends";
import { fetchRedditItems } from "@/lib/sources/reddit";
import { fetchRssItems } from "@/lib/sources/rss";
import { fetchYouTubeItems } from "@/lib/sources/youtube";
import type { NormalizedItem, Source } from "@/lib/types";
import { contentHash } from "@/lib/utils/hash";

async function fetchFromSource(source: Source): Promise<NormalizedItem[]> {
  switch (source.type) {
    case "reddit":
      return fetchRedditItems(source);
    case "rss":
      return fetchRssItems(source);
    case "google_trends":
      return fetchGoogleTrendsItems(source);
    case "youtube":
      return fetchYouTubeItems(source);
    default:
      return [];
  }
}

export async function ingestAllSources(): Promise<{
  processed: number;
  inserted: number;
  skipped: number;
}> {
  const supabase = getSupabaseAdmin();
  const { data: sources, error } = await supabase
    .from("sources")
    .select("*")
    .eq("enabled", true);

  if (error) throw error;

  let processed = 0;
  let inserted = 0;
  let skipped = 0;

  for (const source of (sources ?? []) as Source[]) {
    let items: NormalizedItem[];
    try {
      items = await fetchFromSource(source);
    } catch (err) {
      console.error(`Failed to fetch source ${source.id}:`, err);
      continue;
    }

    for (const item of items) {
      processed += 1;
      const hash = contentHash(item.title, item.url);

      const { data: existingHash } = await supabase
        .from("raw_items")
        .select("id")
        .eq("content_hash", hash)
        .maybeSingle();

      if (existingHash) {
        skipped += 1;
        continue;
      }

      const { error: insertError } = await supabase.from("raw_items").insert({
        source_id: source.id,
        external_id: item.externalId,
        title: item.title,
        description: item.description,
        url: item.url,
        engagement_score: item.engagementScore,
        published_at: item.publishedAt?.toISOString() ?? null,
        content_hash: hash,
        status: "pending",
      });

      if (insertError) {
        if (insertError.code === "23505") {
          skipped += 1;
        } else {
          console.error("Insert error:", insertError);
        }
        continue;
      }

      inserted += 1;
    }
  }

  return { processed, inserted, skipped };
}

export async function getSourceItemsForArticle(
  sourceItemIds: string[],
): Promise<Array<{ title: string; url: string }>> {
  if (sourceItemIds.length === 0) return [];

  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("raw_items")
    .select("title, url")
    .in("id", sourceItemIds);

  return data ?? [];
}
