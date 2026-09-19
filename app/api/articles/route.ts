import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import {
  ARTICLES_PAGE_SIZE,
  getArticlesByTagPaginated,
  getArticlesPaginated,
} from "@/lib/db/queries";

const getCachedArticlesPage = unstable_cache(
  async (
    locale: string,
    category: string | undefined,
    tag: string | undefined,
    articleType: string | undefined,
    page: number,
    pageSize: number,
  ) => {
    if (tag) {
      return getArticlesByTagPaginated({ locale, tag, page, pageSize });
    }
    return getArticlesPaginated({
      locale,
      category,
      articleType,
      page,
      pageSize,
    });
  },
  ["api-articles"],
  { revalidate: 86400 },
);

function parsePositiveInt(value: string | null, fallback: number): number {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const locale = searchParams.get("locale") ?? "pl";
  const category = searchParams.get("category") ?? undefined;
  const tag = searchParams.get("tag") ?? undefined;
  const articleType = searchParams.get("articleType") ?? undefined;
  const page = parsePositiveInt(searchParams.get("page"), 1);
  const pageSize = parsePositiveInt(
    searchParams.get("pageSize"),
    ARTICLES_PAGE_SIZE,
  );

  try {
    const result = await getCachedArticlesPage(
      locale,
      category,
      tag,
      articleType,
      page,
      pageSize,
    );

    return NextResponse.json(result, {
      headers: {
        "Cache-Control":
          "public, s-maxage=86400, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
