export type ArticleFormat =
  | "story"
  | "brief"
  | "community"
  | "analysis"
  | "essay"
  | "synthesis"
  | "guide";

const GUIDE_SIGNALS =
  /\b(jak (zdobyć|zdobyc|ukończyć|ukonczyc|odblokować|odblokowac|naprawić|naprawic|skonfigurować|skonfigurowac|zainstalować|zainstalowac|znaleźć|znalezc)|gdzie (znaleźć|znalezc|szukać|szukac)|kiedy |co zrobić|poradnik|przewodnik|krok po kroku|how to (find|get|unlock|complete|fix|install|set up)|where to (find|get)|walkthrough|step[- ]by[- ]step|unlock|complete the)\b/i;

const GUIDE_EXCLUDE =
  /\b(good deal|worth buying|worth it|recenzja|review|promocja|okazja cenowa|porównanie cen|vs\.|versus|czy warto kupić)\b/i;

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

export function isGuideCandidate(
  title: string,
  description?: string | null,
): boolean {
  const text = `${title} ${description ?? ""}`;
  if (GUIDE_EXCLUDE.test(text) && !GUIDE_SIGNALS.test(text)) return false;
  return GUIDE_SIGNALS.test(text);
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

export function resolveArticleFormat(item: {
  title: string;
  description?: string | null;
  sources: { type: string; category: string };
}): ArticleFormat {
  if (
    item.sources.type === "rss" &&
    isGuideCandidate(item.title, item.description)
  ) {
    return "guide";
  }
  return formatForSourceType(item.sources.type, item.sources.category);
}

export function isLongReadFormat(format: ArticleFormat): boolean {
  return (
    format === "essay" ||
    format === "analysis" ||
    format === "synthesis" ||
    format === "guide"
  );
}
