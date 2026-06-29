import OpenAI from "openai";
import type { GeneratedArticle } from "@/lib/ai/schemas";
import type { Locale } from "@/lib/types";
import { z } from "zod";

export const QUALITY_MIN_SCORE = 7;
const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

const scoreSchema = z.object({
  score: z.number().min(1).max(10),
  reason: z.string(),
});

function getOpenAI(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");
  return new OpenAI({ apiKey });
}

export async function scoreArticleQuality(
  article: GeneratedArticle,
  sourceText: string,
  locale: Locale,
): Promise<{ score: number; reason: string; tokensUsed: number }> {
  const lang = locale === "pl" ? "Polish" : "English";
  const prompt = `You are a strict ${lang} editorial quality reviewer for Tideway.pl.

Rate this draft 1–10 on:
1. Specificity — names, numbers, concrete facts (not vague generalities)
2. Usefulness — reader learns something actionable or meaningful
3. Voice — sounds edited, not like a generic AI template
4. Grounding — claims fit the source material (no obvious hallucination)
5. Headline — punchy and curiosity-driven, but honest: the article delivers what the headline promises (reject empty clickbait or dry press-release titles)

Source excerpt:
${sourceText.slice(0, 1_200)}

Draft:
Headline: ${article.headline}
Lead: ${article.lead}
Body: ${(article.body ?? "").slice(0, 1_400)}
Why it matters: ${article.why_it_matters}

Return ONLY JSON: { "score": number, "reason": "one sentence" }`;

  const openai = getOpenAI();
  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0.2,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    return { score: 0, reason: "empty response", tokensUsed: 0 };
  }

  const parsed = scoreSchema.safeParse(JSON.parse(content));
  if (!parsed.success) {
    return { score: 0, reason: "invalid score response", tokensUsed: 0 };
  }

  return {
    score: parsed.data.score,
    reason: parsed.data.reason,
    tokensUsed: response.usage?.total_tokens ?? 0,
  };
}
