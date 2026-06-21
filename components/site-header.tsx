import Link from "next/link";
import type { Locale } from "@/lib/types";
import {
  categoryPath,
  dailyDigestPath,
  homePath,
  ui,
  weeklyDigestPath,
} from "@/lib/i18n/config";
import { categorySlug, type Category } from "@/lib/types";

const NAV_CATEGORIES: Category[] = ["technology", "gaming", "ai"];

export function SiteHeader({ locale }: { locale: Locale }) {
  const t = ui[locale];
  const otherLocale: Locale = locale === "pl" ? "en" : "pl";

  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href={homePath(locale)} className="text-xl font-bold text-zinc-900">
            {t.siteName}
          </Link>
          <p className="text-sm text-zinc-500">{t.homeDescription}</p>
        </div>
        <nav className="flex flex-wrap items-center gap-3 text-sm">
          {NAV_CATEGORIES.map((cat) => (
            <Link
              key={cat}
              href={categoryPath(locale, categorySlug(locale, cat))}
              className="text-zinc-700 hover:text-zinc-900"
            >
              {cat === "technology"
                ? locale === "pl"
                  ? "Technologia"
                  : "Technology"
                : cat === "gaming"
                  ? locale === "pl"
                    ? "Gry"
                    : "Gaming"
                  : "AI"}
            </Link>
          ))}
          <Link
            href={dailyDigestPath(locale)}
            className="text-zinc-700 hover:text-zinc-900"
          >
            {t.dailyDigest}
          </Link>
          <Link
            href={weeklyDigestPath(locale)}
            className="text-zinc-700 hover:text-zinc-900"
          >
            {t.weeklyDigest}
          </Link>
          <Link
            href={homePath(otherLocale)}
            className="rounded-full border border-zinc-300 px-3 py-1 text-zinc-600 hover:bg-zinc-50"
          >
            {otherLocale.toUpperCase()}
          </Link>
        </nav>
      </div>
    </header>
  );
}
