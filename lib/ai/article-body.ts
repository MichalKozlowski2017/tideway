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

const MAX_HEADING_LENGTH = 100;

function looksLikeHeading(text: string): boolean {
  if (!text || text.length > MAX_HEADING_LENGTH) return false;
  // Titles rarely end with sentence punctuation mid-text.
  if (/[.!?]["']?\s/.test(text)) return false;
  return true;
}

export function parseBodyBlocks(body: string): BodyBlock[] {
  const blocks: BodyBlock[] = [];

  for (const chunk of body.split(/\n\n+/)) {
    const trimmed = chunk.trim();
    if (!trimmed) continue;

    const lines = trimmed.split(/\n/);
    const firstLine = lines[0]?.trim() ?? "";

    if (firstLine.startsWith("## ")) {
      const headingText = firstLine.slice(3).trim();
      const rest = lines.slice(1).join("\n").trim();

      if (rest) {
        if (looksLikeHeading(headingText)) {
          blocks.push({ type: "heading", text: headingText });
          blocks.push({ type: "paragraph", text: rest });
        } else {
          blocks.push({
            type: "paragraph",
            text: [headingText, rest].filter(Boolean).join("\n\n"),
          });
        }
        continue;
      }

      if (looksLikeHeading(headingText)) {
        blocks.push({ type: "heading", text: headingText });
      } else {
        blocks.push({ type: "paragraph", text: headingText });
      }
      continue;
    }

    blocks.push({ type: "paragraph", text: trimmed });
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
