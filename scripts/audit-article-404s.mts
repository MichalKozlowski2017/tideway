import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split(
  "\n",
)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  process.env[trimmed.slice(0, eq)] ??= trimmed.slice(eq + 1);
}

import { getSql } from "../lib/db/client.ts";
import { recordArticleSlugRedirect } from "../lib/seo/article-redirect-store.ts";
import { ARTICLE_SLUG_REDIRECTS } from "../lib/seo/article-redirects.ts";
import { resolveArticleRedirectSlug } from "../lib/seo/resolve-article-redirect.ts";

const writeRedirects = process.argv.includes("--write");
const backfillSuffix = process.argv.includes("--backfill-suffix");

async function main() {
  const sql = getSql();

  if (backfillSuffix) {
    const published = (await sql.query(
      `SELECT slug FROM articles WHERE locale = $1 AND is_published = true`,
      ["pl"],
    )) as Array<{ slug: string }>;

    const live = new Set(published.map((row) => row.slug));
    let suffixRedirects = 0;

    for (const slug of live) {
      const match = slug.match(/^(.+)-(\d+)$/);
      if (!match) continue;
      const base = match[1];
      if (live.has(base)) continue;
      await recordArticleSlugRedirect("pl", base, slug);
      suffixRedirects += 1;
    }

    console.log(`Backfilled ${suffixRedirects} numeric-suffix redirect(s).`);
  }

  const unpublished = (await sql.query(
    `SELECT slug, category, source_item_ids
     FROM articles
     WHERE locale = $1 AND is_published = false`,
    ["pl"],
  )) as Array<{
    slug: string;
    category: string;
    source_item_ids: string[];
  }>;

  const generated: Record<string, string> = { ...ARTICLE_SLUG_REDIRECTS };
  const unresolved: string[] = [];

  for (const article of unpublished) {
    const target = await resolveArticleRedirectSlug("pl", article.slug, {
      skipStatic: true,
    });
    if (target?.kind === "article") {
      generated[article.slug] = target.slug;
      await recordArticleSlugRedirect("pl", article.slug, target.slug);
    } else if (target?.kind === "category") {
      unresolved.push(`${article.slug} → category:${target.category}`);
    } else {
      unresolved.push(article.slug);
    }
  }

  const articleRedirects = Object.fromEntries(
    Object.entries(generated).filter(([, v]) => !v.startsWith("__category__:")),
  );

  console.log(`Unpublished articles: ${unpublished.length}`);
  console.log(`Static + generated article redirects: ${Object.keys(articleRedirects).length}`);
  console.log(`Unresolved (no article target): ${unresolved.length}`);
  if (unresolved.length) {
    console.log("\nUnresolved:");
    for (const slug of unresolved.slice(0, 30)) {
      console.log(`  - ${slug}`);
    }
    if (unresolved.length > 30) {
      console.log(`  … and ${unresolved.length - 30} more`);
    }
  }

  if (!writeRedirects) {
    console.log(
      "\nFlags: --write (refresh article-redirects.ts), --backfill-suffix (base → base-N)",
    );
    return;
  }

  const lines = Object.entries(articleRedirects)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([from, to]) => `  "${from}": "${to}",`);

  const content = `/**
 * Permanent redirects for unpublished duplicate or renamed article slugs.
 * Keeps link equity and clears GSC 404s after dedup cleanup.
 *
 * Regenerate: npx tsx scripts/audit-article-404s.mts --write
 */
export const ARTICLE_SLUG_REDIRECTS: Record<string, string> = {
${lines.join("\n")}
};

export function articleSlugRedirects(): Array<{
  source: string;
  destination: string;
  permanent: true;
}> {
  return Object.entries(ARTICLE_SLUG_REDIRECTS).map(([from, to]) => ({
    source: \`/artykul/\${from}\`,
    destination: \`/artykul/\${to}\`,
    permanent: true,
  }));
}
`;

  writeFileSync(resolve(process.cwd(), "lib/seo/article-redirects.ts"), content);
  console.log("\nWrote lib/seo/article-redirects.ts");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
