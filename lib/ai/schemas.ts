import { z } from "zod";
import type { ArticleFormat } from "@/lib/ai/article-body";
import { claimsSupportedBySource } from "@/lib/ai/fact-check";
import { articleMatchesLocale } from "@/lib/ai/locale-check";

const sectionTitlesSchema = z
  .object({
    highlights: z.string().optional(),
    impact: z.string().optional(),
  })
  .optional();

export const singleArticleResponseSchema = z.object({
  format: z.enum([
    "story",
    "brief",
    "community",
    "analysis",
    "essay",
    "synthesis",
    "guide",
  ]),
  headline: z.string().min(10),
  seo_title: z.string().min(10).max(70),
  seo_description: z.string().min(50).max(160),
  lead: z.string().min(40),
  body: z.string().min(80).optional(),
  highlights: z.array(z.string().min(10)).max(5).optional(),
  context_note: z.string().min(20).optional(),
  section_titles: sectionTitlesSchema,
  why_it_matters: z.string().min(80),
  tags: z.array(z.string().min(2)).min(3).max(7),
  slug_hint: z.string().min(3).max(80),
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
  community: 420,
  brief: 0,
};

const GUIDE_SEO_TITLE_PL =
  /^(jak|gdzie|kiedy|co zrobić|jak zdobyć|jak ukończyć|gdzie znaleźć|gdzie znalezc)\b/i;
const GUIDE_SEO_TITLE_EN = /^how to\b/i;

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
  options?: { sourceText?: string },
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

  if (expectedFormat && item.format !== expectedFormat) {
    return { ...item, format: expectedFormat };
  }

  const format = expectedFormat ?? item.format;
  const minBody = MIN_BODY[format];

  if (minBody > 0 && (!item.body || item.body.length < minBody)) {
    return null;
  }

  if (format === "brief") {
    if (!item.highlights || item.highlights.length < 3) return null;
    if (item.highlights.some((h) => h.length < 18)) return null;
  }

  if (
    (format === "analysis" ||
      format === "community" ||
      format === "essay" ||
      format === "synthesis" ||
      format === "guide") &&
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
    (format === "essay" || format === "synthesis" || format === "guide") &&
    (!item.body || !hasSubheadings(item.body))
  ) {
    return null;
  }

  if (format === "guide") {
    const seo = item.seo_title.trim();
    if (locale === "pl" && !GUIDE_SEO_TITLE_PL.test(seo)) return null;
    if (locale === "en" && !GUIDE_SEO_TITLE_EN.test(seo)) return null;
    const body = item.body ?? "";
    if (/krok\s*\d+/i.test(body) || /w tym przewodniku dowiesz/i.test(item.lead)) {
      return null;
    }
  }

  if (format === "community" && !item.context_note) {
    return null;
  }

  if (
    options?.sourceText &&
    !claimsSupportedBySource(item, options.sourceText)
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
