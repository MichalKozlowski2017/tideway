import OpenAI from "openai";
import { formatForSourceType } from "@/lib/ai/article-body";
import type { ArticleFormat } from "@/lib/ai/article-body";
import { buildDigestPrompt, buildSingleArticlePrompt } from "@/lib/ai/prompts";
import {
  digestResponseSchema,
  normalizeGeneratedArticle,
  type DigestArticle,
  type GeneratedArticle,
} from "@/lib/ai/schemas";
import { getSupabaseAdmin } from "@/lib/db/supabase";
import {
  buildSourceLabel,
  isArticleSourceType,
} from "@/lib/sources/source-label";
import type { Article, Category, Locale, RawItem, Source } from "@/lib/types";
import { GENERATION_CATEGORIES } from "@/lib/types";
import { resolveArticleImageUrl, CATEGORY_FALLBACK_IMAGE } from "@/lib/articles/resolve-image";
import { articlePublicUrl, notifyIndexNow } from "@/lib/seo/indexnow";
import { shouldSkipAfterGenerationFailure } from "@/lib/sources/locale-filter";
import { contentHash, slugify } from "@/lib/utils/hash";

const BATCH_SIZE = 8;
const PENDING_POOL_SIZE = 250;
const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
const MAX_GENERATION_ATTEMPTS = 2;

type PendingItem = RawItem & {
  sources: Pick<Source, "category" | "locale" | "type" | "config">;
};

function getOpenAI(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");
  return new OpenAI({ apiKey });
}

async function callOpenAI(
  prompt: string,
): Promise<{ content: string; tokensUsed: number }> {
  const openai = getOpenAI();
  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0.75,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("Empty AI response");

  return {
    content,
    tokensUsed: response.usage?.total_tokens ?? 0,
  };
}

async function ensureUniqueSlug(
  locale: string,
  baseSlug: string,
): Promise<string> {
  const supabase = getSupabaseAdmin();
  let slug = baseSlug;
  let suffix = 1;

  while (true) {
    const { data } = await supabase
      .from("articles")
      .select("id")
      .eq("slug", slug)
      .eq("locale", locale)
      .maybeSingle();

    if (!data) return slug;
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

async function hasExistingArticle(
  item: PendingItem,
): Promise<boolean> {
  const supabase = getSupabaseAdmin();

  const { data: byHash } = await supabase
    .from("raw_items")
    .select("id")
    .eq("content_hash", item.content_hash)
    .eq("status", "processed")
    .neq("id", item.id)
    .limit(1);

  if (byHash?.length) return true;

  const { data: byUrl } = await supabase
    .from("raw_items")
    .select("id")
    .eq("url", item.url)
    .eq("status", "processed")
    .neq("id", item.id)
    .limit(1);

  return (byUrl?.length ?? 0) > 0;
}

function selectBatch(items: PendingItem[]): PendingItem[] {
  const rss = items
    .filter((i) => i.sources.type === "rss")
    .sort(
      (a, b) =>
        new Date(b.published_at ?? b.fetched_at).getTime() -
        new Date(a.published_at ?? a.fetched_at).getTime(),
    );

  const byCategory = new Map<string, PendingItem[]>();
  for (const item of rss) {
    const cat = item.sources.category;
    const list = byCategory.get(cat) ?? [];
    list.push(item);
    byCategory.set(cat, list);
  }

  const batch: PendingItem[] = [];

  const takeFrom = (category: string): boolean => {
    const list = byCategory.get(category);
    if (!list?.length) return false;
    const item = list.shift()!;
    byCategory.set(category, list);
    batch.push(item);
    return true;
  };

  // AI backlog: up to 2 slots when items are available
  if (byCategory.get("ai")?.length) {
    takeFrom("ai");
    if (batch.length < BATCH_SIZE && byCategory.get("ai")?.length) {
      takeFrom("ai");
    }
  }

  // One slot per remaining category (sport, finance, gaming, technology)
  for (const cat of GENERATION_CATEGORIES) {
    if (batch.length >= BATCH_SIZE) break;
    if (cat === "ai") continue;
    takeFrom(cat);
  }

  // Fill remaining slots — prefer categories with backlog
  while (batch.length < BATCH_SIZE) {
    let added = false;
    for (const cat of [...GENERATION_CATEGORIES].reverse()) {
      if (batch.length >= BATCH_SIZE) break;
      if (takeFrom(cat)) added = true;
    }
    if (!added) break;
  }

  return batch;
}

export async function generatePendingArticles(): Promise<{
  generated: number;
  tokensUsed: number;
  skippedTrends: number;
  skippedDuplicates: number;
}> {
  const supabase = getSupabaseAdmin();

  const { data: pending, error } = await supabase
    .from("raw_items")
    .select("*, sources(category, locale, type, config)")
    .eq("status", "pending")
    .order("fetched_at", { ascending: false })
    .limit(PENDING_POOL_SIZE);

  if (error) throw error;
  if (!pending?.length) {
    console.log("Brak pending items — nic do wygenerowania.");
    return { generated: 0, tokensUsed: 0, skippedTrends: 0, skippedDuplicates: 0 };
  }

  const items = (pending as PendingItem[]).filter((item) =>
    isArticleSourceType(item.sources.type),
  );

  let skippedTrends = 0;
  let skippedDuplicates = 0;

  for (const item of pending as PendingItem[]) {
    if (!isArticleSourceType(item.sources.type)) {
      await supabase
        .from("raw_items")
        .update({ status: "skipped" })
        .eq("id", item.id);
      skippedTrends += 1;
    }
  }

  const eligible: PendingItem[] = [];
  for (const item of items) {
    if (await hasExistingArticle(item)) {
      await supabase
        .from("raw_items")
        .update({ status: "skipped" })
        .eq("id", item.id);
      skippedDuplicates += 1;
      continue;
    }
    eligible.push(item);
  }

  const batch = selectBatch(eligible);

  if (!batch.length) {
    return { generated: 0, tokensUsed: 0, skippedTrends, skippedDuplicates };
  }

  console.log(
    `Batch: ${batch.length} artykułów (z ${eligible.length} pending, ${skippedDuplicates} duplikatów pominiętych)…`,
  );

  const grouped = new Map<string, PendingItem[]>();

  for (const item of batch) {
    const key = `${item.sources.locale}:${item.sources.category}`;
    const list = grouped.get(key) ?? [];
    list.push(item);
    grouped.set(key, list);
  }

  let generated = 0;
  let tokensUsed = 0;
  const indexNowUrls: string[] = [];

  for (const [key, groupItems] of grouped) {
    const [locale, category] = key.split(":") as [Locale, Category];

    for (const rawItem of groupItems) {
      const articleFormat = formatForSourceType(
        rawItem.sources.type,
        rawItem.sources.category,
      );
      let generatedItem: GeneratedArticle | null = null;
      let attemptTokens = 0;

      console.log(
        `→ ${rawItem.title.slice(0, 70)}… [${articleFormat}, ${rawItem.sources.type}]`,
      );

      for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
        if (attempt > 0) {
          console.log(`  retry ${attempt + 1}/${MAX_GENERATION_ATTEMPTS}…`);
        }
        const prompt = buildSingleArticlePrompt(
          locale,
          category,
          {
            title: rawItem.title,
            description: rawItem.description ?? "",
            url: rawItem.url,
            sourceLabel: buildSourceLabel(rawItem.sources),
            sourceType: rawItem.sources.type,
            engagementScore: Number(rawItem.engagement_score),
          },
          articleFormat,
          { strictLocale: attempt > 0 },
        );

        const { content, tokensUsed: used } = await callOpenAI(prompt);
        attemptTokens += used;

        const normalized = normalizeGeneratedArticle(
          JSON.parse(content),
          rawItem.title,
          locale,
          articleFormat,
        );

        if (normalized) {
          generatedItem = normalized;
          break;
        }
      }

      tokensUsed += attemptTokens;

      if (!generatedItem) {
        const skip = shouldSkipAfterGenerationFailure(rawItem.title, locale);
        console.log(
          skip
            ? "  ✗ pominięto (źródło EN, walidacja PL)"
            : "  ✗ odrzucono (walidacja lub API)",
        );
        await supabase
          .from("raw_items")
          .update({ status: skip ? "skipped" : "failed" })
          .eq("id", rawItem.id);
        continue;
      }

      const baseSlug = slugify(generatedItem.slug_hint || rawItem.title);
      const slug = await ensureUniqueSlug(locale, baseSlug);

      const imageUrl =
        (await resolveArticleImageUrl({
          sourceImageUrl: rawItem.image_url,
          pageUrl: rawItem.url,
          category,
        })) ?? CATEGORY_FALLBACK_IMAGE[category];

      const { error: articleError } = await supabase.from("articles").insert({
        slug,
        locale,
        category,
        article_type: "trend_item",
        seo_title: generatedItem.seo_title,
        seo_description: generatedItem.seo_description,
        headline: generatedItem.headline,
        lead: generatedItem.lead,
        image_url: imageUrl,
        summary: {
          format: generatedItem.format,
          body: generatedItem.body,
          highlights: generatedItem.highlights,
          contextNote: generatedItem.context_note,
          sectionTitles: generatedItem.section_titles,
        },
        why_it_matters: generatedItem.why_it_matters,
        tags: generatedItem.tags,
        source_item_ids: [rawItem.id],
        is_published: true,
      });

      if (articleError) {
        await supabase
          .from("raw_items")
          .update({ status: "failed" })
          .eq("id", rawItem.id);
        continue;
      }

      await supabase
        .from("raw_items")
        .update({ status: "processed" })
        .eq("id", rawItem.id);

      generated += 1;
      indexNowUrls.push(articlePublicUrl(locale, slug));
      console.log(`  ✓ ${slug}`);
    }
  }

  await notifyIndexNow(indexNowUrls);

  return { generated, tokensUsed, skippedTrends, skippedDuplicates };
}

export async function generateDigest(
  locale: Locale,
  digestType: "daily" | "weekly",
  category: string,
): Promise<Article | null> {
  const supabase = getSupabaseAdmin();
  const since = new Date();
  if (digestType === "daily") {
    since.setDate(since.getDate() - 1);
  } else {
    since.setDate(since.getDate() - 7);
  }

  const { data: recent } = await supabase
    .from("articles")
    .select("headline, image_url")
    .eq("locale", locale)
    .eq("category", category)
    .eq("article_type", "trend_item")
    .gte("published_at", since.toISOString())
    .order("published_at", { ascending: false })
    .limit(15);

  if (!recent?.length) return null;

  const digestImageUrl =
    recent.find((a) => a.image_url)?.image_url ??
    CATEGORY_FALLBACK_IMAGE[category as Category] ??
    CATEGORY_FALLBACK_IMAGE.technology;

  const prompt = buildDigestPrompt(
    locale,
    digestType,
    category,
    recent.map((a) => a.headline),
  );

  const { content } = await callOpenAI(prompt);
  const digest: DigestArticle = digestResponseSchema.parse(JSON.parse(content));

  const articleType = digestType === "daily" ? "daily_digest" : "weekly_digest";
  const prefix = digestType === "daily" ? "dzienny" : "tygodniowy";
  const baseSlug = slugify(
    `${prefix}-${category}-${new Date().toISOString().slice(0, 10)}`,
  );
  const slug = await ensureUniqueSlug(locale, baseSlug);

  const { data: article, error } = await supabase
    .from("articles")
    .insert({
      slug,
      locale,
      category,
      article_type: articleType,
      seo_title: digest.seo_title,
      seo_description: digest.seo_description,
      headline: digest.headline,
      lead: digest.lead,
      image_url: digestImageUrl,
      summary: digest.bullet_points,
      why_it_matters: digest.why_it_matters,
      tags: digest.tags,
      source_item_ids: [],
      is_published: true,
    })
    .select()
    .single();

  if (error || !article) return null;

  await notifyIndexNow([articlePublicUrl(locale, slug)]);

  await supabase.from("daily_rollups").upsert(
    {
      locale,
      rollup_type: digestType,
      period_date: new Date().toISOString().slice(0, 10),
      article_id: article.id,
      metrics: {
        rising: digest.rising ?? [],
        falling: digest.falling ?? [],
      },
    },
    { onConflict: "locale,rollup_type,period_date" },
  );

  return article as Article;
}

export async function startJob(jobType: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("generation_jobs")
    .insert({ job_type: jobType, status: "running" })
    .select()
    .single();
  return data;
}

export async function finishJob(
  jobId: string,
  status: "completed" | "failed",
  itemsProcessed: number,
  tokensUsed: number,
  error?: string,
) {
  const supabase = getSupabaseAdmin();
  await supabase
    .from("generation_jobs")
    .update({
      status,
      finished_at: new Date().toISOString(),
      items_processed: itemsProcessed,
      tokens_used: tokensUsed,
      error: error ?? null,
    })
    .eq("id", jobId);
}

// Re-export for dedup utility used elsewhere
export { contentHash };
