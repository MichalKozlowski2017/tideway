export type ArticleFormat = "story" | "brief" | "community" | "analysis";

export interface ArticleBody {
  format: ArticleFormat;
  body?: string;
  highlights?: string[];
  contextNote?: string;
  sectionTitles?: {
    highlights?: string;
    impact?: string;
  };
}

export function parseArticleBody(summary: unknown): ArticleBody {
  if (summary && typeof summary === "object" && !Array.isArray(summary)) {
    const s = summary as ArticleBody;
    return {
      format: s.format ?? "story",
      body: s.body,
      highlights: s.highlights,
      contextNote: s.contextNote,
      sectionTitles: s.sectionTitles,
    };
  }
  if (Array.isArray(summary)) {
    return {
      format: "brief",
      highlights: summary.filter((x): x is string => typeof x === "string"),
    };
  }
  return { format: "brief", highlights: [] };
}


export function formatForSourceType(
  sourceType: string,
  _category = "",
): ArticleFormat {
  switch (sourceType) {
    case "hacker_news":
    case "lobsters":
    case "reddit":
      return "community";
    case "rss": {
      const roll = Math.random();
      if (roll < 0.55) return "story";
      return "analysis";
    }
    default:
      return "story";
  }
}
