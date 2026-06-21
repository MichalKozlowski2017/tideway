import { z } from "zod";

export const generatedArticleSchema = z.object({
  headline: z.string().min(10),
  seo_title: z.string().min(10).max(70),
  seo_description: z.string().min(50).max(160),
  lead: z.string().min(20),
  bullet_points: z.array(z.string().min(10)).min(3).max(5),
  why_it_matters: z.string().min(20),
  tags: z.array(z.string().min(2)).min(3).max(7),
  slug_hint: z.string().min(3).max(80),
});

export const batchResponseSchema = z.object({
  items: z.array(generatedArticleSchema),
});

export type GeneratedArticle = z.infer<typeof generatedArticleSchema>;

export const digestResponseSchema = z.object({
  headline: z.string(),
  seo_title: z.string(),
  seo_description: z.string(),
  lead: z.string(),
  bullet_points: z.array(z.string()).min(5).max(10),
  why_it_matters: z.string(),
  tags: z.array(z.string()),
  slug_hint: z.string(),
  rising: z.array(z.string()).optional(),
  falling: z.array(z.string()).optional(),
});

export type DigestArticle = z.infer<typeof digestResponseSchema>;
