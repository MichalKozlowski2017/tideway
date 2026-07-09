"use client";

import Image from "next/image";
import { useState } from "react";
import type { Category } from "@/lib/types";
import { CATEGORY_PLACEHOLDER } from "@/lib/articles/resolve-image";

type ArticleImageProps = {
  imageUrl: string | null | undefined;
  category: string;
  alt: string;
  priority?: boolean;
  variant?: "card" | "hero";
};

export function ArticleImage({
  imageUrl,
  category,
  alt,
  priority = false,
  variant = "card",
}: ArticleImageProps) {
  const [broken, setBroken] = useState(false);
  const placeholder =
    CATEGORY_PLACEHOLDER[category as Category] ?? CATEGORY_PLACEHOLDER.tech;

  const hero = variant === "hero";
  const aspect = hero ? "aspect-[21/9]" : "aspect-[16/10]";

  if (imageUrl && !broken) {
    return (
      <div
        className={`relative ${aspect} w-full overflow-hidden ${hero ? "rounded-2xl" : ""}`}
      >
        <Image
          src={imageUrl}
          alt={alt}
          fill
          unoptimized
          priority={priority}
          sizes={hero ? "(max-width: 768px) 100vw, 768px" : "(max-width: 640px) 100vw, 320px"}
          className="object-cover transition duration-500 group-hover:scale-[1.02]"
          onError={() => setBroken(true)}
        />
      </div>
    );
  }

  return (
    <div
      className={`flex ${aspect} w-full flex-col justify-end bg-linear-to-br p-4 ${placeholder.gradient} ${hero ? "rounded-2xl" : ""}`}
      aria-hidden
    >
      <span className={`text-xs font-semibold uppercase tracking-widest ${placeholder.accent}`}>
        {placeholder.label}
      </span>
    </div>
  );
}
