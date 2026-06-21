import type { Locale } from "@/lib/types";

export const locales: Locale[] = ["pl", "en"];
export const defaultLocale: Locale = "pl";

export function isLocale(value: string): value is Locale {
  return locales.includes(value as Locale);
}

export const categoryLabels: Record<
  Locale,
  Record<string, { title: string; description: string }>
> = {
  pl: {
    technology: {
      title: "Trendy w technologii",
      description: "Najświeższe podsumowania z Reddit, RSS i Google Trends.",
    },
    gaming: {
      title: "Trendy w grach",
      description: "Co dziś grzeje w gamingu — skróty i kontekst.",
    },
    ai: {
      title: "Trendy AI",
      description: "Sztuczna inteligencja — newsy i dyskusje dnia.",
    },
    sport: {
      title: "Trendy sportowe",
      description: "Sportowe tematy dnia w pigułce.",
    },
    finance: {
      title: "Trendy finansowe",
      description: "Rynek, krypto i ekonomia — podsumowania.",
    },
  },
  en: {
    technology: {
      title: "Technology trends",
      description: "Fresh summaries from Reddit, RSS, and Google Trends.",
    },
    gaming: {
      title: "Gaming trends",
      description: "What is hot in gaming today — context included.",
    },
    ai: {
      title: "AI trends",
      description: "Artificial intelligence news and discussions.",
    },
    sport: {
      title: "Sports trends",
      description: "Sports topics of the day in brief.",
    },
    finance: {
      title: "Finance trends",
      description: "Markets, crypto, and economy summaries.",
    },
  },
};

export const ui: Record<
  Locale,
  {
    homeTitle: string;
    homeDescription: string;
    dailyDigest: string;
    weeklyDigest: string;
    keyPoints: string;
    whyItMatters: string;
    sources: string;
    readMore: string;
    noArticles: string;
    latest: string;
    tags: string;
    related: string;
    siteName: string;
    rising: string;
    falling: string;
  }
> = {
  pl: {
    homeTitle: "TrendPulse — co dziś w trendach",
    homeDescription:
      "Automatyczne podsumowania trendów: technologia, gry, AI i więcej.",
    dailyDigest: "Dzienny przegląd",
    weeklyDigest: "Tygodniowy przegląd",
    keyPoints: "Najważniejsze punkty",
    whyItMatters: "Dlaczego to ważne?",
    sources: "Źródła",
    readMore: "Czytaj więcej",
    noArticles: "Brak artykułów — wróć za chwilę.",
    latest: "Najnowsze",
    tags: "Tagi",
    related: "Powiązane",
    siteName: "TrendPulse",
    rising: "Co rośnie",
    falling: "Co spada",
  },
  en: {
    homeTitle: "TrendPulse — today's trends",
    homeDescription:
      "Automated trend summaries: technology, gaming, AI, and more.",
    dailyDigest: "Daily digest",
    weeklyDigest: "Weekly digest",
    keyPoints: "Key points",
    whyItMatters: "Why it matters",
    sources: "Sources",
    readMore: "Read more",
    noArticles: "No articles yet — check back soon.",
    latest: "Latest",
    tags: "Tags",
    related: "Related",
    siteName: "TrendPulse",
    rising: "Rising",
    falling: "Falling",
  },
};

export function categoryPath(locale: Locale, categorySlug: string): string {
  if (locale === "pl") return `/trendy/${categorySlug}`;
  return `/en/trends/${categorySlug}`;
}

export function articlePath(locale: Locale, slug: string): string {
  if (locale === "pl") return `/artykul/${slug}`;
  return `/en/article/${slug}`;
}

export function dailyDigestPath(locale: Locale): string {
  if (locale === "pl") return "/dzienny-przeglad";
  return "/en/daily-digest";
}

export function weeklyDigestPath(locale: Locale): string {
  if (locale === "pl") return "/tygodniowy-przeglad";
  return "/en/weekly-digest";
}

export function homePath(locale: Locale): string {
  if (locale === "pl") return "/";
  return "/en";
}
