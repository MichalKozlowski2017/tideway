import { extractImageFromHtml, isValidImageUrl } from "@/lib/sources/extract-image";

const FETCH_TIMEOUT_MS = 8_000;
const MAX_HTML_BYTES = 80_000;

export async function fetchOgImage(pageUrl: string): Promise<string | null> {
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
        "User-Agent": "Tideway/1.0 (image preview)",
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

    const fromMeta = extractImageFromHtml(html);
    return fromMeta && isValidImageUrl(fromMeta) ? fromMeta : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
