import type { NormalizedItem, Source } from "@/lib/types";

const YOUTUBE_CATEGORY_IDS: Record<string, string> = {
  tech: "28",
  gaming: "20",
  ai: "28",
  sport: "17",
  finance: "25",
};

export async function fetchYouTubeItems(
  source: Source,
): Promise<NormalizedItem[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return [];

  const category = source.config.category ?? source.category;
  const regionCode = source.config.regionCode ?? "PL";
  const categoryId = YOUTUBE_CATEGORY_IDS[category] ?? "28";

  const params = new URLSearchParams({
    part: "snippet,statistics",
    chart: "mostPopular",
    regionCode,
    videoCategoryId: categoryId,
    maxResults: "10",
    key: apiKey,
  });

  const response = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?${params}`,
    { next: { revalidate: 0 } },
  );

  if (!response.ok) return [];

  const data = (await response.json()) as {
    items?: Array<{
      id: string;
      snippet: {
        title: string;
        description: string;
        publishedAt: string;
        channelTitle: string;
      };
      statistics?: { viewCount?: string; likeCount?: string };
    }>;
  };

  return (data.items ?? []).map((video) => ({
    externalId: video.id,
    title: video.snippet.title,
    description: video.snippet.description.slice(0, 500),
    url: `https://www.youtube.com/watch?v=${video.id}`,
    engagementScore:
      Number(video.statistics?.viewCount ?? 0) / 1000 +
      Number(video.statistics?.likeCount ?? 0),
    publishedAt: new Date(video.snippet.publishedAt),
    sourceLabel: `YouTube · ${video.snippet.channelTitle}`,
  }));
}
