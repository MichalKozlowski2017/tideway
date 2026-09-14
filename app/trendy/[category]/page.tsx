import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CategoryPage } from "@/components/category-page";
import { SiteHeader } from "@/components/site-header";
import { getArticlesPaginated } from "@/lib/db/queries";
import { categoryLabels, categoryPath } from "@/lib/i18n/config";
import { SITE_NAME, siteUrl } from "@/lib/site";
import { categoryFromSlug, categorySlug } from "@/lib/types";

export const revalidate = 86400;

type Props = { params: Promise<{ category: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category: slug } = await params;
  const category = categoryFromSlug(slug);
  if (!category) return {};
  const labels = categoryLabels.pl[category];
  const canonical = `${siteUrl()}${categoryPath("pl", categorySlug("pl", category))}`;
  return {
    title: `${labels.title} | ${SITE_NAME}`,
    description: labels.description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      url: canonical,
      title: labels.title,
      description: labels.description,
      siteName: SITE_NAME,
    },
  };
}

export default async function TrendyCategoryPage({ params }: Props) {
  const { category: slug } = await params;
  const category = categoryFromSlug(slug);
  if (!category) notFound();

  const locale = "pl" as const;
  const result = await getArticlesPaginated({ locale, category, page: 1 });

  return (
    <>
      <SiteHeader locale={locale} />
      <CategoryPage
        locale={locale}
        category={category}
        articles={result.articles}
        total={result.total}
        totalPages={result.totalPages}
      />
    </>
  );
}
