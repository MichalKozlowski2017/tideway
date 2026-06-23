export const SITE_NAME = "Tideway";

/** Public contact for legal / privacy inquiries. */
export const CONTACT_EMAIL = "mkdev.appslab@gmail.com";

/** Canonical production URL (PL-first). */
export const PRIMARY_SITE_URL = "https://tideway.pl";

/** Reserved for EU/international expansion — redirects to .pl for now. */
export const SECONDARY_SITE_URL = "https://tideway.eu";

/** Fallback when NEXT_PUBLIC_SITE_URL is unset (e.g. sitemap in CI). */
export const DEFAULT_SITE_URL = PRIMARY_SITE_URL;

/** Publisher logo for JSON-LD (min 112×112). */
export const PUBLISHER_LOGO_URL = `${PRIMARY_SITE_URL}/logo.svg`;

/**
 * IndexNow key — must match `public/{INDEXNOW_KEY}.txt` file content.
 * Set INDEXNOW_KEY on Vercel to the same value.
 */
export const INDEXNOW_KEY =
  process.env.INDEXNOW_KEY ?? "d4e8f2a91b6c3e7f0a8d5b2c9e1f4a6";

export const RSS_FEED_PATH = "/feed.xml";

export function siteUrl(): string {
  // Production builds must never emit localhost in sitemap, canonical, OG, etc.
  if (process.env.VERCEL_ENV === "production") {
    return PRIMARY_SITE_URL;
  }

  const env = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  return env ?? DEFAULT_SITE_URL;
}
