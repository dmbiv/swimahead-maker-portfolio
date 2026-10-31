import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Loading from "./loading";

export const metadata: Metadata = { title: "Outreach" };
export const unstable_instant = {
  prefetch: "static",
  samples: [{ searchParams: { program: null } }],
};

export default function OutreachHome({ searchParams }: {
  searchParams: Promise<{ program?: string | string[] }>;
}) {
  return (
    <Suspense fallback={<Loading />}>
      {searchParams.then(({ program }) => <OutreachRedirect requestedProgram={program} />)}
    </Suspense>
  );
}

function OutreachRedirect({ requestedProgram }: { requestedProgram?: string | string[] }) {
  if (typeof requestedProgram === "string") {
    redirect(`/s/outreach/drafts/new?program=${encodeURIComponent(requestedProgram)}`);
  }
  redirect("/s/outreach/campaigns");
  return null;
}
