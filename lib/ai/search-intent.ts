import type { ArticleFormat } from "@/lib/ai/article-body";
import { isGuideCandidate, isListCandidate } from "@/lib/ai/article-body";
import { PL_SUFFIX } from "@/lib/ai/pl-regex";

export type SearchIntent = "quiz" | "guide" | "list" | "news";

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
  if (isGuideCandidate(title, description)) return "guide";
  if (isListCandidate(title, description)) return "list";
  return "news";
}

export function formatForSearchIntent(
  intent: SearchIntent,
  fallback: () => ArticleFormat,
): ArticleFormat {
  if (intent === "quiz") return "quiz";
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
  if (intent === "list") return 2;
  if (intent === "guide") return 2;
  return 0;
}
