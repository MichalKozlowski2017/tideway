const POLISH_DIACRITICS = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;

const EN_MARKERS = [
  " the ",
  " and ",
  " with ",
  " this ",
  " that ",
  " their ",
  " which ",
  " from ",
  " into ",
  " about ",
  " have ",
  " has ",
  " will ",
  " could ",
  " would ",
];

function polishWordRatio(text: string): number {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return 0;
  const polish = words.filter((w) => POLISH_DIACRITICS.test(w)).length;
  return polish / words.length;
}

export function matchesLocale(text: string, locale: "pl" | "en"): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;

  const hasPolishChars = POLISH_DIACRITICS.test(trimmed);
  const lower = ` ${trimmed.toLowerCase()} `;
  const englishHits = EN_MARKERS.filter((m) => lower.includes(m)).length;

  const words = trimmed.split(/\s+/).filter(Boolean);
  const asciiWords = words.filter(
    (w) => /^[a-z0-9'’,.\-]+$/i.test(w) && !POLISH_DIACRITICS.test(w),
  ).length;
  const asciiRatio = asciiWords / Math.max(words.length, 1);

  if (locale === "pl") {
    if (/^(the|a|an)\s+[a-z]/i.test(trimmed) && !hasPolishChars) return false;
    if (!hasPolishChars && asciiRatio > 0.88 && englishHits >= 3) return false;
    if (!hasPolishChars && englishHits >= 4) return false;
    return true;
  }

  if (hasPolishChars && polishWordRatio(trimmed) > 0.12) return false;
  return true;
}

export function articleMatchesLocale(
  fields: {
    headline: string;
    lead: string;
    body?: string;
    why_it_matters: string;
  },
  locale: "pl" | "en",
): boolean {
  const combined = [
    fields.headline,
    fields.lead,
    fields.body ?? "",
    fields.why_it_matters,
  ].join(" ");

  if (!matchesLocale(combined, locale)) return false;
  return matchesLocale(fields.lead, locale) && matchesLocale(fields.headline, locale);
}
