import type { NextConfig } from "next";
import { PRIMARY_SITE_URL } from "./lib/site";

const secondaryHosts = ["tideway.eu", "www.tideway.eu", "www.tideway.pl"];

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/trendy/technologia",
        destination: "/trendy/tech",
        permanent: true,
      },
      ...secondaryHosts.map((host) => ({
        source: "/:path*",
        has: [{ type: "host" as const, value: host }],
        destination: `${PRIMARY_SITE_URL}/:path*`,
        permanent: true,
      })),
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
  },
};

export default nextConfig;
