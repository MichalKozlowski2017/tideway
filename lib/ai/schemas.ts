import { z } from "zod";
import type { ArticleFormat } from "@/lib/ai/article-body";
import { claimsSupportedBySource } from "@/lib/ai/fact-check";
import { articleMatchesLocale } from "@/lib/ai/locale-check";
import { isLazyHeadline } from "@/lib/ai/headline-quality";
import { articleMatchesTrendQuery } from "@/lib/ai/trend-quality";
import { PL_SUFFIX } from "@/lib/ai/pl-regex";

const sectionTitlesSchema = z
  .object({
    highlights: z.string().optional(),
    impact: z.string().optional(),
  })
  .optional();

const quizQuestionSchema = z.object({
  prompt: z.string().min(8),
  options: z.preprocess((val) => {
    if (!Array.isArray(val)) return val;
    return val.slice(0, 3).map(String);
  }, z.tuple([z.string().min(1), z.string().min(1), z.string().min(1)])),
  correct_index: z.number().int().min(0).max(2),
});

export const singleArticleResponseSchema = z.object({
  format: z.enum([
    "story",
    "brief",
    "community",
    "analysis",
    "essay",
    "synthesis",
    "guide",
    "explainer",
    "quiz",
    "list",
  ]),
  headline: z.string().min(10),
  seo_title: z.string().min(10).max(70),
  seo_description: z.string().min(50).max(160),
  lead: z.string().min(40),
  body: z.string().min(80).optional(),
  highlights: z.preprocess((val) => {
    if (!Array.isArray(val)) return val;
    const flat = val.flatMap((entry) => {
      if (typeof entry === "string") return [entry];
      if (Array.isArray(entry)) {
        return entry.filter((x): x is string => typeof x === "string");
      }
      return [];
    });
    return flat.slice(0, 12);
  }, z.array(z.string().min(3)).max(12).optional()),
  context_note: z.string().min(20).optional(),
  section_titles: sectionTitlesSchema,
  why_it_matters: z.string().min(80),
  tags: z.array(z.string().min(2)).min(3).max(7),
  slug_hint: z.string().min(3).max(80),
  quiz_questions: z.array(quizQuestionSchema).min(5).max(10).optional(),
});

export const generatedArticleSchema = singleArticleResponseSchema;

export type GeneratedArticle = z.infer<typeof singleArticleResponseSchema>;

export const batchResponseSchema = z.object({
  items: z.array(z.unknown()),
});

const BANNED_PL = [
  "został zaprojektowany z myślą",
  "może poprawić standardy",
  "budząc jednocześnie kontrowersje",
  "nowa era",
  "zyskuje na popularności",
  "zyskuje uwagę",
  "zyskuje zainteresowanie",
  "przyciąga uwagę",
  "artykuł omawia",
  "artykuł na temat",
  "w artykule",
  "temat może wpłynąć",
  "konsekwencje tego tematu mogą dotknąć",
  "zrewolucjonizować",
  "zrewolucjonizowac",
  "intensywnie dyskutuje",
  "reaktywuje się",
  "społeczność hacker news",
  "społeczność na hacker news",
  "społeczność technologiczna",
  "społeczność programistyczna",
  "członkowie platformy",
  "członkowie społeczności",
];

const BANNED_EN = [
  "may affect readers",
  "raising controversy",
  "new era of",
  "the real story behind",
  "signals a broader trend",
  "underscores the",
  "investors are watching closely",
  "the tech community is buzzing",
  "community is actively discussing",
];

const GENERIC_SECTION_TITLES = [
  "kluczowe punkty analizy",
  "potencjalne konsekwencje",
  "potencjalne skutki",
  "key insights",
  "key takeaways",
  "strategic implications",
];

const COMMUNITY_LEAD_PL =
  /^(społeczność|w społeczności|artykuł|w artykule|tematem|na forum)\b/i;
const COMMUNITY_LEAD_EN =
  /^(the community|the tech community|community members|the article)\b/i;

const META_LEAD_PL = /^(artykuł|w artykule|tematem|najnowszy artykuł)\b/i;

const MIN_BODY: Record<ArticleFormat, number> = {
  story: 850,
  analysis: 900,
  essay: 1_000,
  synthesis: 1_000,
  guide: 900,
  explainer: 500,
  quiz: 550,
  list: 250,
  community: 420,
  brief: 0,
};

const GUIDE_SEO_TITLE_PL = new RegExp(
  String.raw`^(jak|gdzie|kiedy|co zrob${PL_SUFFIX}|jak zdobyc${PL_SUFFIX}|jak ukończ${PL_SUFFIX}|gdzie znale[zź]${PL_SUFFIX}|gdzie szukaj${PL_SUFFIX})\b`,
  "i",
);
const GUIDE_SEO_TITLE_EN = /^how to\b/i;
const QUIZ_SEO_TITLE_PL = new RegExp(
  String.raw`\b(zagadk${PL_SUFFIX}|quiz|test wiedzy)\b`,
  "i",
);
const QUIZ_SEO_TITLE_EN = /\b(quiz|trivia|test)\b/i;
const LIST_SEO_TITLE_PL = new RegExp(
  String.raw`\b(top|najleps${PL_SUFFIX}|ranking${PL_SUFFIX}|list${PL_SUFFIX})\b`,
  "i",
);
const LIST_SEO_TITLE_EN = /\b(top|best|ranking|lists?)\b/i;

const MIN_HIGHLIGHT_LENGTH = 25;

function hasSubheadings(body: string, minimum = 2): boolean {
  return (body.match(/^## .+/gm) ?? []).length >= minimum;
}

export function isGenericContent(text: string, locale: "pl" | "en"): boolean {
  const lower = text.toLowerCase();
  if (locale === "pl") {
    return BANNED_PL.some((p) => lower.includes(p));
  }
  return BANNED_EN.some((p) => lower.includes(p));
}

function hasGenericSectionTitles(
  sectionTitles: { highlights?: string; impact?: string } | undefined,
): boolean {
  if (!sectionTitles) return false;
  const combined = [sectionTitles.highlights, sectionTitles.impact]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return GENERIC_SECTION_TITLES.some((t) => combined.includes(t));
}

function hasCommunityTemplateLead(lead: string, locale: "pl" | "en"): boolean {
  const trimmed = lead.trim();
  if (locale === "pl") {
    return COMMUNITY_LEAD_PL.test(trimmed) || META_LEAD_PL.test(trimmed);
  }
  return COMMUNITY_LEAD_EN.test(trimmed);
}

export function normalizeGeneratedArticle(
  raw: unknown,
  fallbackTitle: string,
  locale: "pl" | "en" = "pl",
  expectedFormat?: ArticleFormat,
  options?: { sourceText?: string; trendQuery?: string },
): GeneratedArticle | null {
  const parsed = singleArticleResponseSchema.safeParse(raw);
  if (!parsed.success) return null;

  const item = parsed.data;
  const combined = `${item.lead} ${item.why_it_matters} ${item.body ?? ""}`;
  if (isGenericContent(combined, locale)) return null;

  if (
    !articleMatchesLocale(
      {
        headline: item.headline,
        lead: item.lead,
        body: item.body,
        why_it_matters: item.why_it_matters,
      },
      locale,
    )
  ) {
    return null;
  }

  if (hasGenericSectionTitles(item.section_titles)) return null;

  if (hasCommunityTemplateLead(item.lead, locale)) return null;

  const format = expectedFormat ?? item.format;

  if (
    isLazyHeadline(item.headline, locale) ||
    (["essay", "analysis", "story"].includes(format) &&
      isLazyHeadline(item.lead, locale))
  ) {
    return null;
  }

  if (expectedFormat && item.format !== expectedFormat) {
    return { ...item, format: expectedFormat };
  }

  const minBody = MIN_BODY[format];
  const hasInteractiveQuiz =
    format === "quiz" &&
    item.quiz_questions &&
    item.quiz_questions.length >= 5;

  if (
    minBody > 0 &&
    !hasInteractiveQuiz &&
    (!item.body || item.body.length < minBody)
  ) {
    return null;
  }

  if (format === "brief") {
    if (!item.highlights || item.highlights.length < 3) return null;
    if (item.highlights.some((h) => h.length < 18)) return null;
  }

  if (format === "list") {
    const seo = item.seo_title.trim();
    if (locale === "pl" && !LIST_SEO_TITLE_PL.test(seo)) return null;
    if (locale === "en" && !LIST_SEO_TITLE_EN.test(seo)) return null;
    if (/w tym artykule przedstawiamy/i.test(item.lead)) return null;
    if (
      !item.highlights ||
      item.highlights.length < 5 ||
      item.highlights.length > 8
    ) {
      return null;
    }
    if (item.highlights.some((h) => h.length < 30)) return null;
  }

  if (
    (format === "analysis" ||
      format === "community" ||
      format === "essay" ||
      format === "synthesis" ||
      format === "guide" ||
      format === "explainer") &&
    (!item.highlights || item.highlights.length < 3)
  ) {
    return null;
  }

  if (
    (format === "analysis" ||
      format === "essay" ||
      format === "synthesis" ||
      format === "guide") &&
    item.highlights?.some((h) => h.length < MIN_HIGHLIGHT_LENGTH)
  ) {
    return null;
  }

  if (
    format === "explainer" &&
    item.highlights?.some((h) => h.length < 18)
  ) {
    return null;
  }

  if (
    (format === "essay" || format === "synthesis" || format === "guide") &&
    (!item.body || !hasSubheadings(item.body))
  ) {
    return null;
  }

  if (format === "explainer") {
    const body = item.body ?? "";
    if (/krok\s*\d+/i.test(body) || /w tym przewodniku/i.test(item.lead)) {
      return null;
    }
    if (!hasSubheadings(body, 1)) return null;
  }

  if (format === "guide") {
    const seo = item.seo_title.trim();
    if (!options?.trendQuery) {
      if (locale === "pl" && !GUIDE_SEO_TITLE_PL.test(seo)) return null;
      if (locale === "en" && !GUIDE_SEO_TITLE_EN.test(seo)) return null;
    }
    const body = item.body ?? "";
    if (
      /krok\s*\d+/i.test(body) ||
      /pierwszym krokiem/i.test(body) ||
      /w tym przewodniku/i.test(item.lead) ||
      /```/.test(body)
    ) {
      return null;
    }
  }

  if (format === "quiz") {
    const seo = item.seo_title.trim();
    if (locale === "pl" && !QUIZ_SEO_TITLE_PL.test(seo)) return null;
    if (locale === "en" && !QUIZ_SEO_TITLE_EN.test(seo)) return null;
    if (/interaktywność|łączą fanów|łączy fanów/i.test(item.lead)) return null;

    if (!item.quiz_questions || item.quiz_questions.length < 5) return null;

    for (const q of item.quiz_questions) {
      const opts = new Set(q.options.map((o) => o.trim().toLowerCase()));
      if (opts.size < 3) return null;
      if (q.correct_index < 0 || q.correct_index > 2) return null;
    }
  }

  if (format === "community" && !item.context_note) {
    return null;
  }

  if (
    options?.sourceText &&
    format !== "quiz" &&
    format !== "explainer" &&
    !claimsSupportedBySource(item, options.sourceText)
  ) {
    return null;
  }

  if (
    options?.trendQuery &&
    !articleMatchesTrendQuery(options.trendQuery, {
      headline: item.headline,
      lead: item.lead,
      seo_title: item.seo_title,
    })
  ) {
    return null;
  }

  if (!item.slug_hint) {
    return { ...item, slug_hint: fallbackTitle };
  }

  return item;
}

const digestBulletSchema = z.object({
  text: z.string().min(10),
  source_index: z.number().int().min(1),
});

export const digestResponseSchema = z.object({
  headline: z.string().min(10),
  seo_title: z.string().min(10).max(70),
  seo_description: z.string().min(50).max(160),
  lead: z.string(),
  bullet_points: z.array(digestBulletSchema).min(5).max(10),
  why_it_matters: z.string(),
  tags: z.array(z.string()),
  slug_hint: z.string(),
  rising: z.array(z.string()).optional(),
  falling: z.array(z.string()).optional(),
});

export type DigestArticle = z.infer<typeof digestResponseSchema>;
