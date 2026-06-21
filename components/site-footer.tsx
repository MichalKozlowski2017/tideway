import { ui } from "@/lib/i18n/config";
import type { Locale } from "@/lib/types";

export function SiteFooter({ locale = "pl" }: { locale?: Locale }) {
  const t = ui[locale];

  return (
    <footer className="mt-auto border-t border-zinc-200/80 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-center sm:flex-row sm:text-left">
        <div>
          <p className="font-medium text-zinc-900">{t.siteName}</p>
          <p className="mt-1 text-sm text-zinc-500">{t.homeDescription}</p>
        </div>
        <p className="text-sm text-zinc-400">
          © {new Date().getFullYear()} {t.siteName}
        </p>
      </div>
    </footer>
  );
}
