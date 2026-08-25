import { getSql } from "@/lib/db/client";
import { fetchGoogleTrendsItems } from "@/lib/sources/google-trends";
import { fetchHackerNewsItems } from "@/lib/sources/hacker-news";
import { fetchLobstersItems } from "@/lib/sources/lobsters";
import { fetchRedditItems } from "@/lib/sources/reddit";
import { fetchRssItems } from "@/lib/sources/rss";
import { fetchYouTubeItems } from "@/lib/sources/youtube";
import type { NormalizedItem, Source } from "@/lib/types";
import { contentHash } from "@/lib/utils/hash";
import { buildSourceLabel } from "@/lib/sources/source-label";
import { enrichItemImageUrl } from "@/lib/sources/enrich-image";
import { enrichDescription } from "@/lib/sources/enrich-description";
import { hasRecentNormalizedUrl } from "@/lib/articles/dedup";

async function fetchFromSource(source: Source): Promise<NormalizedItem[]> {
  switch (source.type) {
    case "reddit":
      return fetchRedditItems(source);
    case "rss":
      return fetchRssItems(source);
    case "google_trends":
      return fetchGoogleTrendsItems(source);
    case "hacker_news":
      return fetchHackerNewsItems(source);
    case "lobsters":
      return fetchLobstersItems(source);
    case "youtube":
      return fetchYouTubeItems(source);
    default:
      return [];
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "23505"
  );
}

export async function ingestAllSources(): Promise<{
  processed: number;
  inserted: number;
  skipped: number;
}> {
  const sql = getSql();
  const sources = (await sql.query(
    `SELECT * FROM sources WHERE enabled = true`,
  )) as Source[];

  let processed = 0;
  let inserted = 0;
  let skipped = 0;

  for (const source of sources) {
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

      const existingHash = await sql.query(
        `SELECT id FROM raw_items WHERE content_hash = $1 LIMIT 1`,
        [hash],
      );

      if (existingHash.length) {
        skipped += 1;
        continue;
      }

      if (await hasRecentNormalizedUrl(sql, item.url)) {
        skipped += 1;
        continue;
      }

      const imageUrl =
        (await enrichItemImageUrl(item)) ?? item.imageUrl ?? null;
      const description = await enrichDescription(item);

      try {
        await sql.query(
          `INSERT INTO raw_items (
             source_id, external_id, title, description, url, image_url,
             engagement_score, published_at, content_hash, status
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending')`,
          [
            source.id,
            item.externalId,
            item.title,
            description,
            item.url,
            imageUrl,
            item.engagementScore,
            item.publishedAt?.toISOString() ?? null,
            hash,
          ],
        );
        inserted += 1;
      } catch (insertError) {
        if (isUniqueViolation(insertError)) {
          skipped += 1;
        } else {
          console.error("Insert error:", insertError);
        }
      }
    }
  }

  return { processed, inserted, skipped };
}

export async function getSourceItemsForArticle(
  sourceItemIds: string[],
): Promise<Array<{ title: string; url: string }>> {
  if (sourceItemIds.length === 0) return [];

  const sql = getSql();
  const data = (await sql.query(
    `SELECT r.title, r.url, s.type, s.config
     FROM raw_items r
     JOIN sources s ON s.id = r.source_id
     WHERE r.id = ANY($1::uuid[])`,
    [sourceItemIds],
  )) as Array<{
    title: string;
    url: string;
    type: Source["type"];
    config: Source["config"];
  }>;

  return data.map((row) => {
    const label = buildSourceLabel({ type: row.type, config: row.config });
    return {
      title: `${row.title} (${label})`,
      url: row.url,
    };
  });
}
