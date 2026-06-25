import { stripHtml, truncateText } from "@/lib/sources/extract-text";

const FETCH_TIMEOUT_MS = 8_000;
const MAX_HTML_BYTES = 80_000;
const EXCERPT_MAX = 1_500;

function extractMetaDescription(html: string): string | null {
  const patterns = [
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i,
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      const text = stripHtml(match[1]);
      if (text.length >= 40) return text;
    }
  }

  return null;
}

function extractParagraphs(html: string): string | null {
  const scoped =
    html.match(/<article[\s\S]*?<\/article>/i)?.[0] ??
    html.match(/<main[\s\S]*?<\/main>/i)?.[0] ??
    html;

  const paragraphs = [...scoped.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => stripHtml(match[1]))
    .filter((paragraph) => paragraph.length > 40);

  if (!paragraphs.length) return null;
  return paragraphs.slice(0, 3).join("\n\n");
}

export async function fetchPageExcerpt(pageUrl: string): Promise<string | null> {
  try {
    new URL(pageUrl);
  } catch {
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(pageUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Tideway/1.0 (article excerpt)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });

    if (!response.ok) return null;

    const reader = response.body?.getReader();
    if (!reader) return null;

    const decoder = new TextDecoder();
    let html = "";
    let total = 0;

    while (total < MAX_HTML_BYTES) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      html += decoder.decode(value, { stream: true });
      total += value.length;
    }

    html += decoder.decode();
    reader.cancel().catch(() => undefined);

    const excerpt =
      extractMetaDescription(html) ?? extractParagraphs(html);
    if (!excerpt) return null;

    return truncateText(excerpt, EXCERPT_MAX);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
