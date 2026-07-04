export type ArticleFormat =
  | "story"
  | "brief"
  | "community"
  | "analysis"
  | "essay"
  | "synthesis"
  | "guide"
  | "explainer"
  | "quiz"
  | "list";

import {
  detectSearchIntent,
  formatForSearchIntent,
} from "@/lib/ai/search-intent";
import { PL_SUFFIX } from "@/lib/ai/pl-regex";
import type { QuizQuestion } from "@/lib/quiz/types";
import { parseQuizQuestions } from "@/lib/quiz/types";

const GUIDE_SIGNALS =
  /\b(jak (zdobyć|zdobyc|ukończyć|ukonczyc|odblokować|odblokowac|naprawić|naprawic|skonfigurować|skonfigurowac|zainstalować|zainstalowac|znaleźć|znalezc)|gdzie (znaleźć|znalezc|szukać|szukac)|kiedy |co zrobić|poradnik|przewodnik|krok po kroku|how to (find|get|unlock|complete|fix|install|set up)|where to (find|get)|walkthrough|step[- ]by[- ]step|unlock|complete the)\b/i;

const GUIDE_EXCLUDE =
  /\b(good deal|worth buying|worth it|recenzja|review|promocja|okazja cenowa|porównanie cen|vs\.|versus|czy warto kupić)\b/i;

const LIST_STRONG = new RegExp(
  String.raw`\b(top\s?\d|top\d|najleps${PL_SUFFIX}|list${PL_SUFFIX}\s?\d|(\d+)\s+(naj|najlepsz${PL_SUFFIX}|sposob${PL_SUFFIX}|gier|aplikacj${PL_SUFFIX}|tip${PL_SUFFIX}|powod${PL_SUFFIX}|serwis${PL_SUFFIX})|best\s?\d|must[- ]have)\b`,
  "i",
);

/** News/poll headlines that mention "ranking" but are not listicle queries. */
const LIST_EXCLUDE = new RegExp(
  String.raw`\b(sondaż|sondaz|sondażu|wyniki|wynik|rekord|nieufności|nieufnosci|zaufanie do|polityk|politycy|prezydent|premier|sejm|wybor|transfer|pogoda|kurs walut|inflacja|rejestracji)\b`,
  "i",
);

export interface ArticleBody {
  format: ArticleFormat;
  body?: string;
  highlights?: string[];
  contextNote?: string;
  quiz?: QuizQuestion[];
  sectionTitles?: {
    highlights?: string;
    impact?: string;
  };
}

export type BodyBlock =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "code"; language: string; code: string };

const CODE_FENCE_RE = /```([\w-]*)\r?\n([\s\S]*?)```/g;

const MAX_HEADING_LENGTH = 100;

function looksLikeHeading(text: string): boolean {
  if (!text || text.length > MAX_HEADING_LENGTH) return false;
  // Titles rarely end with sentence punctuation mid-text.
  if (/[.!?]["']?\s/.test(text)) return false;
  return true;
}

function parseTextChunk(text: string): BodyBlock[] {
  const blocks: BodyBlock[] = [];

  for (const chunk of text.split(/\n\n+/)) {
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

export function parseBodyBlocks(body: string): BodyBlock[] {
  const blocks: BodyBlock[] = [];
  let lastIndex = 0;

  for (const match of body.matchAll(CODE_FENCE_RE)) {
    const index = match.index ?? 0;
    const before = body.slice(lastIndex, index);
    if (before.trim()) {
      blocks.push(...parseTextChunk(before));
    }

    blocks.push({
      type: "code",
      language: match[1] || "text",
      code: match[2].replace(/\n$/, ""),
    });
    lastIndex = index + match[0].length;
  }

  const tail = body.slice(lastIndex);
  if (tail.trim()) {
    blocks.push(...parseTextChunk(tail));
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
      quiz: parseQuizQuestions(summary) ?? undefined,
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

export function isListCandidate(
  title: string,
  description?: string | null,
): boolean {
  const text = `${title} ${description ?? ""}`;
  if (isGuideCandidate(title, description)) return false;
  if (LIST_EXCLUDE.test(text)) return false;
  return LIST_STRONG.test(text);
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
  const intent = detectSearchIntent(item.title, item.description);
  return formatForSearchIntent(intent, () => {
    if (
      item.sources.type === "rss" &&
      isGuideCandidate(item.title, item.description)
    ) {
      return "guide";
    }
    return formatForSourceType(item.sources.type, item.sources.category);
  });
}

export function isLongReadFormat(format: ArticleFormat): boolean {
  return (
    format === "essay" ||
    format === "analysis" ||
    format === "synthesis" ||
    format === "guide" ||
    format === "explainer" ||
    format === "quiz"
  );
}
