import type { ArticleFormat } from "@/lib/ai/article-body";
import type { Category } from "@/lib/types";

export type EditorialAngle =
  | "local_impact"
  | "stakes"
  | "practical"
  | "context"
  | "comparison";

const ANGLE_GUIDE: Record<EditorialAngle, string> = {
  local_impact:
    "Frame the story for a Polish/EU reader: regulations, availability, pricing in PL/EUR where relevant.",
  stakes:
    "Emphasize who wins, who loses, and what shifts in the market or ecosystem.",
  practical:
    "Focus on an actionable takeaway: what readers can do, try, or watch for next.",
  context:
    "Explain background: why this news matters now and what led to this moment.",
  comparison:
    "Contrast with the main alternative or previous approach — be specific, stay factual.",
};

const CATEGORY_ANGLES: Record<Category, EditorialAngle[]> = {
  ai: ["stakes", "practical", "comparison", "context"],
  tech: ["practical", "comparison", "local_impact", "context"],
  it: ["practical", "context", "comparison", "stakes"],
  gaming: ["practical", "local_impact", "stakes"],
  finance: ["stakes", "local_impact", "context"],
  sport: ["context", "stakes", "local_impact"],
};

function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function getEditorialAngleGuide(angle: EditorialAngle): string {
  return ANGLE_GUIDE[angle];
}

export function pickEditorialAngle(
  category: Category,
  format: ArticleFormat,
  seed: string,
  descriptionLength: number,
): EditorialAngle | undefined {
  if (format === "community") return undefined;
  if (format === "guide") return "practical";
  if (format === "quiz") return "practical";
  if (format === "list") return "practical";
  if (descriptionLength < 150) return "context";

  const angles = CATEGORY_ANGLES[category];
  return angles[hashSeed(seed) % angles.length];
}
