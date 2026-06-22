import type { Category } from "@/lib/types";
import { fetchOgImage } from "@/lib/sources/og-image";
import { isValidImageUrl } from "@/lib/sources/extract-image";

export async function resolveArticleImageUrl(params: {
  sourceImageUrl?: string | null;
  pageUrl: string;
  fetchOg?: boolean;
  category?: Category;
}): Promise<string | null> {
  if (isValidImageUrl(params.sourceImageUrl)) {
    return params.sourceImageUrl.trim();
  }

  if (params.fetchOg !== false) {
    const og = await fetchOgImage(params.pageUrl);
    if (isValidImageUrl(og)) return og;
  }

  if (params.category) {
    return CATEGORY_FALLBACK_IMAGE[params.category] ?? CATEGORY_FALLBACK_IMAGE.technology;
  }

  return null;
}

/** Stock photos (Unsplash) — last resort when RSS/og:image unavailable */
export const CATEGORY_FALLBACK_IMAGE: Record<Category, string> = {
  technology:
    "https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&h=630&fit=crop&q=80",
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
  technology: {
    gradient: "from-slate-800 via-blue-900 to-cyan-800",
    accent: "text-cyan-200",
    label: "Technologia",
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
