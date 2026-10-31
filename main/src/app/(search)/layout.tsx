import { Suspense } from "react";
import { Shell } from "@/components/shell";
import { getOptionalAuthContext } from "@/lib/auth";

export const unstable_instant = { prefetch: "static" };

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return (
    <Shell
      persona="swimmer"
      subtitle={<Suspense fallback={<SubtitleFallback />}><SwimmerSubtitle /></Suspense>}
    >
      {children}
    </Shell>
  );
}

function SubtitleFallback() {
  return <>Search colleges by athletics, academics, location, and cost</>;
}

async function SwimmerSubtitle() {
  const auth = await getOptionalAuthContext();
  const subtitle = auth?.accountType === "swimmer" && auth.onboardingCompleted
    ? auth.displayName || auth.email
    : "Search colleges by athletics, academics, location, and cost";
  return <>{subtitle}</>;
}
