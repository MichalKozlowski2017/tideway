import type { Locale } from "@/lib/types";

export function estimateReadTimeMinutes(text: string, locale: Locale): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  const wordsPerMinute = locale === "pl" ? 200 : 220;
  return Math.max(1, Math.round(words / wordsPerMinute));
}

export function formatReadTime(minutes: number, locale: Locale): string {
  if (locale === "pl") {
    return minutes === 1 ? "1 min czytania" : `${minutes} min czytania`;
  }
  return minutes === 1 ? "1 min read" : `${minutes} min read`;
}
