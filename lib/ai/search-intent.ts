import type { ArticleFormat } from "@/lib/ai/article-body";
import { isGuideCandidate, isListCandidate } from "@/lib/ai/article-body";
import { isExplainerCandidate } from "@/lib/ai/trend-quality";
import { PL_SUFFIX } from "@/lib/ai/pl-regex";

export type SearchIntent = "quiz" | "guide" | "list" | "explainer" | "news";

const QUIZ_SIGNALS = new RegExp(
  String.raw`\b(quiz|quizy|zagadk${PL_SUFFIX}|test wiedzy|odgadnij${PL_SUFFIX}|zgadnij${PL_SUFFIX}|kto to jest|kto wygra|typy mecz${PL_SUFFIX}|typuj|who am i|guess the|guess.*star|pytania i odpowiedzi)\b`,
  "i",
);

export function detectSearchIntent(
  title: string,
  description?: string | null,
): SearchIntent {
  const text = `${title} ${description ?? ""}`;
  if (QUIZ_SIGNALS.test(text)) return "quiz";
  if (isExplainerCandidate(title, description)) return "explainer";
  if (isGuideCandidate(title, description)) return "guide";
  if (isListCandidate(title, description)) return "list";
  return "news";
}

export function formatForSearchIntent(
  intent: SearchIntent,
  fallback: () => ArticleFormat,
): ArticleFormat {
  if (intent === "quiz") return "quiz";
  if (intent === "explainer") return "explainer";
  if (intent === "guide") return "guide";
  if (intent === "list") return "list";
  return fallback();
}

export function isHighIntentQuery(
  title: string,
  description?: string | null,
): boolean {
  return detectSearchIntent(title, description) !== "news";
}

export function intentPriority(intent: SearchIntent): number {
  if (intent === "quiz") return 3;
  if (intent === "explainer") return 3;
  if (intent === "list") return 2;
  if (intent === "guide") return 2;
  return 0;
}

const SPORT_QUIZ_SIGNALS = new RegExp(
  String.raw`\b(mundial|mistrzostwa|liga mistrzów|liga mistrzow|ekstraklasa|reprezentacj${PL_SUFFIX}|puchar|euro\s?\d{2,4}|champions league|derby|finał|final|mecz|meczy|bramk|strzelc|kto wygra)\b`,
  "i",
);

export function isSportQuizCandidate(
  title: string,
  description?: string | null,
): boolean {
  if (detectSearchIntent(title, description) === "quiz") return true;
  const text = `${title} ${description ?? ""}`;
  return SPORT_QUIZ_SIGNALS.test(text);
}

/** Trend articles never default to story — prefer intent-matched engaging formats. */
export function pickTrendArticleFormat(
  query: string,
  category: string,
): ArticleFormat {
  const intent = detectSearchIntent(query);
  if (intent === "quiz") return "quiz";
  if (intent === "list") return "list";
  if (intent === "explainer") return "explainer";
  if (intent === "guide") return "guide";

  if (isExplainerCandidate(query)) return "explainer";

  switch (category) {
    case "sport":
      return isSportQuizCandidate(query) ? "quiz" : "guide";
    case "gaming":
    case "finance":
      return isListCandidate(query) ? "list" : "guide";
    case "ai":
    case "tech":
    case "it":
      return "guide";
    default:
      return "guide";
  }
}
