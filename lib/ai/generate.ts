import { describeAiSetup, getAiClient, getAiModel, getAiProvider } from "@/lib/ai/client";
import {
  isGuideCandidate,
  isListCandidate,
  resolveFeedArticleFormat,
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
import { getSql, type Sql } from "@/lib/db/client";
import { RAW_ITEM_PLAN_COLUMNS } from "@/lib/db/article-columns";
import {
  ARTICLE_SOURCE_PRIORITY,
  buildSourceLabel,
  isArticleSourceType,
  isTrendSourceType,
} from "@/lib/sources/source-label";
import { buildTrendContext } from "@/lib/sources/trend-context";
import type { Article, Category, Locale, RawItem, Source } from "@/lib/types";
import { GENERATION_CATEGORIES } from "@/lib/types";
import {
  claimRawItems,
  findDuplicateArticle,
  hasExistingArticleForItem,
  releaseRawItems,
} from "@/lib/articles/dedup";
import { inferArticleCategory } from "@/lib/categories/infer-category";
import { resolveArticleImageUrl, CATEGORY_FALLBACK_IMAGE } from "@/lib/articles/resolve-image";
import { articlePublicUrl, notifyIndexNow } from "@/lib/seo/indexnow";
import { recordArticleSlugRedirect } from "@/lib/seo/article-redirect-store";
import { shouldSkipAfterGenerationFailure } from "@/lib/sources/locale-filter";
import { enrichDescription } from "@/lib/sources/enrich-description";
import {
  articleMatchesTrendQuery,
  isLowQualityTrendQuery,
} from "@/lib/ai/trend-quality";
import { contentHash, slugify } from "@/lib/utils/hash";

const BATCH_SIZE = 4;
const DEFAULT_DAILY_TOKEN_BUDGET = 750_000;
const PENDING_POOL_SIZE = 250;
const PENDING_FETCH_SIZE = 150;
const AI_POOL_MIN = 50;
const GAMING_POOL_MIN = 45;
const CATEGORY_POOL_MIN = 30;
const AI_BATCH_SLOTS = 1;
const GAMING_BATCH_SLOTS = 1;
const TREND_BATCH_SLOTS = 2;
const INTENT_BATCH_SLOTS = 1;
const TREND_CANDIDATE_LIMIT = 12;
const TREND_MAX_AGE_MS = 48 * 60 * 60 * 1000;
const MIN_TREND_CONTEXT_MATCHES = 1;
const CLICKABLE_CATEGORIES = new Set<Category>(["sport", "gaming"]);
const MAX_GENERATION_ATTEMPTS = 2;
const MAX_GENERATION_ATTEMPTS_LOCAL = 3;
const SOURCE_TEXT_MIN_FOR_LONG_READ = 420;
const SOURCE_TEXT_MIN_FOR_ANALYSIS = 280;

type PendingItem = RawItem & {
  sources: Pick<Source, "category" | "locale" | "type" | "config">;
};

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}

function qualifyRawItemPlanColumns(alias: string): string {
  return RAW_ITEM_PLAN_COLUMNS.split(",")
    .map((col) => `${alias}.${col.trim()}`)
    .join(", ");
}

function mapSourcesFromRow(
  row: Record<string, unknown>,
): Pick<Source, "category" | "locale" | "type" | "config"> {
  return {
    category: row.source_category as string,
    locale: row.source_locale as string,
    type: row.source_type as Source["type"],
    config: (row.source_config ?? {}) as Record<string, string>,
  };
}

async function callAi(
  prompt: string,
): Promise<{ content: string; tokensUsed: number }> {
  const openai = getAiClient();
  const response = await openai.chat.completions.create({
    model: getAiModel(),
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

function maxGenerationAttempts(): number {
  return getAiProvider() === "local"
    ? MAX_GENERATION_ATTEMPTS_LOCAL
    : MAX_GENERATION_ATTEMPTS;
}

function parseAiJson(content: string): unknown {
  const trimmed = content.trim();
  if (trimmed.startsWith("```")) {
    const unwrapped = trimmed
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "");
    return JSON.parse(unwrapped);
  }
  return JSON.parse(trimmed);
}

function adaptFormatForSourceDepth(
  format: ArticleFormat,
  item: PendingItem,
  sourceText: string,
): ArticleFormat {
  if (item.sources.type === "google_trends") return format;

  const len = sourceText.trim().length;
  if (len >= SOURCE_TEXT_MIN_FOR_LONG_READ) return format;

  if (len < SOURCE_TEXT_MIN_FOR_ANALYSIS) {
    if (format === "analysis" || format === "essay" || format === "synthesis") {
      return item.sources.type === "hacker_news" || item.sources.type === "lobsters"
        ? "community"
        : "story";
    }
    return format;
  }

  if (format === "essay" || format === "synthesis") return "analysis";
  return format;
}

async function ensureUniqueSlug(
  locale: string,
  baseSlug: string,
): Promise<string> {
  const sql = getSql();
  let slug = baseSlug;
  let suffix = 1;

  while (true) {
    const rows = await sql.query(
      `SELECT id FROM articles WHERE slug = $1 AND locale = $2 LIMIT 1`,
      [slug, locale],
    );

    if (!rows.length) return slug;
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

async function hasExistingArticle(item: PendingItem): Promise<boolean> {
  return hasExistingArticleForItem(getSql(), item);
}

async function hasRecentTrendArticle(
  query: string,
  locale: string,
): Promise<boolean> {
  const sql = getSql();
  const base = slugify(query);
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const rows = await sql.query(
    `SELECT id FROM articles
     WHERE locale = $1
       AND published_at >= $2
       AND (slug = $3 OR slug ILIKE $4)
     LIMIT 1`,
    [locale, since, base, `${base}-%`],
  );

  return rows.length > 0;
}

async function hasQuizPublishedToday(
  sql: Sql,
  locale: Locale,
): Promise<boolean> {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const rows = (await sql.query(
    `SELECT summary FROM articles
     WHERE locale = $1
       AND article_type = 'trend_item'
       AND published_at >= $2
     LIMIT 30`,
    [locale, start.toISOString()],
  )) as Array<{ summary: { format?: string; quiz?: unknown[] } | null }>;

  return rows.some((row) => {
    const summary = row.summary;
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

export type GeneratePendingProgressEvent =
  | {
      type: "batch_planned";
      tasks: number;
      items: Array<{ title: string; kind: string }>;
    }
  | {
      type: "task_start";
      index: number;
      total: number;
      title: string;
      kind: string;
    }
  | {
      type: "task_done";
      index: number;
      total: number;
      title: string;
      published: boolean;
      tokensUsed: number;
    }
  | { type: "backup_start"; title: string }
  | {
      type: "backup_done";
      title: string;
      published: boolean;
      tokensUsed: number;
    };

function jobTitle(job: GenerationWork): string {
  if (job.kind === "synthesis") {
    return job.items[0]?.title ?? "Synteza źródeł";
  }
  return job.item.title;
}

function jobKindLabel(job: GenerationWork): string {
  if (job.kind === "synthesis") return "synteza";
  if (job.kind === "trend") return "trend";
  return job.format ?? "artykuł";
}

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
  if (item.sources.type === "google_trends") {
    return formatForSearchIntent(
      detectSearchIntent(item.title, item.description),
      () => pickGuaranteedLongReadFormat(item),
    );
  }
  const intent = detectSearchIntent(item.title, item.description);
  if (intent === "quiz") return "quiz";
  if (intent === "list") return "list";
  if (intent === "guide") return "guide";
  return pickGuaranteedLongReadFormat(item);
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

  const trendPicks: PendingItem[] = [];
  let trendPool = trendEligible.filter((item) => !reserved.has(item.id));

  for (let slot = 0; slot < TREND_BATCH_SLOTS && work.length < BATCH_SIZE; slot++) {
    const trend = pickBestTrendItem(trendPool, {
      preferSportQuiz: slot === 0 && options?.preferSportQuiz,
    });
    if (!trend) break;

    const trendFormat =
      options?.preferSportQuiz &&
      slot === 0 &&
      trend.sources.category === "sport" &&
      isSportQuizCandidate(trend.title, trend.description)
        ? ("quiz" as const)
        : undefined;
    work.push({ kind: "trend", item: trend, format: trendFormat });
    reserved.add(trend.id);
    trendPicks.push(trend);
    trendPool = trendPool.filter((item) => item.id !== trend.id);
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

  const trendSlots = trendPicks.length;
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

async function hydratePendingDescriptions(
  sql: Sql,
  items: PendingItem[],
): Promise<PendingItem[]> {
  if (!items.length) return items;
  const ids = [...new Set(items.map((item) => item.id))];
  const data = (await sql.query(
    `SELECT id, description FROM raw_items WHERE id = ANY($1::uuid[])`,
    [ids],
  )) as Array<{ id: string; description: string | null }>;

  const descriptions = new Map(
    data.map((row) => [row.id, row.description]),
  );

  return items.map((item) => ({
    ...item,
    description: descriptions.get(item.id) ?? item.description ?? null,
  }));
}

async function enrichSourceText(
  sql: Sql,
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
      await sql.query(`UPDATE raw_items SET description = $1 WHERE id = $2`, [
        enriched,
        rawItem.id,
      ]);
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
  trendQuery?: string;
}): Promise<{ article: GeneratedArticle | null; tokensUsed: number }> {
  let tokensUsed = 0;
  const attempts = maxGenerationAttempts();

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (attempt > 0) {
      console.log(`  retry ${attempt + 1}/${attempts}…`);
    }

    const { content, tokensUsed: used } = await callAi(params.buildPrompt(attempt > 0));
    tokensUsed += used;

    let parsed: unknown;
    try {
      parsed = parseAiJson(content);
    } catch {
      continue;
    }

    const normalized = normalizeGeneratedArticle(parsed, params.fallbackTitle, params.locale, params.format, {
      sourceText: params.sourceText,
      trendQuery: params.trendQuery,
    });

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
  sql: Sql;
  locale: Locale;
  category: Category;
  generatedItem: GeneratedArticle;
  rawItems: PendingItem[];
  indexNowUrls: string[];
}): Promise<boolean> {
  const primary = params.rawItems[0];
  const sourceCategory = params.category;

  const duplicate = await findDuplicateArticle(params.sql, {
    locale: params.locale,
    category: sourceCategory,
    rawItemIds: params.rawItems.map((item) => item.id),
    sourceUrl: primary.url,
    sourceTitle: primary.title,
    headline: params.generatedItem.headline,
  });
  if (duplicate) {
    console.log(`  ⊘ duplikat — już jest /${duplicate.slug}`);
    await releaseRawItems(
      params.sql,
      params.rawItems.map((item) => item.id),
      "skipped",
    );
    return false;
  }

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
  if (slug !== baseSlug) {
    await recordArticleSlugRedirect(params.locale, baseSlug, slug);
  }

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

  const summary = {
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
  };

  try {
    await params.sql.query(
      `INSERT INTO articles (
         slug, locale, category, article_type, seo_title, seo_description,
         headline, lead, image_url, summary, why_it_matters, tags,
         source_item_ids, is_published
       ) VALUES (
         $1, $2, $3, 'trend_item', $4, $5,
         $6, $7, $8, $9::jsonb, $10, $11::text[],
         $12::uuid[], true
       )`,
      [
        slug,
        params.locale,
        category,
        params.generatedItem.seo_title,
        params.generatedItem.seo_description,
        params.generatedItem.headline,
        params.generatedItem.lead,
        imageUrl,
        JSON.stringify(summary),
        params.generatedItem.why_it_matters,
        params.generatedItem.tags,
        params.rawItems.map((item) => item.id),
      ],
    );
  } catch (error) {
    // Unique violations (23505) and any other insert failure — same as old articleError path
    if (isUniqueViolation(error) || error) {
      await releaseRawItems(
        params.sql,
        params.rawItems.map((item) => item.id),
        "failed",
      );
      return false;
    }
    throw error;
  }

  for (const item of params.rawItems) {
    await params.sql.query(
      `UPDATE raw_items SET status = 'processed' WHERE id = $1`,
      [item.id],
    );
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
  sql: Sql;
  rawItem: PendingItem;
  formatOverride?: ArticleFormat;
  indexNowUrls: string[];
}): Promise<{ published: boolean; tokensUsed: number }> {
  const locale = params.rawItem.sources.locale as Locale;
  const category = params.rawItem.sources.category as Category;
  const query = params.rawItem.title;

  if (isLowQualityTrendQuery(query)) {
    console.log("  ⊘ trend — niska jakość frazy");
    await releaseRawItems(params.sql, [params.rawItem.id], "skipped");
    return { published: false, tokensUsed: 0 };
  }

  if (!(await claimRawItems(params.sql, [params.rawItem.id]))) {
    console.log("  ⊘ już przetwarzane lub opublikowane");
    return { published: false, tokensUsed: 0 };
  }

  const intent = detectSearchIntent(query, params.rawItem.description);
  const articleFormat =
    params.formatOverride ?? pickTrendArticleFormat(query, category);

  const { description: context, matches } = await buildTrendContext(
    params.sql,
    {
      query,
      category,
    },
  );

  const canGenerateWithoutContext =
    articleFormat === "quiz" ||
    articleFormat === "explainer" ||
    intent !== "news" ||
    isSportQuizCandidate(query, params.rawItem.description);

  if (
    matches.length < MIN_TREND_CONTEXT_MATCHES &&
    !canGenerateWithoutContext
  ) {
    console.log("  ⊘ trend bez kontekstu źródeł — skip");
    await releaseRawItems(params.sql, [params.rawItem.id], "skipped");
    return { published: false, tokensUsed: 0 };
  }

  const queryFocusedContext =
    articleFormat === "explainer"
      ? `Search query: "${query}". Write ONLY about this topic. Do not write about unrelated news.\n\n${context}`
      : context;

  await params.sql.query(
    `UPDATE raw_items SET description = $1 WHERE id = $2`,
    [queryFocusedContext, params.rawItem.id],
  );

  const angle = pickEditorialAngle(
    category,
    articleFormat,
    params.rawItem.id,
    queryFocusedContext.length,
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
        queryFocusedContext,
        articleFormat,
        { angle, strictLocale },
      ),
    fallbackTitle: query,
    sourceText: queryFocusedContext,
    trendQuery: query,
  });

  if (!generatedItem) {
    console.log("  ✗ odrzucono trend (walidacja lub jakość)");
    await releaseRawItems(params.sql, [params.rawItem.id], "failed");
    return { published: false, tokensUsed };
  }

  if (!articleMatchesTrendQuery(query, generatedItem)) {
    console.log("  ✗ trend nie odpowiada frazie wyszukiwania");
    await releaseRawItems(params.sql, [params.rawItem.id], "failed");
    return { published: false, tokensUsed };
  }

  const published = await publishArticle({
    sql: params.sql,
    locale,
    category,
    generatedItem,
    rawItems: [params.rawItem],
    indexNowUrls: params.indexNowUrls,
  });

  return { published, tokensUsed };
}

async function generateAndPublishSingle(params: {
  sql: Sql;
  rawItem: PendingItem;
  articleFormat: ArticleFormat;
  indexNowUrls: string[];
}): Promise<{ published: boolean; tokensUsed: number }> {
  const locale = params.rawItem.sources.locale as Locale;
  const category = params.rawItem.sources.category as Category;

  if (!(await claimRawItems(params.sql, [params.rawItem.id]))) {
    console.log("  ⊘ już przetwarzane lub opublikowane");
    return { published: false, tokensUsed: 0 };
  }

  const sourceText = await enrichSourceText(params.sql, params.rawItem);
  const normalizedFormat = adaptFormatForSourceDepth(
    params.articleFormat,
    params.rawItem,
    sourceText,
  );
  if (normalizedFormat !== params.articleFormat) {
    console.log(
      `  ↪ format ${params.articleFormat} → ${normalizedFormat} (krótkie źródło: ${sourceText.length}ch)`,
    );
  }
  const angle = pickEditorialAngle(
    category,
    normalizedFormat,
    params.rawItem.id,
    sourceText.length,
  );

  console.log(
    `→ ${params.rawItem.title.slice(0, 70)}… [${normalizedFormat}${angle ? `, ${angle}` : ""}, ${params.rawItem.sources.type}, ${sourceText.length}ch]`,
  );

  const { article: generatedItem, tokensUsed } = await generateArticleDraft({
    locale,
    category,
    format: normalizedFormat,
    buildPrompt: (strictLocale) =>
      buildSingleArticlePrompt(
        locale,
        category,
        toPromptItem(params.rawItem, sourceText),
        normalizedFormat,
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
    await releaseRawItems(
      params.sql,
      [params.rawItem.id],
      skip ? "skipped" : "failed",
    );
    return { published: false, tokensUsed };
  }

  const published = await publishArticle({
    sql: params.sql,
    locale,
    category,
    generatedItem,
    rawItems: [params.rawItem],
    indexNowUrls: params.indexNowUrls,
  });

  return { published, tokensUsed };
}

function toLeanPendingItem(row: Record<string, unknown>): PendingItem {
  return {
    id: row.id as string,
    source_id: row.source_id as string,
    external_id: "",
    title: row.title as string,
    description: null,
    url: row.url as string,
    engagement_score: Number(row.engagement_score),
    published_at: (row.published_at as string | null) ?? null,
    fetched_at: row.fetched_at as string,
    content_hash: row.content_hash as string,
    status: row.status as RawItem["status"],
    image_url: (row.image_url as string | null) ?? null,
    sources: mapSourcesFromRow(row),
  };
}

function toFullPendingItem(row: Record<string, unknown>): PendingItem {
  return {
    id: row.id as string,
    source_id: row.source_id as string,
    external_id: (row.external_id as string) ?? "",
    title: row.title as string,
    description: (row.description as string | null) ?? null,
    url: row.url as string,
    engagement_score: Number(row.engagement_score),
    published_at: (row.published_at as string | null) ?? null,
    fetched_at: row.fetched_at as string,
    content_hash: row.content_hash as string,
    status: row.status as RawItem["status"],
    image_url: (row.image_url as string | null) ?? null,
    sources: mapSourcesFromRow(row),
  };
}

async function fetchPendingForSources(
  sql: Sql,
  options: { excludeTrend?: boolean; trendOnly?: boolean; limit: number },
): Promise<PendingItem[]> {
  const typeFilter = options.trendOnly
    ? `AND s.type = 'google_trends'`
    : options.excludeTrend
      ? `AND s.type <> 'google_trends'`
      : "";

  const rows = await sql.query(
    `SELECT ${qualifyRawItemPlanColumns("r")},
            s.category AS source_category,
            s.locale AS source_locale,
            s.type AS source_type,
            s.config AS source_config
     FROM raw_items r
     JOIN sources s ON s.id = r.source_id
     WHERE r.status = 'pending'
       AND s.enabled = true
       ${typeFilter}
     ORDER BY r.fetched_at DESC
     LIMIT $1`,
    [options.limit],
  );

  return (rows as Record<string, unknown>[]).map(toLeanPendingItem);
}

export function getGenerationDailyTokenBudget(): number {
  const raw = process.env.GENERATION_DAILY_TOKEN_BUDGET;
  if (!raw) return DEFAULT_DAILY_TOKEN_BUDGET;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_DAILY_TOKEN_BUDGET;
}

export async function getGenerationBudgetStatus(): Promise<{
  exceeded: boolean;
  tokensUsedToday: number;
  tokenBudget: number;
}> {
  const sql = getSql();
  const tokenBudget = getGenerationDailyTokenBudget();
  const rows = await sql.query(
    `SELECT COALESCE(SUM(tokens_used), 0)::int AS total
     FROM generation_jobs
     WHERE job_type = 'generate'
       AND status IN ('completed', 'running')
       AND started_at >= date_trunc('day', now())`,
  );
  const tokensUsedToday = (rows[0] as { total: number }).total ?? 0;
  return {
    exceeded: tokensUsedToday >= tokenBudget,
    tokensUsedToday,
    tokenBudget,
  };
}

export async function generatePendingArticles(options?: {
  onProgress?: (event: GeneratePendingProgressEvent) => void;
}): Promise<{
  generated: number;
  tokensUsed: number;
  skippedTrends: number;
  skippedDuplicates: number;
  trendArticles: number;
  aiProvider: string;
  aiModel: string;
}> {
  console.log(`AI provider: ${describeAiSetup()}`);
  const sql = getSql();

  const [trendPendingRaw, articlePendingRaw] = await Promise.all([
    fetchPendingForSources(sql, {
      trendOnly: true,
      limit: TREND_CANDIDATE_LIMIT * 3,
    }),
    fetchPendingForSources(sql, {
      excludeTrend: true,
      limit: PENDING_FETCH_SIZE,
    }),
  ]);

  if (!trendPendingRaw.length && !articlePendingRaw.length) {
    console.log("Brak pending items — nic do wygenerowania.");
    return {
      generated: 0,
      tokensUsed: 0,
      skippedTrends: 0,
      skippedDuplicates: 0,
      trendArticles: 0,
      aiProvider: getAiProvider(),
      aiModel: getAiModel(),
    };
  }

  const now = Date.now();
  let skippedTrends = 0;
  let skippedDuplicates = 0;

  for (const item of trendPendingRaw) {
    if (now - new Date(item.fetched_at).getTime() > TREND_MAX_AGE_MS) {
      await sql.query(`UPDATE raw_items SET status = 'skipped' WHERE id = $1`, [
        item.id,
      ]);
      skippedTrends += 1;
    }
  }

  const trendPending = trendPendingRaw.filter(
    (item) => now - new Date(item.fetched_at).getTime() <= TREND_MAX_AGE_MS,
  );
  const articlePending = articlePendingRaw;

  const pool = buildBalancedPool(articlePending);
  const items = pool;

  const trendEligible: PendingItem[] = [];
  for (const item of sortPendingItems(trendPending)) {
    if (isLowQualityTrendQuery(item.title)) {
      await sql.query(`UPDATE raw_items SET status = 'skipped' WHERE id = $1`, [
        item.id,
      ]);
      skippedTrends += 1;
      continue;
    }
    const locale = item.sources.locale;
    if (await hasExistingArticle(item)) {
      await sql.query(`UPDATE raw_items SET status = 'skipped' WHERE id = $1`, [
        item.id,
      ]);
      skippedDuplicates += 1;
      continue;
    }
    if (await hasRecentTrendArticle(item.title, locale)) {
      await sql.query(`UPDATE raw_items SET status = 'skipped' WHERE id = $1`, [
        item.id,
      ]);
      skippedDuplicates += 1;
      continue;
    }
    trendEligible.push(item);
    if (trendEligible.length >= TREND_CANDIDATE_LIMIT) break;
  }

  const eligible: PendingItem[] = [];
  for (const item of items) {
    if (await hasExistingArticle(item)) {
      await sql.query(`UPDATE raw_items SET status = 'skipped' WHERE id = $1`, [
        item.id,
      ]);
      skippedDuplicates += 1;
      continue;
    }
    eligible.push(item);
  }

  const quizPublishedToday = await hasQuizPublishedToday(sql, "pl");
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
      aiProvider: getAiProvider(),
      aiModel: getAiModel(),
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

  const workItemList: PendingItem[] = [];
  for (const job of work) {
    if (job.kind === "synthesis") workItemList.push(...job.items);
    else workItemList.push(job.item);
  }
  const hydratedItems = await hydratePendingDescriptions(sql, workItemList);
  const hydratedById = new Map(hydratedItems.map((item) => [item.id, item]));

  options?.onProgress?.({
    type: "batch_planned",
    tasks: work.length,
    items: work.map((job) => ({
      title: jobTitle(job),
      kind: jobKindLabel(job),
    })),
  });

  let taskIndex = 0;
  for (const job of work) {
    taskIndex += 1;
    const title = jobTitle(job);
    const kind = jobKindLabel(job);
    options?.onProgress?.({
      type: "task_start",
      index: taskIndex,
      total: work.length,
      title,
      kind,
    });

    if (job.kind === "trend") {
      const rawItem = hydratedById.get(job.item.id) ?? job.item;
      const { published, tokensUsed: used } = await generateAndPublishTrend({
        sql,
        rawItem,
        formatOverride: job.format,
        indexNowUrls,
      });
      tokensUsed += used;
      if (published) {
        generated += 1;
        trendArticles += 1;
        longReadPublished = true;
      }
      options?.onProgress?.({
        type: "task_done",
        index: taskIndex,
        total: work.length,
        title,
        published,
        tokensUsed: used,
      });
      continue;
    }

    if (job.kind === "synthesis") {
      const rawItems = job.items.map(
        (item) => hydratedById.get(item.id) ?? item,
      );
      const itemIds = rawItems.map((item) => item.id);
      if (!(await claimRawItems(sql, itemIds))) {
        console.log("  ⊘ synteza — źródła już przetwarzane");
        options?.onProgress?.({
          type: "task_done",
          index: taskIndex,
          total: work.length,
          title,
          published: false,
          tokensUsed: 0,
        });
        continue;
      }

      const locale = rawItems[0].sources.locale as Locale;
      const category = rawItems[0].sources.category as Category;
      const articleFormat: ArticleFormat = "synthesis";

      const enriched = await Promise.all(
        rawItems.map(async (item) => ({
          item,
          text: await enrichSourceText(sql, item),
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
        await releaseRawItems(sql, itemIds, "failed");
        options?.onProgress?.({
          type: "task_done",
          index: taskIndex,
          total: work.length,
          title,
          published: false,
          tokensUsed: used,
        });
        continue;
      }

      const synthesisPublished = await publishArticle({
        sql,
        locale,
        category,
        generatedItem,
        rawItems,
        indexNowUrls,
      });
      if (synthesisPublished) {
        generated += 1;
        longReadPublished = true;
      }
      options?.onProgress?.({
        type: "task_done",
        index: taskIndex,
        total: work.length,
        title,
        published: synthesisPublished,
        tokensUsed: used,
      });
      continue;
    }

    const rawItem = hydratedById.get(job.item.id) ?? job.item;
    const articleFormat = job.format ?? resolveFeedArticleFormat(rawItem);
    const { published, tokensUsed: used } = await generateAndPublishSingle({
      sql,
      rawItem,
      articleFormat,
      indexNowUrls,
    });
    tokensUsed += used;

    if (published) {
      generated += 1;
      if (job.format) longReadPublished = true;
    }
    options?.onProgress?.({
      type: "task_done",
      index: taskIndex,
      total: work.length,
      title,
      published,
      tokensUsed: used,
    });
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
      const [hydratedBackup] = await hydratePendingDescriptions(sql, [backup]);
      console.log("↻ backup długi materiał…");
      options?.onProgress?.({
        type: "backup_start",
        title: hydratedBackup.title,
      });
      const { published, tokensUsed: used } = await generateAndPublishSingle({
        sql,
        rawItem: hydratedBackup,
        articleFormat: formatForHighIntentItem(hydratedBackup),
        indexNowUrls,
      });
      tokensUsed += used;
      if (published) generated += 1;
      options?.onProgress?.({
        type: "backup_done",
        title: hydratedBackup.title,
        published,
        tokensUsed: used,
      });
    }
  }

  await notifyIndexNow(indexNowUrls);

  return {
    generated,
    tokensUsed,
    skippedTrends,
    skippedDuplicates,
    trendArticles,
    aiProvider: getAiProvider(),
    aiModel: getAiModel(),
  };
}

export async function generateDigest(
  locale: Locale,
  digestType: "daily" | "weekly",
  category: string,
): Promise<Article | null> {
  const sql = getSql();
  const since = new Date();
  if (digestType === "daily") {
    since.setDate(since.getDate() - 1);
  } else {
    since.setDate(since.getDate() - 7);
  }

  const recent = (await sql.query(
    `SELECT headline, slug, image_url FROM articles
     WHERE locale = $1
       AND category = $2
       AND article_type = 'trend_item'
       AND published_at >= $3
     ORDER BY published_at DESC
     LIMIT 15`,
    [locale, category, since.toISOString()],
  )) as Array<{ headline: string; slug: string; image_url: string | null }>;

  if (!recent.length) return null;

  const digestImageUrl =
    recent.find((a) => a.image_url)?.image_url ??
    CATEGORY_FALLBACK_IMAGE[category as Category] ??
    CATEGORY_FALLBACK_IMAGE.tech;

  const prompt = buildDigestPrompt(locale, digestType, category, recent);

  const { content } = await callAi(prompt);
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
  if (slug !== baseSlug) {
    await recordArticleSlugRedirect(locale, baseSlug, slug);
  }

  let article: Article | null = null;
  try {
    const rows = (await sql.query(
      `INSERT INTO articles (
         slug, locale, category, article_type, seo_title, seo_description,
         headline, lead, image_url, summary, why_it_matters, tags,
         source_item_ids, is_published
       ) VALUES (
         $1, $2, $3, $4, $5, $6,
         $7, $8, $9, $10::jsonb, $11, $12::text[],
         $13::uuid[], true
       )
       RETURNING *`,
      [
        slug,
        locale,
        category,
        articleType,
        digest.seo_title,
        digest.seo_description,
        digest.headline,
        digest.lead,
        digestImageUrl,
        JSON.stringify(digestSummary),
        digest.why_it_matters,
        digest.tags,
        [],
      ],
    )) as Article[];
    article = rows[0] ?? null;
  } catch (error) {
    // Unique violations (23505) and other insert failures — same as old insert error path
    if (isUniqueViolation(error) || error) {
      return null;
    }
    throw error;
  }

  if (!article) return null;

  await notifyIndexNow([articlePublicUrl(locale, slug)]);

  await sql.query(
    `INSERT INTO daily_rollups (locale, rollup_type, period_date, article_id, metrics)
     VALUES ($1, $2, $3::date, $4, $5::jsonb)
     ON CONFLICT (locale, rollup_type, period_date)
     DO UPDATE SET
       article_id = EXCLUDED.article_id,
       metrics = EXCLUDED.metrics`,
    [
      locale,
      digestType,
      new Date().toISOString().slice(0, 10),
      article.id,
      JSON.stringify({
        rising: digest.rising ?? [],
        falling: digest.falling ?? [],
      }),
    ],
  );

  return article;
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
  const sql = getSql();
  const rows = await sql.query(
    `SELECT r.*,
            s.category AS source_category,
            s.locale AS source_locale,
            s.type AS source_type,
            s.config AS source_config
     FROM raw_items r
     JOIN sources s ON s.id = r.source_id
     WHERE r.status = 'pending'
       AND r.title ILIKE $1
     LIMIT 1`,
    [`%${titlePattern}%`],
  );

  if (!rows.length) {
    console.log(`Brak pending item pasującego do: ${titlePattern}`);
    return { published: false, tokensUsed: 0 };
  }

  const rawItem = toFullPendingItem(rows[0] as Record<string, unknown>);
  const articleFormat = formatForHighIntentItem(rawItem);
  const indexNowUrls: string[] = [];
  const { published, tokensUsed } = await generateAndPublishSingle({
    sql,
    rawItem,
    articleFormat,
    indexNowUrls,
  });

  let slug: string | undefined;
  if (published) {
    const articleRows = (await sql.query(
      `SELECT slug FROM articles
       WHERE locale = $1
       ORDER BY published_at DESC
       LIMIT 1`,
      [rawItem.sources.locale],
    )) as Array<{ slug: string }>;
    slug = articleRows[0]?.slug;
    await notifyIndexNow(indexNowUrls);
  }

  return { published, slug, format: articleFormat, tokensUsed };
}

export async function startJob(jobType: string) {
  const sql = getSql();
  const rows = await sql.query(
    `INSERT INTO generation_jobs (job_type, status)
     VALUES ($1, 'running')
     RETURNING *`,
    [jobType],
  );
  return rows[0] ?? null;
}

export async function finishJob(
  jobId: string,
  status: "completed" | "failed",
  itemsProcessed: number,
  tokensUsed: number,
  error?: string,
) {
  const sql = getSql();
  await sql.query(
    `UPDATE generation_jobs
     SET status = $1,
         finished_at = $2,
         items_processed = $3,
         tokens_used = $4,
         error = $5
     WHERE id = $6`,
    [status, new Date().toISOString(), itemsProcessed, tokensUsed, error ?? null, jobId],
  );
}

// Re-export for dedup utility used elsewhere
export { contentHash };
