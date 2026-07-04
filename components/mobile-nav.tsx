"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Locale } from "@/lib/types";
import { MAIN_CATEGORIES } from "@/lib/types";
import {
  categoryNavLabel,
  categoryPath,
  dailyDigestPath,
  weeklyDigestPath,
  ui,
} from "@/lib/i18n/config";
import { categorySlug } from "@/lib/types";
import { SiteLogo } from "@/components/site-logo";

const PANEL_MS = 480;

type NavItem = {
  href: string;
  label: string;
  section?: "category" | "digest";
};

function buildNavItems(locale: Locale): NavItem[] {
  const t = ui[locale];
  const categories: NavItem[] = MAIN_CATEGORIES.map((cat) => ({
    href: categoryPath(locale, categorySlug(locale, cat)),
    label: categoryNavLabel(locale, cat),
    section: "category",
  }));
  return [
    ...categories,
    {
      href: dailyDigestPath(locale),
      label: t.dailyDigest,
      section: "digest",
    },
    {
      href: weeklyDigestPath(locale),
      label: t.weeklyDigest,
      section: "digest",
    },
  ];
}

function HamburgerIcon({ open }: { open: boolean }) {
  return (
    <span className="relative flex h-5 w-5 flex-col items-center justify-center">
      <span
        className={`absolute h-0.5 w-5 rounded-full bg-zinc-800 transition-all duration-300 ease-out ${
          open ? "translate-y-0 rotate-45" : "translate-y-[-6px]"
        }`}
      />
      <span
        className={`absolute h-0.5 rounded-full bg-zinc-800 transition-all duration-300 ease-out ${
          open ? "w-0 opacity-0" : "w-5 opacity-100"
        }`}
      />
      <span
        className={`absolute h-0.5 w-5 rounded-full bg-zinc-800 transition-all duration-300 ease-out ${
          open ? "translate-y-0 -rotate-45" : "translate-y-[6px]"
        }`}
      />
    </span>
  );
}

export function MobileNav({ locale }: { locale: Locale }) {
  const [open, setOpen] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [active, setActive] = useState(false);
  const [mounted, setMounted] = useState(false);
  const t = ui[locale];
  const items = buildNavItems(locale);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const onResize = () => {
      if (mq.matches) setOpen(false);
    };
    mq.addEventListener("change", onResize);
    return () => mq.removeEventListener("change", onResize);
  }, []);

  useEffect(() => {
    if (open) {
      setRendered(true);
      document.body.style.overflow = "hidden";
      const frame = requestAnimationFrame(() => {
        requestAnimationFrame(() => setActive(true));
      });
      return () => cancelAnimationFrame(frame);
    }

    setActive(false);
    document.body.style.overflow = "";
    const timer = window.setTimeout(() => setRendered(false), PANEL_MS);
    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [close]);

  const categoryItems = items.filter((item) => item.section === "category");
  const digestItems = items.filter((item) => item.section === "digest");

  const overlay =
    mounted && rendered ? (
      <div className="fixed inset-0 z-100 lg:hidden" role="presentation">
        <button
          type="button"
          className="mobile-nav-backdrop absolute inset-0"
          data-active={active ? "true" : "false"}
          onClick={close}
          aria-label={t.closeMenu}
          tabIndex={-1}
        />

        <nav
          id="mobile-nav-panel"
          className="mobile-nav-panel absolute top-0 right-0 flex h-dvh w-[min(100%,20rem)] flex-col bg-white shadow-2xl ring-1 ring-zinc-950/5"
          data-active={active ? "true" : "false"}
          aria-hidden={!active}
        >
          <div className="border-b border-zinc-100 px-5 py-4 pr-16">
            <div className="flex items-center gap-2.5">
              <SiteLogo className="h-7 w-7 shrink-0 shadow-sm" title={t.siteName} />
              <div>
                <p className="text-sm font-semibold text-zinc-900">{t.siteName}</p>
                <p className="text-xs text-zinc-500">{t.menu}</p>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-4">
            <p
              className="mobile-nav-item px-3 pb-2 text-[11px] font-medium uppercase tracking-widest text-zinc-400"
              data-active={active ? "true" : "false"}
              style={{ transitionDelay: active ? "120ms" : "0ms" }}
            >
              {t.categories}
            </p>
            <ul className="space-y-1">
              {categoryItems.map((item, index) => (
                <li
                  key={item.href}
                  className="mobile-nav-item"
                  data-active={active ? "true" : "false"}
                  style={{
                    transitionDelay: active ? `${160 + index * 50}ms` : "0ms",
                  }}
                >
                  <Link
                    href={item.href}
                    onClick={close}
                    className="block rounded-xl px-3 py-3 text-base font-medium text-zinc-800 transition hover:bg-zinc-100 active:bg-zinc-200"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>

            <p
              className="mobile-nav-item mt-6 px-3 pb-2 text-[11px] font-medium uppercase tracking-widest text-zinc-400"
              data-active={active ? "true" : "false"}
              style={{ transitionDelay: active ? "360ms" : "0ms" }}
            >
              {t.digests}
            </p>
            <ul className="space-y-1">
              {digestItems.map((item, index) => (
                <li
                  key={item.href}
                  className="mobile-nav-item"
                  data-active={active ? "true" : "false"}
                  style={{
                    transitionDelay: active ? `${400 + index * 50}ms` : "0ms",
                  }}
                >
                  <Link
                    href={item.href}
                    onClick={close}
                    className="block rounded-xl px-3 py-3 text-base font-medium text-zinc-800 transition hover:bg-zinc-100 active:bg-zinc-200"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </nav>
      </div>
    ) : null;

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-800 shadow-sm transition hover:bg-zinc-50"
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        aria-label={open ? t.closeMenu : t.openMenu}
      >
        <HamburgerIcon open={open} />
      </button>

      {mounted && overlay ? createPortal(overlay, document.body) : null}
    </div>
  );
}
