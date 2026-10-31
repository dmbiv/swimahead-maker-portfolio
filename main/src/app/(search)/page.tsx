import type { Metadata } from "next";
import { Suspense } from "react";
import { ExploreContent, ExploreFallback } from "./explore-content";
import type { PublicProgramSearchParams } from "@/lib/public-programs";

export const metadata: Metadata = {
  title: "College Swimming Recruiting & Program Search",
  description: "Use SwimAhead to search college swimming programs by division, location, academics, cost, and athletic fit for your swimming recruiting journey.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "SwimAhead",
    title: "SwimAhead College Swimming Recruiting & Program Search",
    description: "Search college swimming programs and compare athletic, academic, location, and cost fit with SwimAhead.",
  },
  twitter: {
    card: "summary",
    title: "SwimAhead College Swimming Recruiting & Program Search",
    description: "Search college swimming programs and compare athletic, academic, location, and cost fit with SwimAhead.",
  },
};
export const unstable_instant = {
  prefetch: "runtime",
  samples: [{
    searchParams: {
      q: null,
      squad: null,
      division: null,
      conference: null,
      state: null,
      control: null,
      enrollmentMin: null,
      enrollmentMax: null,
      netPriceMax: null,
      admissionMax: null,
      academicTest: null,
      academicMode: null,
      academicValue: null,
      cip: null,
      sort: null,
      fitMode: null,
      fitRank: null,
      fitEvent: null,
      fitMatch: null,
      showRuledOut: null,
      page: null,
    },
  }],
};

export default function Home({
  searchParams,
}: {
  searchParams: Promise<PublicProgramSearchParams>;
}) {
  return (
    <Suspense fallback={<ExploreFallback />}>
      <ExploreContent params={searchParams} />
    </Suspense>
  );
}
