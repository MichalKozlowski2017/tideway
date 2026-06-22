import type { NormalizedItem, Source } from "@/lib/types";
import { enrichItemImageUrl } from "@/lib/sources/enrich-image";

interface HnItem {
  id: number;
  title?: string;
  url?: string;
  score?: number;
  descendants?: number;
  text?: string;
  time?: number;
  type?: string;
  by?: string;
  kids?: number[];
  deleted?: boolean;
  dead?: boolean;
}

async function fetchHnItem(id: number): Promise<HnItem | null> {
  const response = await fetch(
    `https://hacker-news.firebaseio.com/v0/item/${id}.json`,
    { next: { revalidate: 0 } },
  );
  if (!response.ok) return null;
  return response.json() as Promise<HnItem>;
}

async function fetchSampleComments(
  kids: number[] | undefined,
  limit = 2,
): Promise<string[]> {
  if (!kids?.length) return [];

  const samples: string[] = [];
  for (const id of kids.slice(0, 8)) {
    if (samples.length >= limit) break;

    const comment = await fetchHnItem(id);
    if (!comment?.text || comment.deleted || comment.dead) continue;

    const text = comment.text.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (text.length < 20) continue;

    samples.push(`@${comment.by ?? "user"}: ${text.slice(0, 350)}`);
  }

  return samples;
}

function buildDescription(item: HnItem, comments: string[]): string {
  const parts = [
    `Source: Hacker News`,
    `Score: ${item.score ?? 0} points`,
    `Comments: ${item.descendants ?? 0}`,
    `Author: ${item.by ?? "unknown"}`,
    `Type: ${item.type ?? "story"}`,
  ];
  if (item.text?.trim()) {
    parts.push("", "Post text:", item.text.replace(/<[^>]+>/g, "").slice(0, 1200));
  }
  if (comments.length > 0) {
    parts.push("", "Sample comments (do not invent others):", ...comments);
  }
  return parts.join("\n");
}

export async function fetchHackerNewsItems(
  source: Source,
): Promise<NormalizedItem[]> {
  const listType = source.config.list ?? "topstories";
  const limit = Number(source.config.limit ?? "25");

  const response = await fetch(
    `https://hacker-news.firebaseio.com/v0/${listType}.json`,
    { next: { revalidate: 0 } },
  );

  if (!response.ok) {
    throw new Error(`Hacker News API error: ${response.status}`);
  }

  const ids = (await response.json()) as number[];
  const topIds = ids.slice(0, limit);

  const items = await Promise.all(topIds.map((id) => fetchHnItem(id)));
  const stories = items.filter(
    (item): item is HnItem => item !== null && Boolean(item.title),
  );

  const enriched = await Promise.all(
    stories.map(async (item) => {
      const comments =
        (item.descendants ?? 0) > 0
          ? await fetchSampleComments(item.kids, 2)
          : [];

      const url = item.url ?? `https://news.ycombinator.com/item?id=${item.id}`;
      const imageUrl = await enrichItemImageUrl({ url, imageUrl: null });

      return {
        externalId: String(item.id),
        title: item.title!,
        description: buildDescription(item, comments),
        url,
        imageUrl,
        engagementScore: (item.score ?? 0) + (item.descendants ?? 0) * 2,
        publishedAt: item.time ? new Date(item.time * 1000) : null,
        sourceLabel: "Hacker News",
      };
    }),
  );

  return enriched;
}
