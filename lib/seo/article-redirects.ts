/**
 * Permanent redirects for unpublished duplicate or renamed article slugs.
 * Keeps link equity and clears GSC 404s after dedup cleanup.
 */
export const ARTICLE_SLUG_REDIRECTS: Record<string, string> = {
  "ake-transfer-fenerbahce": "nathan-ake-transfer-fenerbahce",
  "elektryki-rynek-rejestracji": "ranking-motoryzacja-polska-2023",
  "nagel-ecb-inflacja-stopy-decyzje": "ecb-nagel-stopy-procentowe-1",
  "onana-wypozyczenie-trabzonspor": "onana-wypozyczenie-trabzonspor-1",
  "anglia-panama-quiz": "anglia-panama-2018-quiz",
};

export function articleSlugRedirects(): Array<{
  source: string;
  destination: string;
  permanent: true;
}> {
  return Object.entries(ARTICLE_SLUG_REDIRECTS).map(([from, to]) => ({
    source: `/artykul/${from}`,
    destination: `/artykul/${to}`,
    permanent: true,
  }));
}
