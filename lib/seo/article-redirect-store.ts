import { getSupabaseAdmin, hasSupabaseConfig } from "@/lib/db/supabase";
import type { Locale } from "@/lib/types";

export async function recordArticleSlugRedirect(
  locale: Locale,
  fromSlug: string,
  toSlug: string,
): Promise<void> {
  if (!hasSupabaseConfig() || fromSlug === toSlug) return;

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("article_slug_redirects").upsert(
    {
      locale,
      from_slug: fromSlug,
      to_slug: toSlug,
    },
    { onConflict: "locale,from_slug" },
  );

  if (error?.code === "PGRST205") return;
  if (error) throw error;
}

export async function getStoredArticleRedirectSlug(
  locale: Locale,
  slug: string,
): Promise<string | null> {
  if (!hasSupabaseConfig()) return null;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("article_slug_redirects")
    .select("to_slug")
    .eq("locale", locale)
    .eq("from_slug", slug)
    .maybeSingle();

  if (error?.code === "PGRST205") return null;
  if (error) throw error;
  return data?.to_slug ?? null;
}
