import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const EN_CATEGORY_TO_PL: Record<string, string> = {
  tech: "tech",
  it: "it",
  technology: "tech",
  gaming: "gry",
  ai: "ai",
  sport: "sport",
  finance: "finanse",
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/en" || pathname === "/en/") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (pathname.startsWith("/en/trends/")) {
    const slug = pathname.slice("/en/trends/".length).split("/")[0];
    const plSlug = EN_CATEGORY_TO_PL[slug] ?? slug;
    return NextResponse.redirect(new URL(`/trendy/${plSlug}`, request.url));
  }

  if (pathname.startsWith("/en/article/")) {
    const slug = pathname.slice("/en/article/".length).split("/")[0];
    return NextResponse.redirect(new URL(`/artykul/${slug}`, request.url));
  }

  if (pathname.startsWith("/en/tag/")) {
    const slug = pathname.slice("/en/tag/".length).split("/")[0];
    return NextResponse.redirect(new URL(`/tagi/${slug}`, request.url));
  }

  if (pathname === "/en/daily-digest") {
    return NextResponse.redirect(new URL("/dzienny-przeglad", request.url));
  }

  if (pathname === "/en/weekly-digest") {
    return NextResponse.redirect(new URL("/tygodniowy-przeglad", request.url));
  }

  return NextResponse.redirect(new URL("/", request.url));
}

export const config = {
  matcher: "/en/:path*",
};
