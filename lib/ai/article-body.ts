export type ArticleFormat =
  | "story"
  | "brief"
  | "community"
  | "analysis"
  | "essay"
  | "synthesis";

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

export type BodyBlock =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string };

export function parseBodyBlocks(body: string): BodyBlock[] {
  const blocks: BodyBlock[] = [];

  for (const chunk of body.split(/\n\n+/)) {
    const trimmed = chunk.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith("## ")) {
      blocks.push({ type: "heading", text: trimmed.slice(3).trim() });
    } else {
      blocks.push({ type: "paragraph", text: trimmed });
    }
  }

  return blocks;
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
      if (roll < 0.3) return "story";
      if (roll < 0.6) return "analysis";
      return "essay";
    }
    default:
      return "story";
  }
}

export function isLongReadFormat(format: ArticleFormat): boolean {
  return format === "essay" || format === "analysis" || format === "synthesis";
}
