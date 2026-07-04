/** Lazy headline templates that read like SEO filler, especially in sport essays. */
const LAZY_HEADLINE_END_PL =
  /(?:^|[—–,\s]+)(co dalej\??|a co dalej\??|co to oznacza\??|co oznacza\??)\s*$/i;

const LAZY_HEADLINE_PHRASE_PL =
  /\b(co dalej|co to oznacza|co oznacza) (dla|w|na|z|po)\b/i;

const LAZY_HEADLINE_END_EN =
  /(?:^|[—–,\s]+)(what'?s next\??|what does (it|this) mean\??)\s*$/i;

export function isLazyHeadline(text: string, locale: "pl" | "en" = "pl"): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;

  if (locale === "pl") {
    return (
      LAZY_HEADLINE_END_PL.test(trimmed) ||
      LAZY_HEADLINE_PHRASE_PL.test(trimmed)
    );
  }

  return LAZY_HEADLINE_END_EN.test(trimmed);
}
