import OpenAI from "openai";
import {
  isGuideCandidate,
  isListCandidate,
  resolveArticleFormat,
  type ArticleFormat,
} from "@/lib/ai/article-body";
import { findSynthesisCluster } from "@/lib/ai/cluster-items";
import { pickEditorialAngle } from "@/lib/ai/editorial-angle";
import {
  buildDigestPrompt,
  buildSingleArticlePrompt,
  buildSynthesisPrompt,
  buildTrendArticlePrompt,
  type PromptItem,
} from "@/lib/ai/prompts";
import { QUALITY_MIN_SCORE, scoreArticleQuality } from "@/lib/ai/quality-gate";
import {
  detectSearchIntent,
  formatForSearchIntent,
  intentPriority,
  isHighIntentQuery,
  isSportQuizCandidate,
  pickTrendArticleFormat,
} from "@/lib/ai/search-intent";
import {
  digestResponseSchema,
  normalizeGeneratedArticle,
  type DigestArticle,
  type GeneratedArticle,
} from "@/lib/ai/schemas";
import { getSupabaseAdmin } from "@/lib/db/supabase";
import {
  ARTICLE_SOURCE_PRIORITY,
  buildSourceLabel,
  isArticleSourceType,
  isTrendSourceType,
} from "@/lib/sources/source-label";
import { buildTrendContext } from "@/lib/sources/trend-context";
import type { Article, Category, Locale, RawItem, Source } from "@/lib/types";
import { GENERATION_CATEGORIES } from "@/lib/types";
import { inferArticleCategory } from "@/lib/categories/infer-category";
import { resolveArticleImageUrl, CATEGORY_FALLBACK_IMAGE } from "@/lib/articles/resolve-image";
import { articlePublicUrl, notifyIndexNow } from "@/lib/seo/indexnow";
import { shouldSkipAfterGenerationFailure } from "@/lib/sources/locale-filter";
import { enrichDescription } from "@/lib/sources/enrich-description";
import { contentHash, slugify } from "@/lib/utils/hash";

const BATCH_SIZE = 4;
const PENDING_POOL_SIZE = 250;
const PENDING_FETCH_SIZE = 500;
const AI_POOL_MIN = 50;
const GAMING_POOL_MIN = 45;
const CATEGORY_POOL_MIN = 30;
const AI_BATCH_SLOTS = 1;
const GAMING_BATCH_SLOTS = 1;
const TREND_BATCH_SLOTS = 1;
const INTENT_BATCH_SLOTS = 1;
const TREND_CANDIDATE_LIMIT = 12;
const TREND_MAX_AGE_MS = 48 * 60 * 60 * 1000;
const MIN_TREND_CONTEXT_MATCHES = 1;
const CLICKABLE_CATEGORIES = new Set<Category>(["sport", "gaming"]);
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
    temperature: 0.65,
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

async function hasRecentTrendArticle(
  query: string,
  locale: string,
): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const base = slugify(query);
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("articles")
    .select("id")
    .eq("locale", locale)
    .gte("published_at", since)
    .or(`slug.eq.${base},slug.ilike.${base}-%`)
    .limit(1);

  return (data?.length ?? 0) > 0;
}

async function hasQuizPublishedToday(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  locale: Locale,
): Promise<boolean> {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const { data } = await supabase
    .from("articles")
    .select("summary")
    .eq("locale", locale)
    .eq("article_type", "trend_item")
    .gte("published_at", start.toISOString())
    .limit(30);

  return (data ?? []).some((row) => {
    const summary = row.summary as { format?: string; quiz?: unknown[] } | null;
    return summary?.format === "quiz" || (summary?.quiz?.length ?? 0) > 0;
  });
}

function sortPendingItems(items: PendingItem[]): PendingItem[] {
  return [...items].sort((a, b) => {
    const dateDiff =
      new Date(b.published_at ?? b.fetched_at).getTime() -
      new Date(a.published_at ?? a.fetched_at).getTime();
    if (dateDiff !== 0) return dateDiff;

    const priorityA = ARTICLE_SOURCE_PRIORITY[a.sources.type] ?? 5;
    const priorityB = ARTICLE_SOURCE_PRIORITY[b.sources.type] ?? 5;
    return priorityA - priorityB;
  });
}

function buildBalancedPool(items: PendingItem[]): PendingItem[] {
  const articleItems = items.filter((item) =>
    isArticleSourceType(item.sources.type),
  );
  const byCategory = new Map<string, PendingItem[]>();

  for (const item of articleItems) {
    const cat = item.sources.category;
    const list = byCategory.get(cat) ?? [];
    list.push(item);
    byCategory.set(cat, list);
  }

  for (const [cat, list] of byCategory) {
    byCategory.set(cat, sortPendingItems(list));
  }

  const pool: PendingItem[] = [];
  const usedIds = new Set<string>();

  const takeFromCategory = (category: string, count: number) => {
    const list = byCategory.get(category) ?? [];
    const remaining: PendingItem[] = [];
    let taken = 0;

    for (const item of list) {
      if (taken < count && !usedIds.has(item.id)) {
        pool.push(item);
        usedIds.add(item.id);
        taken += 1;
      } else {
        remaining.push(item);
      }
    }

    byCategory.set(category, remaining);
  };

  takeFromCategory("ai", AI_POOL_MIN);
  takeFromCategory("gaming", GAMING_POOL_MIN);
  for (const cat of GENERATION_CATEGORIES) {
    if (cat === "ai" || cat === "gaming") continue;
    takeFromCategory(cat, CATEGORY_POOL_MIN);
  }

  const remainder = sortPendingItems(
    [...byCategory.values()].flat().filter((item) => !usedIds.has(item.id)),
  );

  for (const item of remainder) {
    if (pool.length >= PENDING_POOL_SIZE) break;
    pool.push(item);
    usedIds.add(item.id);
  }

  return pool;
}

function selectBatch(items: PendingItem[], maxSize = BATCH_SIZE): PendingItem[] {
  const sorted = sortPendingItems(items);
  const byCategory = new Map<string, PendingItem[]>();

  for (const item of sorted) {
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

  for (let i = 0; i < AI_BATCH_SLOTS && batch.length < maxSize; i += 1) {
    if (!byCategory.get("ai")?.length) break;
    takeFrom("ai");
  }

  for (let i = 0; i < GAMING_BATCH_SLOTS && batch.length < maxSize; i += 1) {
    if (!byCategory.get("gaming")?.length) break;
    takeFrom("gaming");
  }

  for (const cat of GENERATION_CATEGORIES) {
    if (batch.length >= maxSize) break;
    if (cat === "ai" || cat === "gaming") continue;
    takeFrom(cat);
  }

  while (batch.length < maxSize) {
    let added = false;
    for (const cat of [...GENERATION_CATEGORIES].reverse()) {
      if (batch.length >= maxSize) break;
      if (cat === "ai" || cat === "gaming") continue;
      if (takeFrom(cat)) added = true;
    }
    if (!added) break;
  }

  return batch;
}

type GenerationWork =
  | { kind: "synthesis"; items: PendingItem[] }
  | { kind: "trend"; item: PendingItem; format?: ArticleFormat }
  | { kind: "single"; item: PendingItem; format?: ArticleFormat };

function isRssLongReadCandidate(item: PendingItem): boolean {
  return item.sources.type === "rss";
}

function pickGuaranteedLongReadFormat(item: PendingItem): ArticleFormat {
  const intent = detectSearchIntent(item.title, item.description);
  if (intent === "quiz") return "quiz";
  if (intent === "list" || isListCandidate(item.title, item.description)) {
    return "list";
  }
  if (intent === "guide" || isGuideCandidate(item.title, item.description)) {
    return "guide";
  }
  const n = item.id.charCodeAt(0) + item.id.charCodeAt(item.id.length - 1);
  return n % 2 === 0 ? "essay" : "analysis";
}

function formatForHighIntentItem(item: PendingItem): ArticleFormat {
  return formatForSearchIntent(
    detectSearchIntent(item.title, item.description),
    () => pickGuaranteedLongReadFormat(item),
  );
}

function highIntentScore(item: PendingItem): number {
  const intent = detectSearchIntent(item.title, item.description);
  const categoryBoost = CLICKABLE_CATEGORIES.has(
    item.sources.category as Category,
  )
    ? 2
    : 0;
  return intentPriority(intent) + categoryBoost;
}

function pickHighIntentItem(items: PendingItem[]): PendingItem | null {
  const candidates = items.filter((item) =>
    isHighIntentQuery(item.title, item.description),
  );
  if (!candidates.length) return null;

  return [...candidates].sort((a, b) => {
    const scoreDiff = highIntentScore(b) - highIntentScore(a);
    if (scoreDiff !== 0) return scoreDiff;
    return Number(b.engagement_score) - Number(a.engagement_score);
  })[0];
}

function pickBestTrendItem(
  items: PendingItem[],
  options?: { preferSportQuiz?: boolean },
): PendingItem | null {
  if (!items.length) return null;

  if (options?.preferSportQuiz) {
    const sportQuiz = items.filter(
      (item) =>
        item.sources.category === "sport" &&
        isSportQuizCandidate(item.title, item.description),
    );
    if (sportQuiz.length) {
      return sortPendingItems(sportQuiz)[0];
    }
  }

  return pickHighIntentItem(items) ?? sortPendingItems(items)[0];
}

function planGenerationWork(
  eligible: PendingItem[],
  trendEligible: PendingItem[],
  options?: { preferSportQuiz?: boolean },
): GenerationWork[] {
  const reserved = new Set<string>();
  const work: GenerationWork[] = [];

  const trend = pickBestTrendItem(trendEligible, options);
  if (trend) {
    const trendFormat =
      options?.preferSportQuiz &&
      trend.sources.category === "sport" &&
      isSportQuizCandidate(trend.title, trend.description)
        ? ("quiz" as const)
        : undefined;
    work.push({ kind: "trend", item: trend, format: trendFormat });
    reserved.add(trend.id);
  }

  const remainingAfterTrend = eligible.filter((item) => !reserved.has(item.id));
  const intentItem = pickHighIntentItem(remainingAfterTrend);
  if (intentItem && work.length < BATCH_SIZE) {
    work.push({
      kind: "single",
      item: intentItem,
      format: formatForHighIntentItem(intentItem),
    });
    reserved.add(intentItem.id);
  }

  const cluster =
    !intentItem &&
    findSynthesisCluster(
      eligible.filter((item) => !reserved.has(item.id)),
      reserved,
    );
  if (cluster) {
    work.push({ kind: "synthesis", items: cluster });
    for (const item of cluster) reserved.add(item.id);
  }

  const trendSlots = trend ? TREND_BATCH_SLOTS : 0;
  const intentSlots = intentItem ? INTENT_BATCH_SLOTS : 0;
  const maxSingles =
    (cluster ? BATCH_SIZE - 1 : BATCH_SIZE) - trendSlots - intentSlots;
  const remaining = eligible.filter((item) => !reserved.has(item.id));

  let longReadItem: PendingItem | null = null;
  if (!cluster && !intentItem) {
    const rssCandidates = sortPendingItems(
      remaining.filter(isRssLongReadCandidate),
    );
    const gamingGuideCandidates = rssCandidates.filter(
      (item) =>
        item.sources.category === "gaming" &&
        isGuideCandidate(item.title, item.description),
    );
    const guideCandidates = rssCandidates.filter((item) =>
      isGuideCandidate(item.title, item.description),
    );
    longReadItem =
      gamingGuideCandidates[0] ?? guideCandidates[0] ?? rssCandidates[0] ?? null;
    if (longReadItem) reserved.add(longReadItem.id);
  }

  const singles = selectBatch(
    remaining.filter((item) => !reserved.has(item.id)),
    longReadItem ? maxSingles - 1 : maxSingles,
  );

  if (longReadItem) {
    work.push({
      kind: "single",
      item: longReadItem,
      format: pickGuaranteedLongReadFormat(longReadItem),
    });
  }

  for (const item of singles) {
    work.push({ kind: "single", item });
  }

  return work;
}

function toPromptItem(item: PendingItem, description: string): PromptItem {
  return {
    title: item.title,
    description,
    url: item.url,
    sourceLabel: buildSourceLabel(item.sources),
    sourceType: item.sources.type,
    engagementScore: Number(item.engagement_score),
  };
}

async function enrichSourceText(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  rawItem: PendingItem,
): Promise<string> {
  let sourceText = rawItem.description ?? "";
  if (sourceText.length < 200) {
    const enriched = await enrichDescription({
      description: sourceText,
      url: rawItem.url,
    });
    if (enriched.length > sourceText.length) {
      sourceText = enriched;
      await supabase
        .from("raw_items")
        .update({ description: enriched })
        .eq("id", rawItem.id);
    }
  }
  return sourceText;
}

async function generateArticleDraft(params: {
  locale: Locale;
  category: Category;
  format: ArticleFormat;
  buildPrompt: (strictLocale: boolean) => string;
  fallbackTitle: string;
  sourceText: string;
}): Promise<{ article: GeneratedArticle | null; tokensUsed: number }> {
  let tokensUsed = 0;

  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
    if (attempt > 0) {
      console.log(`  retry ${attempt + 1}/${MAX_GENERATION_ATTEMPTS}…`);
    }

    const { content, tokensUsed: used } = await callOpenAI(
      params.buildPrompt(attempt > 0),
    );
    tokensUsed += used;

    const normalized = normalizeGeneratedArticle(
      JSON.parse(content),
      params.fallbackTitle,
      params.locale,
      params.format,
      { sourceText: params.sourceText },
    );

    if (!normalized) continue;

    if (attempt === 0) {
      return { article: normalized, tokensUsed };
    }

    const quality = await scoreArticleQuality(
      normalized,
      params.sourceText,
      params.locale,
    );
    tokensUsed += quality.tokensUsed;

    if (quality.score >= QUALITY_MIN_SCORE) {
      if (quality.score < 9) {
        console.log(`  quality ${quality.score}/10`);
      }
      return { article: normalized, tokensUsed };
    }

    console.log(`  ✗ quality ${quality.score}/10 — ${quality.reason}`);
  }

  return { article: null, tokensUsed };
}

async function publishArticle(params: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  locale: Locale;
  category: Category;
  generatedItem: GeneratedArticle;
  rawItems: PendingItem[];
  indexNowUrls: string[];
}): Promise<boolean> {
  const primary = params.rawItems[0];
  const sourceCategory = params.category;
  const category = inferArticleCategory({
    sourceCategory,
    sourceTitle: primary.title,
    sourceUrl: primary.url,
    headline: params.generatedItem.headline,
    lead: params.generatedItem.lead,
    tags: params.generatedItem.tags,
  });
  if (category !== sourceCategory) {
    console.log(`  ↪ kategoria ${sourceCategory} → ${category}`);
  }

  const baseSlug = slugify(
    params.generatedItem.slug_hint || primary.title,
  );
  const slug = await ensureUniqueSlug(params.locale, baseSlug);

  let imageUrl: string | null = null;
  for (const item of params.rawItems) {
    const candidate = await resolveArticleImageUrl({
      sourceImageUrl: item.image_url,
      pageUrl: item.url,
      category,
    });
    if (candidate) {
      imageUrl = candidate;
      break;
    }
  }
  if (!imageUrl) {
    imageUrl = await resolveArticleImageUrl({
      sourceImageUrl: null,
      pageUrl: primary.url,
      category,
    });
  }

  const { error: articleError } = await params.supabase.from("articles").insert({
    slug,
    locale: params.locale,
    category,
    article_type: "trend_item",
    seo_title: params.generatedItem.seo_title,
    seo_description: params.generatedItem.seo_description,
    headline: params.generatedItem.headline,
    lead: params.generatedItem.lead,
    image_url: imageUrl,
    summary: {
      format: params.generatedItem.format,
      body: params.generatedItem.format === "quiz" ? undefined : params.generatedItem.body,
      highlights:
        params.generatedItem.format === "quiz"
          ? undefined
          : params.generatedItem.highlights,
      contextNote: params.generatedItem.context_note,
      sectionTitles: params.generatedItem.section_titles,
      quiz: params.generatedItem.quiz_questions?.map((q) => ({
        prompt: q.prompt,
        options: q.options,
        correctIndex: q.correct_index as 0 | 1 | 2,
      })),
    },
    why_it_matters: params.generatedItem.why_it_matters,
    tags: params.generatedItem.tags,
    source_item_ids: params.rawItems.map((item) => item.id),
    is_published: true,
  });

  if (articleError) {
    for (const item of params.rawItems) {
      await params.supabase
        .from("raw_items")
        .update({ status: "failed" })
        .eq("id", item.id);
    }
    return false;
  }

  for (const item of params.rawItems) {
    await params.supabase
      .from("raw_items")
      .update({ status: "processed" })
      .eq("id", item.id);
  }

  params.indexNowUrls.push(articlePublicUrl(params.locale, slug));
  console.log(`  ✓ ${slug}`);
  return true;
}

function workItemIds(work: GenerationWork[]): Set<string> {
  const ids = new Set<string>();
  for (const job of work) {
    if (job.kind === "synthesis") {
      for (const item of job.items) ids.add(item.id);
    } else if (job.kind === "trend" || job.kind === "single") {
      ids.add(job.item.id);
    }
  }
  return ids;
}

async function generateAndPublishTrend(params: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  rawItem: PendingItem;
  formatOverride?: ArticleFormat;
  indexNowUrls: string[];
}): Promise<{ published: boolean; tokensUsed: number }> {
  const locale = params.rawItem.sources.locale as Locale;
  const category = params.rawItem.sources.category as Category;
  const query = params.rawItem.title;
  const intent = detectSearchIntent(query, params.rawItem.description);
  const articleFormat =
    params.formatOverride ?? pickTrendArticleFormat(query, category);

  const { description: context, matches } = await buildTrendContext(
    params.supabase,
    {
      query,
      category,
    },
  );

  const canGenerateWithoutContext =
    articleFormat === "quiz" ||
    intent !== "news" ||
    isSportQuizCandidate(query, params.rawItem.description);

  if (
    matches.length < MIN_TREND_CONTEXT_MATCHES &&
    !canGenerateWithoutContext
  ) {
    console.log("  ⊘ trend bez kontekstu źródeł — skip");
    await params.supabase
      .from("raw_items")
      .update({ status: "skipped" })
      .eq("id", params.rawItem.id);
    return { published: false, tokensUsed: 0 };
  }

  await params.supabase
    .from("raw_items")
    .update({ description: context })
    .eq("id", params.rawItem.id);

  const angle = pickEditorialAngle(
    category,
    articleFormat,
    params.rawItem.id,
    context.length,
  );

  console.log(
    `→ [trend] ${query.slice(0, 70)}… [${articleFormat}, ${intent}, score ${params.rawItem.engagement_score}]`,
  );

  const { article: generatedItem, tokensUsed } = await generateArticleDraft({
    locale,
    category,
    format: articleFormat,
    buildPrompt: (strictLocale) =>
      buildTrendArticlePrompt(
        locale,
        category,
        query,
        context,
        articleFormat,
        { angle, strictLocale },
      ),
    fallbackTitle: query,
    sourceText: context,
  });

  if (!generatedItem) {
    console.log("  ✗ odrzucono trend (walidacja lub jakość)");
    await params.supabase
      .from("raw_items")
      .update({ status: "failed" })
      .eq("id", params.rawItem.id);
    return { published: false, tokensUsed };
  }

  const published = await publishArticle({
    supabase: params.supabase,
    locale,
    category,
    generatedItem,
    rawItems: [params.rawItem],
    indexNowUrls: params.indexNowUrls,
  });

  return { published, tokensUsed };
}

async function generateAndPublishSingle(params: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  rawItem: PendingItem;
  articleFormat: ArticleFormat;
  indexNowUrls: string[];
}): Promise<{ published: boolean; tokensUsed: number }> {
  const locale = params.rawItem.sources.locale as Locale;
  const category = params.rawItem.sources.category as Category;
  const sourceText = await enrichSourceText(params.supabase, params.rawItem);
  const angle = pickEditorialAngle(
    category,
    params.articleFormat,
    params.rawItem.id,
    sourceText.length,
  );

  console.log(
    `→ ${params.rawItem.title.slice(0, 70)}… [${params.articleFormat}${angle ? `, ${angle}` : ""}, ${params.rawItem.sources.type}, ${sourceText.length}ch]`,
  );

  const { article: generatedItem, tokensUsed } = await generateArticleDraft({
    locale,
    category,
    format: params.articleFormat,
    buildPrompt: (strictLocale) =>
      buildSingleArticlePrompt(
        locale,
        category,
        toPromptItem(params.rawItem, sourceText),
        params.articleFormat,
        { angle, strictLocale },
      ),
    fallbackTitle: params.rawItem.title,
    sourceText,
  });

  if (!generatedItem) {
    const skip = shouldSkipAfterGenerationFailure(params.rawItem.title, locale);
    console.log(
      skip
        ? "  ✗ pominięto (źródło EN, walidacja PL)"
        : "  ✗ odrzucono (walidacja, jakość lub API)",
    );
    await params.supabase
      .from("raw_items")
      .update({ status: skip ? "skipped" : "failed" })
      .eq("id", params.rawItem.id);
    return { published: false, tokensUsed };
  }

  const published = await publishArticle({
    supabase: params.supabase,
    locale,
    category,
    generatedItem,
    rawItems: [params.rawItem],
    indexNowUrls: params.indexNowUrls,
  });

  return { published, tokensUsed };
}

export async function generatePendingArticles(): Promise<{
  generated: number;
  tokensUsed: number;
  skippedTrends: number;
  skippedDuplicates: number;
  trendArticles: number;
}> {
  const supabase = getSupabaseAdmin();

  const { data: pending, error } = await supabase
    .from("raw_items")
    .select("*, sources(category, locale, type, config)")
    .eq("status", "pending")
    .order("fetched_at", { ascending: false })
    .limit(PENDING_FETCH_SIZE);

  if (error) throw error;
  if (!pending?.length) {
    console.log("Brak pending items — nic do wygenerowania.");
    return {
      generated: 0,
      tokensUsed: 0,
      skippedTrends: 0,
      skippedDuplicates: 0,
      trendArticles: 0,
    };
  }

  const allPending = pending as PendingItem[];
  const now = Date.now();
  let skippedTrends = 0;
  let skippedDuplicates = 0;

  for (const item of allPending) {
    if (!isTrendSourceType(item.sources.type)) continue;
    if (now - new Date(item.fetched_at).getTime() > TREND_MAX_AGE_MS) {
      await supabase
        .from("raw_items")
        .update({ status: "skipped" })
        .eq("id", item.id);
      skippedTrends += 1;
    }
  }

  const trendPending = allPending.filter(
    (item) =>
      isTrendSourceType(item.sources.type) &&
      now - new Date(item.fetched_at).getTime() <= TREND_MAX_AGE_MS,
  );
  const articlePending = allPending.filter((item) =>
    isArticleSourceType(item.sources.type),
  );

  const pool = buildBalancedPool(articlePending);
  const items = pool;

  const trendEligible: PendingItem[] = [];
  for (const item of sortPendingItems(trendPending)) {
    const locale = item.sources.locale;
    if (await hasExistingArticle(item)) {
      await supabase
        .from("raw_items")
        .update({ status: "skipped" })
        .eq("id", item.id);
      skippedDuplicates += 1;
      continue;
    }
    if (await hasRecentTrendArticle(item.title, locale)) {
      await supabase
        .from("raw_items")
        .update({ status: "skipped" })
        .eq("id", item.id);
      skippedDuplicates += 1;
      continue;
    }
    trendEligible.push(item);
    if (trendEligible.length >= TREND_CANDIDATE_LIMIT) break;
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

  const quizPublishedToday = await hasQuizPublishedToday(supabase, "pl");
  const work = planGenerationWork(eligible, trendEligible, {
    preferSportQuiz: !quizPublishedToday,
  });

  if (!work.length) {
    return {
      generated: 0,
      tokensUsed: 0,
      skippedTrends,
      skippedDuplicates,
      trendArticles: 0,
    };
  }

  const aiInBatch = work.filter(
    (job) =>
      job.kind === "single"
        ? job.item.sources.category === "ai"
        : job.kind === "synthesis"
          ? job.items[0]?.sources.category === "ai"
          : false,
  ).length;
  const longReadSlots = work.filter(
    (job) =>
      job.kind === "synthesis" ||
      job.kind === "trend" ||
      (job.kind === "single" && job.format !== undefined),
  ).length;
  const intentSlots = work.filter(
    (job) =>
      job.kind === "single" &&
      job.format !== undefined &&
      isHighIntentQuery(job.item.title, job.item.description),
  ).length;
  console.log(
    `Batch: ${work.length} zadań (trendy: ${work.filter((j) => j.kind === "trend").length}, intencja: ${intentSlots}, AI: ${aiInBatch}, długie: ${longReadSlots}, syntezy: ${work.filter((j) => j.kind === "synthesis").length}, pula: ${pool.length}, eligible: ${eligible.length})…`,
  );

  let generated = 0;
  let trendArticles = 0;
  let tokensUsed = 0;
  let longReadPublished = false;
  const indexNowUrls: string[] = [];

  for (const job of work) {
    if (job.kind === "trend") {
      const { published, tokensUsed: used } = await generateAndPublishTrend({
        supabase,
        rawItem: job.item,
        formatOverride: job.format,
        indexNowUrls,
      });
      tokensUsed += used;
      if (published) {
        generated += 1;
        trendArticles += 1;
        longReadPublished = true;
      }
      continue;
    }

    if (job.kind === "synthesis") {
      const rawItems = job.items;
      const locale = rawItems[0].sources.locale as Locale;
      const category = rawItems[0].sources.category as Category;
      const articleFormat: ArticleFormat = "synthesis";

      const enriched = await Promise.all(
        rawItems.map(async (item) => ({
          item,
          text: await enrichSourceText(supabase, item),
        })),
      );
      const sourceText = enriched.map((entry) => entry.text).join("\n\n---\n\n");
      const angle = pickEditorialAngle(
        category,
        articleFormat,
        rawItems.map((item) => item.id).join(":"),
        sourceText.length,
      );

      console.log(
        `→ [synthesis ×${rawItems.length}] ${rawItems[0].title.slice(0, 50)}… [${angle ?? "context"}, ${sourceText.length}ch]`,
      );

      const { article: generatedItem, tokensUsed: used } =
        await generateArticleDraft({
          locale,
          category,
          format: articleFormat,
          buildPrompt: (strictLocale) =>
            buildSynthesisPrompt(
              locale,
              category,
              enriched.map((entry) => toPromptItem(entry.item, entry.text)),
              { angle, strictLocale },
            ),
          fallbackTitle: rawItems[0].title,
          sourceText,
        });
      tokensUsed += used;

      if (!generatedItem) {
        console.log("  ✗ odrzucono syntezę (walidacja lub jakość)");
        for (const item of rawItems) {
          await supabase
            .from("raw_items")
            .update({ status: "failed" })
            .eq("id", item.id);
        }
        continue;
      }

      if (
        await publishArticle({
          supabase,
          locale,
          category,
          generatedItem,
          rawItems,
          indexNowUrls,
        })
      ) {
        generated += 1;
        longReadPublished = true;
      }
      continue;
    }

    const articleFormat = job.format ?? resolveArticleFormat(job.item);
    const { published, tokensUsed: used } = await generateAndPublishSingle({
      supabase,
      rawItem: job.item,
      articleFormat,
      indexNowUrls,
    });
    tokensUsed += used;

    if (published) {
      generated += 1;
      if (job.format) longReadPublished = true;
    }
  }

  const hadLongReadSlot = work.some(
    (job) =>
      job.kind === "synthesis" ||
      job.kind === "trend" ||
      (job.kind === "single" && job.format !== undefined),
  );

  if (!longReadPublished && hadLongReadSlot) {
    const exclude = workItemIds(work);
    const backupPool = eligible.filter(
      (item) => isRssLongReadCandidate(item) && !exclude.has(item.id),
    );
    const backup =
      pickHighIntentItem(backupPool) ?? sortPendingItems(backupPool)[0];

    if (backup) {
      console.log("↻ backup długi materiał…");
      const { published, tokensUsed: used } = await generateAndPublishSingle({
        supabase,
        rawItem: backup,
        articleFormat: formatForHighIntentItem(backup),
        indexNowUrls,
      });
      tokensUsed += used;
      if (published) generated += 1;
    }
  }

  await notifyIndexNow(indexNowUrls);

  return { generated, tokensUsed, skippedTrends, skippedDuplicates, trendArticles };
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
    .select("headline, slug, image_url")
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
    CATEGORY_FALLBACK_IMAGE.tech;

  const prompt = buildDigestPrompt(locale, digestType, category, recent);

  const { content } = await callOpenAI(prompt);
  const digest: DigestArticle = digestResponseSchema.parse(JSON.parse(content));

  const digestSummary = {
    format: "digest" as const,
    items: digest.bullet_points.map((point) => ({
      text: point.text,
      slug: recent[point.source_index - 1]?.slug,
    })),
  };

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
      summary: digestSummary,
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

/** Generate one pending raw item by title match (local preview / targeted runs). */
export async function previewGenerateByTitle(
  titlePattern: string,
): Promise<{
  published: boolean;
  slug?: string;
  format?: ArticleFormat;
  tokensUsed: number;
}> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("raw_items")
    .select("*, sources(category, locale, type, config)")
    .eq("status", "pending")
    .ilike("title", `%${titlePattern}%`)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    console.log(`Brak pending item pasującego do: ${titlePattern}`);
    return { published: false, tokensUsed: 0 };
  }

  const rawItem = data as PendingItem;
  const articleFormat = formatForHighIntentItem(rawItem);
  const indexNowUrls: string[] = [];
  const { published, tokensUsed } = await generateAndPublishSingle({
    supabase,
    rawItem,
    articleFormat,
    indexNowUrls,
  });

  let slug: string | undefined;
  if (published) {
    const { data: article } = await supabase
      .from("articles")
      .select("slug")
      .eq("locale", rawItem.sources.locale)
      .order("published_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    slug = article?.slug;
    await notifyIndexNow(indexNowUrls);
  }

  return { published, slug, format: articleFormat, tokensUsed };
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
