import type { Locale } from "@/lib/types";

/** Polish/English article count label for list headers. */
export function formatArticleCount(locale: Locale, count: number): string {
  if (locale === "pl") {
    if (count === 1) return "1 artykuł";
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
      return `${count} artykuły`;
    }
    return `${count} artykułów`;
  }

  return count === 1 ? "1 article" : `${count} articles`;
}
