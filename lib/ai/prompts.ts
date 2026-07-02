import type { ArticleFormat } from "@/lib/ai/article-body";
import type { EditorialAngle } from "@/lib/ai/editorial-angle";
import { getEditorialAngleGuide } from "@/lib/ai/editorial-angle";
import { EDITORIAL_VOICE, HEADLINE_RULES } from "@/lib/ai/editorial-voice";
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
  angle?: EditorialAngle;
};

const BANNED_PHRASES =
  '"Nowa era", "zyskuje na popularności", "zyskuje uwagę", "przyciąga uwagę", "Artykuł omawia", "Artykuł na temat", "W artykule", "został zaprojektowany z myślą", "budząc kontrowersje", "zrewolucjonizować", "Społeczność intensywnie dyskutuje", "The real story behind", "signals a broader trend", "investors are watching closely", "Kluczowe punkty analizy", "Potencjalne konsekwencje", "Nie uwierzysz", "Szok w", "Szok:", "Wszystko, co musisz wiedzieć", "Jeden prosty trik", "niewiarygodne", "zszokował świat", "w tym przewodniku dowiesz się", "Krok 1", "Krok 2", "Krok 3", "krok w stronę przyszłości", "ma szansę się opłacić"';

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
  essay: `Format "essay":
- lead: compelling hook with a clear thesis — not a dry news summary
- body: long-form essay, min 1000 chars; use 3–4 sections; each section is: one line "## Short section title" (title only, max ~8 words), then a blank line, then 1–2 paragraphs; final section title MUST be "## Co to znaczy dla Ciebie" (PL) or "## What this means for you" (EN)
- highlights: 3 concise takeaways
- section_titles.impact: creative closing-frame heading`,
  synthesis: `Format "synthesis":
- lead: one sentence capturing the combined story across ALL sources
- body: min 1000 chars; weave facts from every source; each section: "## Short title" on its own line, blank line, then paragraphs; note where sources agree or differ
- highlights: 3 bullets — each tied to a specific source fact
- section_titles.highlights: e.g. "W pigułce ze źródeł"
- section_titles.impact: e.g. "Synteza"`,
  guide: `Format "guide" (practical answer to a specific reader question):
- seo_title: search-query style for Google (PL: prefer "Jak…", "Gdzie…", "Kiedy…", or "Co zrobić, gdy…" + product/game/tool name). max 70 chars.
- headline: punchy promise per headline rules — may differ from seo_title
- lead: answer the core fact in sentence one — never "w tym przewodniku" / "czytelnicy dowiedzą się"
- body: min 900 chars; helpful magazine prose with 3–4 "##" sections — titles must fit the topic naturally:
  • in-game / location: "## Gdzie to znaleźć", "## Jak ukończyć", "## Jeśli nie działa"
  • tools / tech: "## Jak to działa", "## Co ustawić", "## Typowe problemy"
  • buying: "## Co dostajesz", "## Gdzie kupić", "## Czy warto"
- NEVER use "Krok 1", "Krok 2", "Pierwszym krokiem" — write flowing paragraphs, not a tutorial template
- NO code blocks in body — describe actions in plain Polish
- highlights: 3 concrete facts (places, numbers, names)
- slug_hint: keyword slug
- section_titles.highlights: e.g. "W skrócie"
- section_titles.impact: e.g. "Na co uważać"`,
  quiz: `Format "quiz" (searchers want real questions + answers, NOT an essay about quizzes):
- seo_title: search-query style (PL: "Zagadki …", "Quiz o …", "Test wiedzy: …") — mirror the search query. max 70 chars.
- headline: inviting promise e.g. "10 zagadek o … — sprawdź się"
- lead: one sentence — what the quiz tests; never "zagadki łączą fanów" / "interaktywność"
- body: min 700 chars; section "## Pytania" then 8–10 numbered questions (1. … 2. …), each concrete and answerable from Context
- highlights: 8–10 answers in order ("1. …", "2. …") — section_titles.highlights: "Odpowiedzi"
- section_titles.impact: e.g. "Jak Ci poszło?"
- why_it_matters: why this topic matters now (1–2 sentences, specific)
- slug_hint: keyword slug matching the query`,
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

  const angleBlock = options.angle
    ? `\nEditorial angle: "${options.angle}"
${getEditorialAngleGuide(options.angle)}
Shape structure and emphasis around this angle. Do not invent facts not present in Details.\n`
    : "";

  return `You are a ${lang} editor at a tech publication. Write ONE unique article — NOT a template.
${EDITORIAL_VOICE}
${sourceNote}
${langRule}
${angleBlock}
Category: ${category}
Source: ${item.sourceLabel} (${item.sourceType})
Engagement: ${item.engagementScore}
Required format: "${format}"

${FORMAT_GUIDE[format]}

Fact rule: Use ONLY facts present in Details below. Do not invent numbers, dates, company names, or quotes.

${HEADLINE_RULES}

Return ONLY valid JSON:
{
  "format": "${format}",
  "headline": "punchy on-page title per headline rules — specific fact + hook",
  "seo_title": "calmer keyword title for Google, max 70 chars — must differ from headline",
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

Banned phrases (never use): ${BANNED_PHRASES}

Input:
Title: ${item.title}
URL: ${item.url}
Details:
${item.description}`;
}

export function buildSynthesisPrompt(
  locale: Locale,
  category: string,
  items: PromptItem[],
  options: PromptOptions = {},
): string {
  const lang = locale === "pl" ? "Polish" : "English";
  const langRule = options.strictLocale
    ? `CRITICAL: Every field MUST be written entirely in ${lang}.`
    : `Write the entire article in ${lang} only.`;

  const angleBlock = options.angle
    ? `\nEditorial angle: "${options.angle}"
${getEditorialAngleGuide(options.angle)}\n`
    : "";

  const sourcesBlock = items
    .map(
      (item, index) =>
        `Source ${index + 1}:
Title: ${item.title}
URL: ${item.url}
From: ${item.sourceLabel} (${item.sourceType})
Details:
${item.description}`,
    )
    .join("\n\n");

  return `You are a ${lang} editor. Synthesize ${items.length} related sources into ONE original article — not three summaries stitched together.
${EDITORIAL_VOICE}
${langRule}
${angleBlock}
Category: ${category}
Required format: "synthesis"

${FORMAT_GUIDE.synthesis}

Fact rule: Use ONLY facts present in the sources below. When sources disagree, say so explicitly.

${HEADLINE_RULES}

Return ONLY valid JSON:
{
  "format": "synthesis",
  "headline": "punchy combined headline per headline rules",
  "seo_title": "calmer keyword title, max 70 chars — must differ from headline",
  "seo_description": "max 160 chars",
  "lead": "see format rules",
  "body": "essay with ## sections",
  "highlights": ["3 items"],
  "section_titles": { "highlights": "custom", "impact": "custom" },
  "why_it_matters": "2–3 specific sentences",
  "tags": ["5 tags"],
  "slug_hint": "url-slug"
}

Banned phrases (never use): ${BANNED_PHRASES}

${sourcesBlock}`;
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

${HEADLINE_RULES}

Return ONLY valid JSON:
{
  "headline": "punchy digest headline per headline rules",
  "seo_title": "calmer keyword title — must differ from headline",
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

Banned phrases (never use): ${BANNED_PHRASES}

Headlines to synthesize:
${sources.map((s, i) => `${i + 1}. ${s.headline}`).join("\n")}`;
}

export function buildTrendArticlePrompt(
  locale: Locale,
  category: string,
  query: string,
  context: string,
  format: ArticleFormat,
  options: PromptOptions = {},
): string {
  const lang = locale === "pl" ? "Polish" : "English";
  const langRule = options.strictLocale
    ? `CRITICAL: Every field MUST be written entirely in ${lang}.`
    : `Write the entire article in ${lang} only.`;

  const angleBlock = options.angle
    ? `\nEditorial angle: "${options.angle}"
${getEditorialAngleGuide(options.angle)}\n`
    : "";

  return `You are a ${lang} editor at Tideway. A rising Google search query needs a dedicated article TODAY.
${EDITORIAL_VOICE}
${langRule}
${angleBlock}
Category: ${category}
Search query (write FOR this): ${query}
Required format: "${format}"

${FORMAT_GUIDE[format]}

Fact rule: Use Context below when available. For quiz/guide, questions must be answerable from Context or well-known public facts. Do not invent obscure statistics.

${HEADLINE_RULES}

Return ONLY valid JSON:
{
  "format": "${format}",
  "headline": "punchy on-page title",
  "seo_title": "matches the search query intent, max 70 chars",
  "seo_description": "max 160 chars",
  "lead": "see format rules",
  "body": "see format rules",
  "highlights": ["see format rules"],
  "section_titles": { "highlights": "custom", "impact": "custom" },
  "why_it_matters": "2–3 specific sentences",
  "tags": ["5 tags"],
  "slug_hint": "url-slug from query keywords"
}

Banned phrases (never use): ${BANNED_PHRASES}

Context:
${context}`;
}
