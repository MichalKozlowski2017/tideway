export const SITE_NAME = "Tideway";

/** Canonical production URL (PL-first). */
export const PRIMARY_SITE_URL = "https://tideway.pl";

/** Reserved for EU/international expansion — redirects to .pl for now. */
export const SECONDARY_SITE_URL = "https://tideway.eu";

/** Fallback when NEXT_PUBLIC_SITE_URL is unset (e.g. sitemap in CI). */
export const DEFAULT_SITE_URL = PRIMARY_SITE_URL;

export function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_SITE_URL;
}
