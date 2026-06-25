const NUMBER_PATTERN = /\b\d{2,}(?:[.,]\d+)?%?\b/g;

function extractSignificantNumbers(text: string): string[] {
  const normalized = text.toLowerCase();
  const matches = normalized.match(NUMBER_PATTERN) ?? [];
  const unique = [...new Set(matches)];

  return unique.filter((value) => {
    if (/^20[12]\d$/.test(value)) return false;
    if (value === "100" || value === "100%") return false;
    return true;
  });
}

export function claimsSupportedBySource(
  generated: {
    body?: string;
    highlights?: string[];
    why_it_matters: string;
  },
  sourceText: string,
): boolean {
  const generatedText = [
    generated.body ?? "",
    ...(generated.highlights ?? []),
    generated.why_it_matters,
  ].join(" ");

  const numbers = extractSignificantNumbers(generatedText);
  if (numbers.length === 0) return true;

  const source = sourceText.toLowerCase();
  const supported = numbers.filter((value) => source.includes(value));
  return supported.length / numbers.length >= 0.7;
}
