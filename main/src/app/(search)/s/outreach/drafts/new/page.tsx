import { Suspense } from "react";
import Link from "@/components/app-link";
import type { Metadata } from "next";
import { loadOutreachNewDraft } from "../../data";
import { FolderMark, OutreachBreadcrumbs } from "../../outreach-ui";
import { OutreachUnavailable } from "../../unavailable";
import { DraftStart } from "./draft-start";
import Loading from "../../loading";

export const metadata: Metadata = { title: "New school draft" };
export const unstable_instant = {
  prefetch: "static",
  samples: [{ searchParams: { program: null } }],
};

export default function NewDraftPage({ searchParams }: {
  searchParams: Promise<{ program?: string | string[] }>;
}) {
  return (
    <Suspense fallback={<Loading />}>
      {searchParams.then(({ program }) => <NewDraft requestedProgram={program} />)}
    </Suspense>
  );
}

async function NewDraft({ requestedProgram }: { requestedProgram?: string | string[] }) {
  const workspace = await loadOutreachNewDraft();
  if (workspace.status === "unavailable") return <OutreachUnavailable message={workspace.message} />;

  return (
    <div className="space-y-4">
      <OutreachBreadcrumbs items={[{ label: "All drafts", href: "/s/outreach/drafts" }, { label: "New school draft" }]} />
      <section className="wr-card mx-auto max-w-2xl p-5 sm:p-7">
        <FolderMark />
        <h2 className="mt-4 text-lg font-semibold">Choose where this file belongs</h2>
        <p className="mt-1 max-w-xl text-sm leading-6 text-ink-2">Choose the exact program and campaign. Applying the template fills its placeholders, saves the school draft, and opens the final email for editing.</p>
        {workspace.savedPrograms.length === 0 ? (
          <div className="mt-5 rounded-[var(--radius)] border border-dashed border-line-strong p-5 text-center">
            <p className="text-sm font-medium">No saved programs</p>
            <p className="mt-1 text-xs text-ink-3">Save an exact swimming squad before creating outreach.</p>
            <Link href="/s/explore" className="wr-btn wr-btn--primary mt-3">Find programs</Link>
          </div>
        ) : workspace.campaigns.length === 0 ? (
          <div className="mt-5 rounded-[var(--radius)] border border-dashed border-line-strong p-5 text-center">
            <p className="text-sm font-medium">No campaign folders</p>
            <p className="mt-1 text-xs text-ink-3">Build and review a master template before making a school copy.</p>
            <Link href="/s/outreach/campaigns/new" className="wr-btn wr-btn--primary mt-3">Create campaign</Link>
          </div>
        ) : (
          <div className="mt-6"><DraftStart programs={workspace.savedPrograms} campaigns={workspace.campaigns} drafts={workspace.drafts} initialProgramId={typeof requestedProgram === "string" ? requestedProgram : undefined} /></div>
        )}
      </section>
    </div>
  );
}
