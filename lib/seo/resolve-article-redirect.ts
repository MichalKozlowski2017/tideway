import { categoryPath } from "@/lib/i18n/config";
import { getSupabaseAdmin, hasSupabaseConfig } from "@/lib/db/supabase";
import { getStoredArticleRedirectSlug } from "@/lib/seo/article-redirect-store";
import { ARTICLE_SLUG_REDIRECTS } from "@/lib/seo/article-redirects";
import { categorySlug, type Category, type Locale } from "@/lib/types";

export type ArticleRedirectTarget =
  | { kind: "article"; slug: string }
  | { kind: "category"; category: Category };

const NUMERIC_SUFFIX = /-\d+$/;

async function findPublishedSlug(
  locale: Locale,
  slug: string,
): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("articles")
    .select("slug")
    .eq("locale", locale)
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();

  if (error) throw error;
  return data?.slug ?? null;
}

/** When `foo` 404s but `foo-1` exists (ensureUniqueSlug), send users to the live URL. */
async function resolveNumericSuffixFallback(
  locale: Locale,
  slug: string,
): Promise<string | null> {
  if (NUMERIC_SUFFIX.test(slug)) return null;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("articles")
    .select("slug")
    .eq("locale", locale)
    .eq("is_published", true)
    .like("slug", `${slug}-%`)
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data?.slug ?? null;
}

export async function resolveArticleRedirectSlug(
  locale: Locale,
  slug: string,
  options?: { skipStatic?: boolean },
): Promise<ArticleRedirectTarget | null> {
  if (!options?.skipStatic) {
    const staticTarget = ARTICLE_SLUG_REDIRECTS[slug];
    if (staticTarget) {
      const live = await findPublishedSlug(locale, staticTarget);
      if (live) return { kind: "article", slug: live };
    }
  }

  const storedTarget = await getStoredArticleRedirectSlug(locale, slug);
  if (storedTarget) {
    const live = await findPublishedSlug(locale, storedTarget);
    if (live) return { kind: "article", slug: live };
  }

  if (!hasSupabaseConfig()) return null;

  const suffixTarget = await resolveNumericSuffixFallback(locale, slug);
  if (suffixTarget) {
    return { kind: "article", slug: suffixTarget };
  }

  const supabase = getSupabaseAdmin();
  const { data: dead, error } = await supabase
    .from("articles")
    .select("slug, category, source_item_ids")
    .eq("locale", locale)
    .eq("slug", slug)
    .eq("is_published", false)
    .maybeSingle();

  if (error) throw error;
  if (!dead) return null;

  const sourceId = dead.source_item_ids?.[0];
  if (sourceId) {
    const { data: published, error: pubError } = await supabase
      .from("articles")
      .select("slug")
      .eq("locale", locale)
      .eq("is_published", true)
      .contains("source_item_ids", [sourceId])
      .order("published_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pubError) throw pubError;
    if (published?.slug) {
      return { kind: "article", slug: published.slug };
    }
  }

  const category = dead.category as Category;
  if (category) {
    return { kind: "category", category };
  }

  return null;
}

export function articleRedirectPath(
  locale: Locale,
  target: ArticleRedirectTarget,
): string {
  if (target.kind === "article") {
    return locale === "pl"
      ? `/artykul/${target.slug}`
      : `/en/article/${target.slug}`;
  }
  return categoryPath(locale, categorySlug(locale, target.category));
}
