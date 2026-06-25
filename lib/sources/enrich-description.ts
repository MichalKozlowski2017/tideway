import { fetchPageExcerpt } from "@/lib/sources/fetch-excerpt";
import { truncateText } from "@/lib/sources/extract-text";
import type { NormalizedItem } from "@/lib/types";

const THIN_THRESHOLD = 200;
const MAX_DESCRIPTION = 2_000;

export async function enrichDescription(
  item: Pick<NormalizedItem, "description" | "url">,
): Promise<string> {
  const base = item.description?.trim() ?? "";

  if (base.length >= THIN_THRESHOLD) {
    return truncateText(base, MAX_DESCRIPTION);
  }

  const excerpt = await fetchPageExcerpt(item.url);
  if (!excerpt) {
    return truncateText(base, MAX_DESCRIPTION);
  }

  const combined = base ? `${base}\n\n${excerpt}` : excerpt;
  return truncateText(combined, MAX_DESCRIPTION);
}
