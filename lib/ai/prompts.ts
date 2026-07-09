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
- headline: MUST name a specific fact, person, score, or consequence — NEVER end with "Co dalej?", "Co to oznacza?", or "Co oznacza dla…?"
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
  explainer: `Format "explainer" (direct answer to a Google search query — "co to jest X", "chat gpt", product names):
- seo_title: MUST include the core search phrase or its natural Polish form (e.g. "Co to jest ChatGPT?", "ChatGPT — co to i jak działa"). max 70 chars.
- headline: clear question or promise that names the topic from the search query — NOT a unrelated news headline
- lead: sentence one MUST define or directly answer the search query — who/what it is, in plain language
- body: min 500 chars; 2–3 "##" sections such as "## Co to jest", "## Do czego służy", "## Od czego zacząć" (adapt titles to the topic)
- Write ONLY about the search query topic — do NOT pivot to unrelated news from Context
- highlights: 3 concrete facts (names, numbers, dates) about THE QUERY TOPIC
- slug_hint: keyword slug from the search query
- section_titles.highlights: e.g. "W skrócie"
- section_titles.impact: e.g. "Warto wiedzieć"`,
  quiz: `Format "quiz" — INTERACTIVE multiple-choice quiz (3 options per question, one correct):
- seo_title: MUST contain "Quiz" or "Zagadki" (PL) — e.g. "Quiz: Anglia vs Panama 2018". max 70 chars.
- headline: inviting promise e.g. "10 pytań o … — sprawdź się"
- lead: one sentence — what the quiz tests; never "zagadki łączą fanów" / "interaktywność"
- quiz_questions: 8–10 objects, each with:
  • prompt: clear question (one fact per question)
  • options: exactly 3 plausible answers — only ONE correct, two credible wrong answers (not jokes)
  • correct_index: 0, 1, or 2 (index of the correct option in options array)
- body: omit or leave empty — questions live in quiz_questions only
- highlights: omit — do NOT list answers separately
- section_titles.impact: e.g. "Jak Ci poszło?"
- why_it_matters: why this topic matters now (1–2 sentences, specific)
- slug_hint: keyword slug matching the query`,
  list: `Format "list" — ranked Top N listicle (high CTR for "najlepsze / top / ranking" queries):
- seo_title: MUST include "Top", "Najlepsze", or "Ranking" + topic. max 70 chars.
- headline: punchy promise e.g. "7 gier, które musisz znać w 2026"
- lead: one sentence — what criteria the ranking uses; never "w tym artykule przedstawiamy"
- highlights: 5–7 ranked items in order (#1 first) — each min 35 chars: start with the name/title, then em dash and one-line why it made the list
- body: short intro only (2–3 paragraphs, min 250 chars) — selection criteria and context; NO numbered list in body (the ranked list lives in highlights)
- section_titles.highlights: e.g. "Top 5", "Ranking", "Nasza lista"
- section_titles.impact: e.g. "Co dalej?" or "Na co uważać"
- slug_hint: keyword slug`,
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
  const polishStyleRule =
    locale === "pl"
      ? `Polish style guardrails:
- Use natural Polish phrasing; do NOT produce literal EN->PL calques.
- Do NOT inflect English event names (bad: "World Cupa", "Premier League'u"). Prefer Polish forms/shortcuts (e.g. "MŚ", "Liga Mistrzów") or keep proper names unchanged.
- Do NOT inflect English brand/company names (bad: "Anthropica", "OpenAIa", "Googlea"). Keep unchanged: Anthropic, OpenAI, Meta, Google, Microsoft, Apple, Nvidia.
- Lead and why_it_matters must include at least one concrete fact (name, score, date, number, or place).`
      : "";

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
${polishStyleRule}
${angleBlock}
Category: ${category}
Source: ${item.sourceLabel} (${item.sourceType})
Engagement: ${item.engagementScore}
Required format: "${format}"

${FORMAT_GUIDE[format]}

Fact rule: Use ONLY facts present in Details below. Do not invent numbers, dates, company names, or quotes. If Details are thin, keep claims conservative and avoid grand conclusions.

${HEADLINE_RULES}

Return ONLY valid JSON:
${
  format === "quiz"
    ? `{
  "format": "quiz",
  "headline": "...",
  "seo_title": "Quiz: ...",
  "seo_description": "max 160 chars",
  "lead": "one sentence",
  "section_titles": { "impact": "Jak Ci poszło?" },
  "why_it_matters": "2 sentences",
  "tags": ["5 tags"],
  "slug_hint": "url-slug",
  "quiz_questions": [
    { "prompt": "question?", "options": ["wrong A", "correct", "wrong B"], "correct_index": 1 }
  ]
}`
    : `{
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
}`
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
  const polishStyleRule =
    locale === "pl"
      ? `Polish style guardrails:
- Use idiomatic Polish, avoid literal EN->PL translations.
- Do NOT inflect English event names (e.g. never "World Cupa"); use Polish equivalents when possible.
- In lead and why_it_matters include concrete facts from sources (names, dates, counts).`
      : "";

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
${polishStyleRule}
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
  const polishStyleRule =
    locale === "pl"
      ? `Polish style guardrails:
- Use idiomatic Polish; avoid literal EN->PL calques.
- Never inflect English event names (bad: "World Cupa"). Prefer Polish equivalents ("MŚ") or unchanged proper names.
- Never inflect English brand/company names (bad: "Anthropica", "OpenAIa"). Keep: Anthropic, OpenAI, Meta, Google, Microsoft.
- Lead and why_it_matters must contain concrete facts, not generic filler.`
      : "";

  const angleBlock = options.angle
    ? `\nEditorial angle: "${options.angle}"
${getEditorialAngleGuide(options.angle)}\n`
    : "";

  return `You are a ${lang} editor at Tideway. A rising Google search query needs a dedicated article TODAY.
${EDITORIAL_VOICE}
${langRule}
${polishStyleRule}
${angleBlock}
Category: ${category}
Search query (write FOR this — the article must answer THIS exact query): ${query}
Required format: "${format}"

CRITICAL trend rules:
- The headline, seo_title, and lead MUST be about "${query}" — not a tangential news story from Context.
- If Context mentions unrelated products or news, IGNORE them unless they directly explain the query.
- seo_title should match how Polish users search (include key words from the query).

${FORMAT_GUIDE[format]}

Fact rule: Use Context when it helps explain the query. For explainer/guide/quiz/list, use well-known public facts. Do not invent obscure statistics.

${HEADLINE_RULES}

Return ONLY valid JSON:
${
  format === "quiz"
    ? `{
  "format": "quiz",
  "headline": "...",
  "seo_title": "Quiz: ${query.slice(0, 50)}",
  "seo_description": "max 160 chars",
  "lead": "one sentence",
  "section_titles": { "impact": "Jak Ci poszło?" },
  "why_it_matters": "2 sentences",
  "tags": ["5 tags"],
  "slug_hint": "url-slug from query",
  "quiz_questions": [
    { "prompt": "question?", "options": ["A", "B", "C"], "correct_index": 1 }
  ]
}`
    : `{
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
}`
}

Banned phrases (never use): ${BANNED_PHRASES}

Context:
${context}`;
}
