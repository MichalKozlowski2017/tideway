import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { TagPage } from "@/components/tag-page";
import { getArticlesByTag, resolveTagName } from "@/lib/db/queries";
import { articlePath, tagPath, ui } from "@/lib/i18n/config";
import { itemListJsonLd } from "@/lib/seo/json-ld";
import { SITE_NAME, siteUrl } from "@/lib/site";

export const revalidate = 300;

type Props = { params: Promise<{ tag: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tag: slug } = await params;
  const locale = "pl" as const;
  const tagName = await resolveTagName(locale, slug);
  if (!tagName) return {};

  const t = ui[locale];
  const title = `${t.tagPageTitle.replace("{tag}", tagName)} | ${SITE_NAME}`;
  const description = t.tagPageDescription.replace("{tag}", tagName);

  return {
    title,
    description,
    alternates: {
      canonical: tagPath(locale, slug),
    },
  };
}

export default async function TagiPage({ params }: Props) {
  const { tag: slug } = await params;
  const locale = "pl" as const;
  const tagName = await resolveTagName(locale, slug);
  if (!tagName) notFound();

  const articles = await getArticlesByTag({ locale, tag: tagName, limit: 48 });
  const base = siteUrl();
  const listJsonLd = itemListJsonLd(
    ui[locale].tagPageTitle.replace("{tag}", tagName),
    articles.map((article) => ({
      name: article.headline,
      url: `${base}${articlePath(locale, article.slug)}`,
    })),
  );

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(listJsonLd) }}
      />
      <SiteHeader locale={locale} />
      <TagPage locale={locale} tag={tagName} articles={articles} />
    </>
  );
}
