import type { Metadata } from "next";
import { Suspense } from "react";
import { Bai_Jamjuree } from "next/font/google";
import { absoluteSiteUrl, SITE_DESCRIPTION, SITE_NAME, siteUrl } from "@/lib/seo";
import "./globals.css";

const brandFont = Bai_Jamjuree({
  subsets: ["latin"],
  weight: "700",
  variable: "--font-brand",
  display: "swap",
});

const googleSiteVerification = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim();

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  applicationName: SITE_NAME,
  title: {
    default: "SwimAhead | College Swimming Recruiting",
    template: "%s | SwimAhead",
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "SwimAhead",
    "SwimAhead recruiting",
    "SwimAhead swimming",
    "SwimAhead coach",
    "college swimming recruiting",
    "swim recruiting",
    "swimming recruiting software",
    "college swim coach recruiting software",
    "college swimming program search",
  ],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: "sports",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: SITE_NAME,
    title: "SwimAhead | College Swimming Recruiting",
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary",
    title: "SwimAhead | College Swimming Recruiting",
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  verification: googleSiteVerification
    ? { google: googleSiteVerification }
    : undefined,
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${absoluteSiteUrl()}#organization`,
      name: SITE_NAME,
      url: absoluteSiteUrl(),
      logo: absoluteSiteUrl("/icon.png"),
      description: SITE_DESCRIPTION,
    },
    {
      "@type": "WebSite",
      "@id": `${absoluteSiteUrl()}#website`,
      name: SITE_NAME,
      alternateName: "SwimAhead College Swimming Recruiting",
      url: absoluteSiteUrl(),
      description: SITE_DESCRIPTION,
      inLanguage: "en-US",
      publisher: { "@id": `${absoluteSiteUrl()}#organization` },
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${absoluteSiteUrl()}#application`,
      name: SITE_NAME,
      alternateName: "SwimAhead Recruiting",
      url: absoluteSiteUrl(),
      description: SITE_DESCRIPTION,
      applicationCategory: "SportsApplication",
      operatingSystem: "Web",
      audience: [
        { "@type": "Audience", audienceType: "College swimming recruits and families" },
        { "@type": "Audience", audienceType: "College swimming coaches" },
      ],
      featureList: [
        "College swimming program search",
        "Swimmer and program fit comparison",
        "College swim recruit discovery",
        "Recruiting campaign and outreach management",
        "Roster planning and recruiting questionnaires",
      ],
      provider: { "@id": `${absoluteSiteUrl()}#organization` },
    },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`h-full antialiased ${brandFont.variable}`} suppressHydrationWarning>
      <body className="min-h-full" suppressHydrationWarning>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
          }}
        />
        <Suspense>{children}</Suspense>
      </body>
    </html>
  );
}
