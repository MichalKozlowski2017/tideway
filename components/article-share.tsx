"use client";

import { useCallback, useEffect, useState } from "react";
import type { Locale } from "@/lib/types";
import { ui } from "@/lib/i18n/config";

type ArticleShareProps = {
  url: string;
  title: string;
  locale: Locale;
};

function shareLinks(url: string, title: string) {
  const encoded = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  return {
    wykop: `https://wykop.pl/dodaj/?url=${encoded}`,
    x: `https://twitter.com/intent/tweet?url=${encoded}&text=${encodedTitle}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encoded}`,
  };
}

function ShareIcon() {
  return (
    <svg
      aria-hidden
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
      />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg
      aria-hidden
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
      />
    </svg>
  );
}

const buttonClass =
  "inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3.5 py-2 text-sm font-medium text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900";

const socialClass =
  "inline-flex items-center rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700";

export function ArticleShare({ url, title, locale }: ArticleShareProps) {
  const t = ui[locale];
  const [copied, setCopied] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);

  useEffect(() => {
    setCanNativeShare(
      typeof navigator !== "undefined" && typeof navigator.share === "function",
    );
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt(t.copyLink, url);
    }
  }, [url, t.copyLink]);

  const handleNativeShare = useCallback(async () => {
    try {
      await navigator.share({ title, url });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      await handleCopy();
    }
  }, [title, url, handleCopy]);

  const links = shareLinks(url, title);

  return (
    <div className="mt-6 border-t border-zinc-100 pt-6">
      <p className="text-xs font-medium uppercase tracking-widest text-zinc-400">
        {t.share}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {canNativeShare && (
          <button type="button" onClick={() => void handleNativeShare()} className={buttonClass}>
            <ShareIcon />
            {t.shareNative}
          </button>
        )}
        <button type="button" onClick={() => void handleCopy()} className={buttonClass}>
          <LinkIcon />
          {copied ? t.linkCopied : t.copyLink}
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={links.wykop}
          target="_blank"
          rel="noopener noreferrer"
          className={socialClass}
        >
          Wykop
        </a>
        <a
          href={links.x}
          target="_blank"
          rel="noopener noreferrer"
          className={socialClass}
        >
          X
        </a>
        <a
          href={links.facebook}
          target="_blank"
          rel="noopener noreferrer"
          className={socialClass}
        >
          Facebook
        </a>
      </div>
    </div>
  );
}
