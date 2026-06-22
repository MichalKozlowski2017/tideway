import type { Locale } from "@/lib/types";
import { matchesLocale } from "@/lib/ai/locale-check";

/** English-only sources that failed generation are skipped, not failed. */
export function shouldSkipAfterGenerationFailure(
  title: string,
  locale: Locale,
): boolean {
  if (locale !== "pl") return false;
  return !matchesLocale(title, "pl");
}
