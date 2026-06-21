import { slugify } from "@/lib/utils/hash";

export function tagSlug(tag: string): string {
  return slugify(tag);
}

export function tagFromSlug(slug: string, tags: string[]): string | null {
  return tags.find((tag) => tagSlug(tag) === slug) ?? null;
}
