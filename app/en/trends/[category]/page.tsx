import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CategoryPage } from "@/components/category-page";
import { SiteHeader } from "@/components/site-header";
import { getArticlesPaginated } from "@/lib/db/queries";
import { categoryLabels } from "@/lib/i18n/config";
import { SITE_NAME } from "@/lib/site";
import { categoryFromSlug } from "@/lib/types";

export const revalidate = 14400;

type Props = { params: Promise<{ category: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category: slug } = await params;
  const category = categoryFromSlug(slug);
  if (!category) return {};
  const labels = categoryLabels.en[category];
  return {
    title: `${labels.title} | ${SITE_NAME}`,
    description: labels.description,
  };
}

export default async function EnTrendsCategoryPage({ params }: Props) {
  const { category: slug } = await params;
  const category = categoryFromSlug(slug);
  if (!category) notFound();

  const locale = "en" as const;
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
