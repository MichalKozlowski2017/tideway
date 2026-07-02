import type { ArticleFormat } from "@/lib/ai/article-body";
import { isGuideCandidate } from "@/lib/ai/article-body";

export type SearchIntent = "quiz" | "guide" | "news";

const QUIZ_SIGNALS =
  /\b(quiz|quizy|zagadk|zagadki|test wiedzy|odgadnij|zgadnij|who am i|guess the|guess.*star|pytania i odpowiedzi)\b/i;

export function detectSearchIntent(
  title: string,
  description?: string | null,
): SearchIntent {
  const text = `${title} ${description ?? ""}`;
  if (QUIZ_SIGNALS.test(text)) return "quiz";
  if (isGuideCandidate(title, description)) return "guide";
  return "news";
}

export function formatForSearchIntent(
  intent: SearchIntent,
  fallback: () => ArticleFormat,
): ArticleFormat {
  if (intent === "quiz") return "quiz";
  if (intent === "guide") return "guide";
  return fallback();
}
