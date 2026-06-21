import Link from "next/link";
import type { Locale } from "@/lib/types";
import { MAIN_CATEGORIES } from "@/lib/types";
import {
  categoryNavLabel,
  categoryPath,
  dailyDigestPath,
  homePath,
  ui,
  weeklyDigestPath,
} from "@/lib/i18n/config";
import { categorySlug } from "@/lib/types";
import { MobileNav } from "@/components/mobile-nav";

export function SiteHeader({ locale }: { locale: Locale }) {
  const t = ui[locale];

  return (
    <header className="sticky top-0 z-110 border-b border-zinc-200/80 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
        <Link href={homePath(locale)} className="group inline-flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-sm font-bold text-white shadow-sm">
            T
          </span>
          <span className="min-w-0">
            <span className="block truncate text-lg font-semibold tracking-tight text-zinc-900 group-hover:text-zinc-700">
              {t.siteName}
            </span>
            <span className="block truncate text-xs text-zinc-500">
              {locale === "pl" ? "Trendy na co dzień" : "Daily trends"}
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 text-sm lg:flex">
          {MAIN_CATEGORIES.map((cat) => (
            <Link
              key={cat}
              href={categoryPath(locale, categorySlug(locale, cat))}
              className="rounded-lg px-3 py-1.5 text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900"
            >
              {categoryNavLabel(locale, cat)}
            </Link>
          ))}
          <span className="mx-1 h-4 w-px bg-zinc-200" aria-hidden />
          <Link
            href={dailyDigestPath(locale)}
            className="rounded-lg px-3 py-1.5 text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900"
          >
            {t.dailyDigest}
          </Link>
          <Link
            href={weeklyDigestPath(locale)}
            className="rounded-lg px-3 py-1.5 text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900"
          >
            {t.weeklyDigest}
          </Link>
        </nav>

        <MobileNav locale={locale} />
      </div>
    </header>
  );
}
