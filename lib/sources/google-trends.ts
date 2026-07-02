import googleTrends from "google-trends-api";
import type { NormalizedItem, Source } from "@/lib/types";

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

type RankedKeyword = { query: string; value: number };

async function fetchRisingQueries(
  geo: string,
  keyword: string,
): Promise<RankedKeyword[]> {
  const result = await googleTrends.relatedQueries({ keyword, geo });
  const parsed = JSON.parse(result) as {
    default?: {
      rankedList?: Array<{
        rankedKeyword?: Array<{ query?: string; value?: number }>;
      }>;
    };
  };

  return (parsed.default?.rankedList?.[1]?.rankedKeyword ?? [])
    .slice(0, 8)
    .map((item, index) => ({
      query: item.query ?? `trend-${index}`,
      value: item.value ?? 0,
    }))
    .filter((item) => item.query.length > 2);
}

async function fetchDailyTrends(geo: string): Promise<RankedKeyword[]> {
  try {
    const trendsApi = googleTrends as typeof googleTrends & {
      dailyTrends: (options: { geo: string }) => Promise<string>;
    };
    const result = await trendsApi.dailyTrends({ geo });
    const parsed = JSON.parse(result) as {
      default?: {
        trendingSearchesDays?: Array<{
          trendingSearches?: Array<{
            title?: { query?: string };
            formattedTraffic?: string;
          }>;
        }>;
      };
    };

    const today = parsed.default?.trendingSearchesDays?.[0]?.trendingSearches ?? [];
    return today.slice(0, 10).map((item, index) => {
      const traffic = item.formattedTraffic ?? "";
      const trafficValue = Number.parseInt(traffic.replace(/\D/g, ""), 10);
      return {
        query: item.title?.query ?? `daily-${index}`,
        value: Number.isFinite(trafficValue) ? trafficValue : 100 - index,
      };
    });
  } catch {
    return [];
  }
}

function toTrendItem(
  item: RankedKeyword,
  geo: string,
  category: string,
  index: number,
): NormalizedItem {
  const query = item.query;
  return {
    externalId: `gt-${geo}-${slugify(query)}-${index}`,
    title: query,
    description: `Rising search in ${geo} (${category}). Relative interest: ${item.value}.`,
    url: `https://trends.google.com/trends/explore?geo=${geo}&q=${encodeURIComponent(query)}`,
    engagementScore: item.value,
    publishedAt: new Date(),
    sourceLabel: `Google Trends (${geo})`,
  };
}

export async function fetchGoogleTrendsItems(
  source: Source,
): Promise<NormalizedItem[]> {
  const geo = source.config.geo ?? "PL";
  const keyword = source.config.keyword ?? source.category;

  try {
    const [rising, daily] = await Promise.all([
      fetchRisingQueries(geo, keyword),
      source.config.includeDaily === "true" ? fetchDailyTrends(geo) : Promise.resolve([]),
    ]);

    const seen = new Set<string>();
    const merged: RankedKeyword[] = [];
    for (const item of [...rising, ...daily]) {
      const key = item.query.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(item);
    }

    merged.sort((a, b) => b.value - a.value);

    return merged.slice(0, 12).map((item, index) =>
      toTrendItem(item, geo, source.category, index),
    );
  } catch {
    return [];
  }
}
