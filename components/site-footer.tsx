import Link from "next/link";
import { aboutPath, privacyPath, ui } from "@/lib/i18n/config";
import type { Locale } from "@/lib/types";

export function SiteFooter({ locale = "pl" }: { locale?: Locale }) {
  const t = ui[locale];

  return (
    <footer className="mt-auto border-t border-zinc-200/80 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:flex-row sm:items-end sm:justify-between">
        <div className="text-center sm:text-left">
          <p className="font-medium text-zinc-900">{t.siteName}</p>
          <p className="mt-1 max-w-md text-sm text-zinc-500">{t.homeDescription}</p>
          <nav
            className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm sm:justify-start"
            aria-label={locale === "pl" ? "Informacje prawne" : "Legal"}
          >
            <Link
              href={aboutPath(locale)}
              className="text-zinc-500 transition hover:text-zinc-900"
            >
              {t.aboutPage}
            </Link>
            <Link
              href={privacyPath(locale)}
              className="text-zinc-500 transition hover:text-zinc-900"
            >
              {t.privacyPage}
            </Link>
          </nav>
        </div>
        <p className="text-center text-sm text-zinc-400 sm:text-right">
          © {new Date().getFullYear()} {t.siteName}
        </p>
      </div>
    </footer>
  );
}
