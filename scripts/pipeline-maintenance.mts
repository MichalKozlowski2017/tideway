import { readFileSync } from "fs";
import { resolve } from "path";

for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  process.env[trimmed.slice(0, eq)] ??= trimmed.slice(eq + 1);
}

import { matchesLocale } from "../lib/ai/locale-check.ts";
import { getSupabaseAdmin } from "../lib/db/supabase.ts";
import { recordArticleSlugRedirect } from "../lib/seo/article-redirect-store.ts";
import { resolveArticleRedirectSlug } from "../lib/seo/resolve-article-redirect.ts";

console.log("Tideway — pipeline maintenance…\n");

const supabase = getSupabaseAdmin();

const { data: unpublished, error: unpublishedError } = await supabase
  .from("articles")
  .select("id")
  .eq("is_published", false);

if (unpublishedError) throw unpublishedError;

if (unpublished?.length) {
  for (const row of unpublished) {
    const { data: article } = await supabase
      .from("articles")
      .select("slug")
      .eq("id", row.id)
      .maybeSingle();

    if (!article?.slug) continue;

    const target = await resolveArticleRedirectSlug("pl", article.slug, {
      skipStatic: true,
    });
    if (target?.kind === "article") {
      await recordArticleSlugRedirect("pl", article.slug, target.slug);
    }
  }

  const ids = unpublished.map((a) => a.id);
  const { error: deleteError } = await supabase
    .from("articles")
    .delete()
    .in("id", ids);

  if (deleteError) throw deleteError;
  console.log(`Usunięto ${ids.length} nieopublikowanych artykułów.`);
} else {
  console.log("Brak nieopublikowanych artykułów.");
}

const { data: failed, error: failedError } = await supabase
  .from("raw_items")
  .select("id, title, sources(locale)")
  .eq("status", "failed");

if (failedError) throw failedError;

const toSkip =
  failed?.filter((row) => {
    const locale = (row.sources as { locale?: string } | null)?.locale ?? "pl";
    return locale === "pl" && !matchesLocale(row.title, "pl");
  }) ?? [];

if (toSkip.length) {
  const { error: skipError } = await supabase
    .from("raw_items")
    .update({ status: "skipped" })
    .in(
      "id",
      toSkip.map((r) => r.id),
    );

  if (skipError) throw skipError;
  console.log(`Przeklasyfikowano ${toSkip.length} failed → skipped (źródła EN).`);
} else {
  console.log("Brak failed EN do przeklasyfikowania.");
}

const statuses = ["pending", "processed", "failed", "skipped"] as const;
const counts: Record<string, number> = {};

for (const status of statuses) {
  const { count } = await supabase
    .from("raw_items")
    .select("*", { count: "exact", head: true })
    .eq("status", status);
  counts[status] = count ?? 0;
}

console.log("\nStan raw_items:", counts);
