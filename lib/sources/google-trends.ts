import googleTrends from "google-trends-api";
import type { NormalizedItem, Source } from "@/lib/types";

export async function fetchGoogleTrendsItems(
  source: Source,
): Promise<NormalizedItem[]> {
  const geo = source.config.geo ?? "PL";
  const keyword = source.config.keyword ?? source.category;

  try {
    const result = await googleTrends.relatedQueries({
      keyword,
      geo,
    });

    const parsed = JSON.parse(result) as {
      default?: {
        rankedList?: Array<{
          rankedKeyword?: Array<{
            query?: string;
            value?: number;
          }>;
        }>;
      };
    };

    const rising =
      parsed.default?.rankedList?.[1]?.rankedKeyword?.slice(0, 10) ?? [];

    return rising.map((item, index) => {
      const query = item.query ?? `trend-${index}`;
      return {
        externalId: `gt-${geo}-${slugify(query)}`,
        title: query,
        description: `Rising search trend in ${geo} for category ${source.category}.`,
        url: `https://trends.google.com/trends/explore?geo=${geo}&q=${encodeURIComponent(query)}`,
        engagementScore: item.value ?? 0,
        publishedAt: new Date(),
        sourceLabel: `Google Trends (${geo})`,
      };
    });
  } catch {
    return [];
  }
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}
