import { NextRequest, NextResponse } from "next/server";
import { getArticles } from "@/lib/db/queries";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const locale = searchParams.get("locale") ?? "pl";
  const category = searchParams.get("category") ?? undefined;
  const limit = Number(searchParams.get("limit") ?? "20");

  try {
    const articles = await getArticles({ locale, category, limit });
    return NextResponse.json({ articles });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
