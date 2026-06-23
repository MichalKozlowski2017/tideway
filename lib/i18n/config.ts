import type { Locale, Category } from "@/lib/types";

export const locales: Locale[] = ["pl", "en"];
/** Locales with live content and UI — EN paused until we generate EN articles */
export const activeLocales: Locale[] = ["pl"];
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
      description: "Najświeższe wiadomości tech.",
    },
    gaming: {
      title: "Trendy w grach",
      description: "Co dziś grzeje w grach.",
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
      description: "The latest tech news.",
    },
    gaming: {
      title: "Gaming trends",
      description: "What's hot in gaming today.",
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

export const categoryNavLabels: Record<Locale, Record<Category, string>> = {
  pl: {
    technology: "Technologia",
    gaming: "Gry",
    ai: "AI",
    sport: "Sport",
    finance: "Finanse",
  },
  en: {
    technology: "Technology",
    gaming: "Gaming",
    ai: "AI",
    sport: "Sport",
    finance: "Finance",
  },
};

export function categoryNavLabel(locale: Locale, category: Category): string {
  return categoryNavLabels[locale][category];
}

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
    tagPageTitle: string;
    tagPageDescription: string;
    openMenu: string;
    closeMenu: string;
    menu: string;
    categories: string;
    digests: string;
    siteName: string;
    siteTagline: string;
    aboutPage: string;
    privacyPage: string;
    aiDisclosure: string;
    rising: string;
    falling: string;
    feedLoading: string;
    feedProgress: string;
    feedRetry: string;
    feedRss: string;
    share: string;
    shareNative: string;
    copyLink: string;
    linkCopied: string;
  }
> = {
  pl: {
    homeTitle: "Tideway — co dziś w trendach",
    homeDescription:
      "Co dziś grzeje w sieci — tech, gry, sport i finanse. Zebrane i opisane, żebyś nie musiał przewijać setek linków.",
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
    tagPageTitle: "Trendy: {tag}",
    tagPageDescription:
      "Najnowsze artykuły i podsumowania powiązane z tematem „{tag}”.",
    openMenu: "Otwórz menu",
    closeMenu: "Zamknij menu",
    menu: "Menu",
    categories: "Kategorie",
    digests: "Przeglądy",
    siteName: "Tideway",
    siteTagline: "Co dziś grzeje w sieci",
    aboutPage: "O nas",
    privacyPage: "Polityka prywatności",
    aiDisclosure: "Streszczenie AI",
    rising: "Co rośnie",
    falling: "Co spada",
    feedLoading: "Ładowanie kolejnych artykułów…",
    feedProgress: "Wyświetlono {shown} z {total}",
    feedRetry: "Nie udało się załadować — spróbuj ponownie",
    feedRss: "Kanał RSS",
    share: "Udostępnij",
    shareNative: "Udostępnij…",
    copyLink: "Kopiuj link",
    linkCopied: "Skopiowano!",
  },
  en: {
    homeTitle: "Tideway — today's trends",
    homeDescription:
      "What's buzzing online today — tech, games, sports, and finance. Curated so you don't have to scroll through dozens of links.",
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
    tagPageTitle: "Trends: {tag}",
    tagPageDescription:
      "Latest articles and summaries related to “{tag}”.",
    openMenu: "Open menu",
    closeMenu: "Close menu",
    menu: "Menu",
    categories: "Categories",
    digests: "Digests",
    siteName: "Tideway",
    siteTagline: "What's online today",
    aboutPage: "About",
    privacyPage: "Privacy policy",
    aiDisclosure: "AI summary",
    rising: "Rising",
    falling: "Falling",
    feedLoading: "Loading more articles…",
    feedProgress: "Showing {shown} of {total}",
    feedRetry: "Couldn't load more — tap to retry",
    feedRss: "RSS feed",
    share: "Share",
    shareNative: "Share…",
    copyLink: "Copy link",
    linkCopied: "Copied!",
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

export function tagPath(locale: Locale, slug: string): string {
  if (locale === "pl") return `/tagi/${slug}`;
  return `/en/tag/${slug}`;
}

export function homePath(locale: Locale): string {
  if (locale === "pl") return "/";
  return "/en";
}

export function aboutPath(locale: Locale): string {
  if (locale === "pl") return "/o-nas";
  return "/en/about";
}

export function privacyPath(locale: Locale): string {
  if (locale === "pl") return "/polityka-prywatnosci";
  return "/en/privacy";
}
