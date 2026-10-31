import type { MetadataRoute } from "next";
import { absoluteSiteUrl, siteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: [
        "/",
        "/for-coaches",
        "/s/about",
        "/legal",
        "/terms",
        "/privacy",
        "/billing-policy",
      ],
      disallow: [
        "/api/",
        "/auth/",
        "/c/",
        "/s/",
        "/q/",
        "/r/",
        "/legal/accept",
        "/onboarding",
        "/subscribe",
        "/sign-in",
        "/sign-up",
        "/forgot-password",
        "/update-password",
      ],
    },
    sitemap: absoluteSiteUrl("/sitemap.xml"),
    host: siteUrl().origin,
  };
}
