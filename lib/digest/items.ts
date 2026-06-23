export type DigestItem = {
  text: string;
  slug?: string;
};

export type DigestSource = {
  headline: string;
  slug: string;
};

function wordSet(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length > 3),
  );
}

function overlapScore(a: string, b: string): number {
  const wordsA = wordSet(a);
  const wordsB = wordSet(b);
  let score = 0;
  for (const w of wordsB) {
    if (wordsA.has(w)) score += 1;
  }
  const lowerA = a.toLowerCase();
  const lowerB = b.toLowerCase();
  if (lowerA.includes(lowerB) || lowerB.includes(lowerA)) {
    score += 3;
  }
  return score;
}

export function findBestDigestMatch(
  bulletText: string,
  sources: DigestSource[],
): string | undefined {
  let best: { slug: string; score: number } | undefined;

  for (const source of sources) {
    const score = overlapScore(bulletText, source.headline);
    if (!best || score > best.score) {
      best = { slug: source.slug, score };
    }
  }

  return best && best.score >= 2 ? best.slug : undefined;
}

export function linkDigestBullets(
  items: DigestItem[],
  sources: DigestSource[],
): DigestItem[] {
  if (!sources.length) return items;

  return items.map((item) => {
    if (item.slug) return item;
    const slug = findBestDigestMatch(item.text, sources);
    return slug ? { ...item, slug } : item;
  });
}

export function parseDigestSummary(summary: unknown): DigestItem[] {
  if (Array.isArray(summary)) {
    return summary
      .filter((x): x is string => typeof x === "string")
      .map((text) => ({ text }));
  }

  if (summary && typeof summary === "object") {
    const s = summary as {
      format?: string;
      items?: Array<{ text?: string; slug?: string }>;
    };
    if (s.format === "digest" && Array.isArray(s.items)) {
      return s.items
        .filter((item) => typeof item.text === "string" && item.text.length > 0)
        .map((item) => ({
          text: item.text!,
          slug: typeof item.slug === "string" ? item.slug : undefined,
        }));
    }
  }

  return [];
}
