import type { Locale } from "@/lib/types";

export function buildBatchPrompt(
  locale: Locale,
  category: string,
  items: Array<{
    title: string;
    description: string;
    url: string;
    sourceLabel: string;
    engagementScore: number;
  }>,
): string {
  const lang = locale === "pl" ? "Polish" : "English";

  return `You are a news editor for TrendPulse. Write concise trend summaries in ${lang}.

Category: ${category}
Return ONLY valid JSON matching this schema:
{
  "items": [{
    "headline": "string",
    "seo_title": "string (max 70 chars)",
    "seo_description": "string (max 160 chars)",
    "lead": "string (1-2 sentences)",
    "bullet_points": ["3-5 key points"],
    "why_it_matters": "string (1-2 sentences)",
    "tags": ["5 tags"],
    "slug_hint": "url-friendly-slug"
  }]
}

Rules:
- Synthesize, do not copy verbatim
- Be factual and neutral
- One output item per input item, same order
- slug_hint in lowercase ASCII with hyphens

Input items:
${JSON.stringify(items, null, 2)}`;
}

export function buildDigestPrompt(
  locale: Locale,
  digestType: "daily" | "weekly",
  category: string,
  headlines: string[],
): string {
  const lang = locale === "pl" ? "Polish" : "English";
  const period = digestType === "daily" ? "today" : "this week";

  return `You are a news editor for TrendPulse. Create a ${digestType} digest in ${lang} for category ${category} covering ${period}.

Return ONLY valid JSON:
{
  "headline": "string",
  "seo_title": "string",
  "seo_description": "string",
  "lead": "string",
  "bullet_points": ["5-10 items"],
  "why_it_matters": "string",
  "tags": ["tags"],
  "slug_hint": "string",
  "rising": ["3 rising topics"],
  "falling": ["3 falling topics"]
}

Top headlines to synthesize:
${headlines.map((h, i) => `${i + 1}. ${h}`).join("\n")}`;
}
