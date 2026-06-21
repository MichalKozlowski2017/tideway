import OpenAI from "openai";
import { buildBatchPrompt, buildDigestPrompt } from "@/lib/ai/prompts";
import {
  batchResponseSchema,
  digestResponseSchema,
  type DigestArticle,
  type GeneratedArticle,
} from "@/lib/ai/schemas";
import { getSupabaseAdmin } from "@/lib/db/supabase";
import type { Article, Locale, RawItem } from "@/lib/types";
import { contentHash, slugify } from "@/lib/utils/hash";

const BATCH_SIZE = 10;
const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

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
    temperature: 0.4,
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

export async function generatePendingArticles(): Promise<{
  generated: number;
  tokensUsed: number;
}> {
  const supabase = getSupabaseAdmin();

  const { data: pending, error } = await supabase
    .from("raw_items")
    .select("*, sources(category, locale, type, config)")
    .eq("status", "pending")
    .order("engagement_score", { ascending: false })
    .limit(BATCH_SIZE);

  if (error) throw error;
  if (!pending?.length) return { generated: 0, tokensUsed: 0 };

  const grouped = new Map<
    string,
    Array<RawItem & { sources: { category: string; locale: string } }>
  >();

  for (const item of pending as Array<
    RawItem & { sources: { category: string; locale: string } }
  >) {
    const key = `${item.sources.locale}:${item.sources.category}`;
    const list = grouped.get(key) ?? [];
    list.push(item);
    grouped.set(key, list);
  }

  let generated = 0;
  let tokensUsed = 0;

  for (const [key, items] of grouped) {
    const [locale, category] = key.split(":") as [Locale, string];

    const promptItems = items.map((item) => ({
      title: item.title,
      description: item.description ?? "",
      url: item.url,
      sourceLabel: item.url,
      engagementScore: Number(item.engagement_score),
    }));

    const prompt = buildBatchPrompt(locale, category, promptItems);
    const { content, tokensUsed: used } = await callOpenAI(prompt);
    tokensUsed += used;

    const parsed = batchResponseSchema.parse(JSON.parse(content));

    for (let i = 0; i < items.length; i += 1) {
      const rawItem = items[i];
      const generatedItem: GeneratedArticle =
        parsed.items[i] ?? parsed.items[parsed.items.length - 1];

      const baseSlug = slugify(generatedItem.slug_hint || rawItem.title);
      const slug = await ensureUniqueSlug(locale, baseSlug);

      const { error: articleError } = await supabase.from("articles").insert({
        slug,
        locale,
        category,
        article_type: "trend_item",
        seo_title: generatedItem.seo_title,
        seo_description: generatedItem.seo_description,
        headline: generatedItem.headline,
        lead: generatedItem.lead,
        summary: generatedItem.bullet_points,
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
    }
  }

  return { generated, tokensUsed };
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
    .select("headline")
    .eq("locale", locale)
    .eq("category", category)
    .eq("article_type", "trend_item")
    .gte("published_at", since.toISOString())
    .order("published_at", { ascending: false })
    .limit(15);

  if (!recent?.length) return null;

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
      summary: digest.bullet_points,
      why_it_matters: digest.why_it_matters,
      tags: digest.tags,
      source_item_ids: [],
      is_published: true,
    })
    .select()
    .single();

  if (error || !article) return null;

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
