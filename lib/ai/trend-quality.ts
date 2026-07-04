const PL_STOP_WORDS = new Set([
  "co",
  "to",
  "jest",
  "czym",
  "oznacza",
  "jak",
  "działa",
  "dziala",
  "czy",
  "dla",
  "the",
  "a",
  "an",
  "and",
  "or",
  "i",
  "w",
  "na",
  "do",
  "z",
  "o",
  "po",
  "od",
  "ze",
  "się",
  "sie",
  "al",
]);

/** Rising queries that are homonyms or local noise — skip before generation. */
const LOW_QUALITY_TREND = new RegExp(
  String.raw`\b(giełda\s+(kwiatow|odzieżow|odziezow|kalisk|łódź|lodz|poznań|poznan)|targ\s+(kwiatow|odzieżow)|pchli\s+rynek|bazar)\b`,
  "i",
);

const EXPLAINER_SIGNALS = new RegExp(
  String.raw`\b(co\s+to\b|czym\s+jest|co\s+oznacza|jak\s+działa|jak\s+dziala|what\s+is\b|what\s+are\b|definicja\b|znaczenie\b)`,
  "i",
);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length > 0);
}

export function isLowQualityTrendQuery(query: string): boolean {
  const trimmed = query.trim();
  if (trimmed.length < 3) return true;
  return LOW_QUALITY_TREND.test(trimmed);
}

export function isExplainerCandidate(
  query: string,
  description?: string | null,
): boolean {
  const text = `${query} ${description ?? ""}`;
  if (EXPLAINER_SIGNALS.test(text)) return true;

  const tokens = tokenize(query).filter(
    (t) => t.length > 2 && !PL_STOP_WORDS.has(t),
  );
  if (tokens.length === 0) return false;

  const actionLead = /^(jak|gdzie|kiedy|how|where|when)\b/i.test(query.trim());
  if (actionLead) return false;

  return tokens.length <= 4;
}

export function extractTrendQueryTokens(query: string): string[] {
  return tokenize(query).filter(
    (token) => token.length > 2 && !PL_STOP_WORDS.has(token),
  );
}

export function articleMatchesTrendQuery(
  query: string,
  article: { headline: string; lead: string; seo_title: string },
): boolean {
  const tokens = extractTrendQueryTokens(query);
  if (tokens.length === 0) return true;

  const text = `${article.headline} ${article.lead} ${article.seo_title}`.toLowerCase();
  const hits = tokens.filter((token) => text.includes(token)).length;
  const required = Math.max(1, Math.ceil(tokens.length * 0.5));

  return hits >= required;
}
