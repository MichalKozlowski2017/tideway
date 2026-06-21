import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "TrendPulse",
    template: "%s | TrendPulse",
  },
  description:
    "Automatyczne podsumowania trendów — technologia, gry, AI i więcej.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://trendpulse.app",
  ),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pl"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900">
        {children}
        <footer className="mt-auto border-t border-zinc-200 bg-white py-6 text-center text-sm text-zinc-500">
          © {new Date().getFullYear()} TrendPulse
        </footer>
      </body>
    </html>
  );
}
