import { articlePath } from "@/lib/i18n/config";
import { INDEXNOW_KEY, siteUrl } from "@/lib/site";
import type { Locale } from "@/lib/types";

const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
const MAX_URLS_PER_REQUEST = 10_000;

function isIndexNowEnabled(): boolean {
  // Opt-in: IndexNow triggers immediate crawler waves that keep Neon awake for hours.
  return (
    process.env.INDEXNOW_ENABLED === "true" &&
    Boolean(INDEXNOW_KEY) &&
    process.env.VERCEL_ENV === "production"
  );
}

export function articlePublicUrl(locale: Locale, slug: string): string {
  return `${siteUrl()}${articlePath(locale, slug)}`;
}

/** Notify Bing/Yandex etc. that URLs were added or updated. Fire-and-forget. */
export async function notifyIndexNow(urls: string[]): Promise<void> {
  if (!isIndexNowEnabled() || urls.length === 0) return;

  const host = new URL(siteUrl()).host;
  const keyLocation = `${siteUrl()}/${INDEXNOW_KEY}.txt`;
  const uniqueUrls = [...new Set(urls)].slice(0, MAX_URLS_PER_REQUEST);

  try {
    const response = await fetch(INDEXNOW_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host,
        key: INDEXNOW_KEY,
        keyLocation,
        urlList: uniqueUrls,
      }),
    });

    if (!response.ok) {
      console.warn(`IndexNow failed (${response.status})`);
    }
  } catch (error) {
    console.warn("IndexNow request error:", error);
  }
}
