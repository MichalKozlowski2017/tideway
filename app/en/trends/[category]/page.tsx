import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CategoryPage } from "@/components/category-page";
import { SiteHeader } from "@/components/site-header";
import { getArticles } from "@/lib/db/queries";
import { categoryLabels } from "@/lib/i18n/config";
import { SITE_NAME } from "@/lib/site";
import { categoryFromSlug } from "@/lib/types";

export const revalidate = 300;

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

  const articles = await getArticles({
    locale: "en",
    category,
    limit: 24,
  });

  return (
    <>
      <SiteHeader locale="en" />
      <CategoryPage locale="en" category={category} articles={articles} />
    </>
  );
}
