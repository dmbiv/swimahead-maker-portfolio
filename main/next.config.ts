import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  experimental: {
    staleTimes: {
      dynamic: 30,
      static: 300,
    },
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
