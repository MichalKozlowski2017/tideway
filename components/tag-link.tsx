import Link from "next/link";
import type { Locale } from "@/lib/types";
import { tagPath } from "@/lib/i18n/config";
import { tagSlug } from "@/lib/tags";

const defaultClassName =
  "rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-600 transition hover:bg-blue-50 hover:text-blue-700";

export function TagLink({
  tag,
  locale,
  className = defaultClassName,
}: {
  tag: string;
  locale: Locale;
  className?: string;
}) {
  const slug = tagSlug(tag);
  if (!slug) return <span className={className}>{tag}</span>;

  return (
    <Link href={tagPath(locale, slug)} className={className}>
      {tag}
    </Link>
  );
}
