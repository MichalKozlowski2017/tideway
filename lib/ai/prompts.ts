import type { ArticleFormat } from "@/lib/ai/article-body";
import { matchesLocale } from "@/lib/ai/locale-check";
import type { Locale } from "@/lib/types";

export type PromptItem = {
  title: string;
  description: string;
  url: string;
  sourceLabel: string;
  sourceType: string;
  engagementScore: number;
};

export type PromptOptions = {
  strictLocale?: boolean;
};

const FORMAT_GUIDE: Record<ArticleFormat, string> = {
  story: `Format "story":
- lead: vivid opening with the main fact in first sentence
- body: 4–5 paragraphs (separated by blank lines), journalistic prose — min 900 chars total, NO bullet list in body; include names, dates, numbers, and concrete context from Input
- highlights: omit or max 2 short lines
- section_titles.impact: creative heading (NOT "Dlaczego to ważne?" / "Potencjalne konsekwencje") e.g. "Co to zmienia na rynku"`,
  brief: `Format "brief":
- lead: one punchy sentence with the key fact — company, number, date (min 60 chars)
- highlights: 3–4 crisp facts as list items (numbers, names, dates) — each min 18 chars
- body: omit
- section_titles.highlights: creative heading (NOT "Najważniejsze punkty") e.g. "W skrócie"`,
  community: `Format "community":
- lead: start with the TOPIC or linked story — NOT "Społeczność dyskutuje" / "Artykuł omawia" / "The community is discussing"
- context_note: why this link is trending (score, comment count) — use ONLY facts from Input
- body: 3 paragraphs explaining the linked story — min 450 chars total, grounded in Input
- highlights: 3 concrete takeaways from the source material (each with a specific fact)
- section_titles.highlights: e.g. "Dlaczego to trafia na listę"`,
  analysis: `Format "analysis":
- lead: specific thesis with names and facts — NOT "The real story behind..."
- body: 4–5 paragraphs of context and implications — min 900 chars total, grounded in Input details; explain cause, effect, and who is affected
- highlights: 3 analytical points (cause, effect, who wins/loses) — each min 25 chars with specifics
- section_titles.impact: e.g. "Efekt domina" — NOT "Kluczowe punkty analizy"`,
};

export function buildSingleArticlePrompt(
  locale: Locale,
  category: string,
  item: PromptItem,
  format: ArticleFormat,
  options: PromptOptions = {},
): string {
  const lang = locale === "pl" ? "Polish" : "English";
  const langRule = options.strictLocale
    ? `CRITICAL: Every field (headline, lead, body, highlights, why_it_matters, tags) MUST be written entirely in ${lang}. Mixed language = invalid.`
    : `Write the entire article in ${lang} only — headline, lead, body, highlights, why_it_matters, and tags. Never mix languages.`;

  const sourceNote =
    locale === "pl" && !matchesLocale(item.title, "pl")
      ? "\nSource material may be in English — translate and write the full article in Polish only.\n"
      : "";

  return `You are a ${lang} editor at a tech publication. Write ONE unique article — NOT a template.
${sourceNote}
${langRule}

Category: ${category}
Source: ${item.sourceLabel} (${item.sourceType})
Engagement: ${item.engagementScore}
Required format: "${format}"

${FORMAT_GUIDE[format]}

Return ONLY valid JSON:
{
  "format": "${format}",
  "headline": "unique headline — avoid clichés like 'Nowa era' or 'zyskuje na popularności'",
  "seo_title": "max 70 chars",
  "seo_description": "max 160 chars",
  "lead": "see format rules above",
  "body": "optional paragraphs for story/community/analysis",
  "highlights": ["optional bullet items for brief/analysis/community"],
  "context_note": "required for community format",
  "section_titles": { "highlights": "custom section heading", "impact": "custom impact heading" },
  "why_it_matters": "2–3 specific sentences — WHO is affected, WHAT changes, WHEN it matters — name companies, products, or user groups",
  "tags": ["5 tags"],
  "slug_hint": "url-slug"
}

Banned phrases (never use): "Nowa era", "zyskuje na popularności", "zyskuje uwagę", "przyciąga uwagę", "Artykuł omawia", "Artykuł na temat", "W artykule", "został zaprojektowany z myślą", "budząc kontrowersje", "zrewolucjonizować", "Społeczność intensywnie dyskutuje", "The real story behind", "signals a broader trend", "investors are watching closely", "Kluczowe punkty analizy", "Potencjalne konsekwencje"

Input:
Title: ${item.title}
URL: ${item.url}
Details:
${item.description}`;
}

export function buildDigestPrompt(
  locale: Locale,
  digestType: "daily" | "weekly",
  category: string,
  sources: Array<{ headline: string }>,
): string {
  const lang = locale === "pl" ? "Polish" : "English";
  const period = digestType === "daily" ? "today" : "this week";

  return `You are a news editor for Tideway. Create a ${digestType} digest in ${lang} for category ${category} covering ${period}.

Return ONLY valid JSON:
{
  "headline": "string",
  "seo_title": "string",
  "seo_description": "string",
  "lead": "string",
  "bullet_points": [
    { "text": "one-sentence takeaway", "source_index": 1 }
  ],
  "why_it_matters": "string",
  "tags": ["tags"],
  "slug_hint": "string",
  "rising": ["3 rising topics"],
  "falling": ["3 falling topics"]
}

Rules for bullet_points:
- 5-10 items
- Each item MUST include source_index (1-based) pointing to a headline from the list below
- text: concise summary in ${lang}, not a copy of the headline
- Use each source_index at most once when possible

Headlines to synthesize:
${sources.map((s, i) => `${i + 1}. ${s.headline}`).join("\n")}`;
}
