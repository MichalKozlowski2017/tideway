import type { Category } from "@/lib/types";
import { fetchOgImage } from "@/lib/sources/og-image";
import {
  isWeakPreviewImage,
  usableArticleImageUrl,
} from "@/lib/sources/extract-image";

function isStockFallback(url: string): boolean {
  return url.includes("images.unsplash.com");
}

/** AI/tech often link to GitHub/HN — show branded gradient instead of stock photos */
function prefersCategoryPlaceholder(category: Category): boolean {
  return category === "ai" || category === "it";
}

export async function resolveArticleImageUrl(params: {
  sourceImageUrl?: string | null;
  pageUrl: string;
  fetchOg?: boolean;
  category?: Category;
}): Promise<string | null> {
  const source = usableArticleImageUrl(params.sourceImageUrl);

  if (source && !isStockFallback(source)) {
    return source;
  }

  if (params.fetchOg !== false) {
    const og = await fetchOgImage(params.pageUrl);
    const usableOg = usableArticleImageUrl(og);
    if (usableOg) return usableOg;
  }

  if (source) {
    return source;
  }

  if (params.category) {
    if (prefersCategoryPlaceholder(params.category)) {
      return null;
    }
    return CATEGORY_FALLBACK_IMAGE[params.category] ?? CATEGORY_FALLBACK_IMAGE.tech;
  }

  return null;
}

/** Stock photos (Unsplash) — last resort when RSS/og:image unavailable */
export const CATEGORY_FALLBACK_IMAGE: Record<Category, string> = {
  tech:
    "https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&h=630&fit=crop&q=80",
  it: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1200&h=630&fit=crop&q=80",
  gaming:
    "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1200&h=630&fit=crop&q=80",
  ai: "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=1200&h=630&fit=crop&q=80",
  sport:
    "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=1200&h=630&fit=crop&q=80",
  finance:
    "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1200&h=630&fit=crop&q=80",
};

export const CATEGORY_PLACEHOLDER: Record<
  Category,
  { gradient: string; accent: string; label: string }
> = {
  tech: {
    gradient: "from-slate-800 via-blue-900 to-cyan-800",
    accent: "text-cyan-200",
    label: "Tech",
  },
  it: {
    gradient: "from-zinc-900 via-slate-800 to-emerald-900",
    accent: "text-emerald-200",
    label: "IT",
  },
  gaming: {
    gradient: "from-violet-900 via-purple-800 to-fuchsia-700",
    accent: "text-fuchsia-200",
    label: "Gry",
  },
  ai: {
    gradient: "from-indigo-950 via-violet-900 to-blue-800",
    accent: "text-indigo-200",
    label: "AI",
  },
  sport: {
    gradient: "from-emerald-900 via-green-800 to-lime-700",
    accent: "text-lime-200",
    label: "Sport",
  },
  finance: {
    gradient: "from-amber-900 via-orange-800 to-yellow-700",
    accent: "text-amber-100",
    label: "Finanse",
  },
};
