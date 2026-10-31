import { Suspense } from "react";
import Link from "@/components/app-link";
import type { Metadata } from "next";
import { Badge } from "@/components/ui";
import { OUTREACH_STAGE_LABELS, type OutreachDraftStatus } from "@/lib/swimmer-outreach";
import { loadOutreachDraftList } from "../data";
import { FileMark, OutreachBreadcrumbs } from "../outreach-ui";
import { OutreachUnavailable } from "../unavailable";
import Loading from "../loading";

export const metadata: Metadata = { title: "Outreach drafts" };
export const unstable_instant = {
  prefetch: "static",
  samples: [{ searchParams: { status: null } }],
};

const updatedFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });
const FILTERS: Array<{ value: "all" | OutreachDraftStatus; label: string }> = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "ready", label: "Ready" },
  { value: "sent", label: "Sent" },
];

export default function AllDraftsPage({ searchParams }: {
  searchParams: Promise<{ status?: string | string[] }>;
}) {
  return (
    <Suspense fallback={<Loading />}>
      {searchParams.then(({ status }) => <AllDrafts requestedStatus={status} />)}
    </Suspense>
  );
}

async function AllDrafts({ requestedStatus }: { requestedStatus?: string | string[] }) {
  const status = typeof requestedStatus === "string" && ["draft", "ready", "sent"].includes(requestedStatus)
    ? requestedStatus as OutreachDraftStatus
    : "all";
  const workspace = await loadOutreachDraftList();
  if (workspace.status === "unavailable") return <OutreachUnavailable message={workspace.message} />;
  const drafts = workspace.drafts.filter((draft) => status === "all" || draft.status === status);
  const campaignsById = new Map(workspace.campaigns.map((campaign) => [campaign.id, campaign]));
  const programsById = new Map(workspace.programs.map((program) => [program.id, program]));

  return (
    <div className="space-y-4">
      <OutreachBreadcrumbs items={[{ label: "All drafts" }]} />
      <section className="wr-card overflow-hidden p-0">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line px-4 py-4 sm:px-5">
          <div>
            <h2 className="text-base font-semibold">School draft files</h2>
            <p className="mt-1 text-xs text-ink-3">Every personalized file, regardless of campaign folder.</p>
          </div>
          <Link href="/s/outreach/drafts/new" className="wr-btn wr-btn--primary">New school draft</Link>
        </div>
        <div className="flex gap-1 overflow-x-auto border-b border-line px-4 py-2">
          {FILTERS.map((filter) => (
            <Link key={filter.value} href={filter.value === "all" ? "/s/outreach/drafts" : `/s/outreach/drafts?status=${filter.value}`} aria-current={status === filter.value ? "page" : undefined} className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-medium ${status === filter.value ? "border-accent bg-accent/10 text-accent" : "border-line text-ink-3 hover:text-ink"}`}>{filter.label}</Link>
          ))}
        </div>
        {drafts.length === 0 ? (
          <div className="p-10 text-center">
            <FileMark className="mx-auto" />
            <h3 className="mt-3 text-sm font-semibold">{workspace.drafts.length ? `No ${status} files` : "No school drafts yet"}</h3>
            <p className="mx-auto mt-1 max-w-md text-xs text-ink-3">Choose a campaign and an exact saved program to make a personalized file.</p>
            <Link href="/s/outreach/drafts/new" className="wr-btn wr-btn--primary mt-4">Start a draft</Link>
          </div>
        ) : (
          <div className="divide-y divide-line">
            {drafts.map((draft) => {
              const campaign = campaignsById.get(draft.templateId);
              const program = programsById.get(draft.programId);
              if (!campaign || !program) return null;
              return (
                <Link key={draft.id} href={`/s/outreach/campaigns/${campaign.id}/drafts/${program.id}`} className="flex min-w-0 items-center gap-3 px-4 py-3.5 hover:bg-sunken/50 sm:px-5">
                  <FileMark className="shrink-0 scale-75" />
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-sm">{program.short}</strong>
                    <span className="mt-0.5 block truncate text-xs text-ink-3">{campaign.name} · {OUTREACH_STAGE_LABELS[campaign.stage]}{draft.coachName ? ` · ${draft.coachName}` : ""}</span>
                  </span>
                  <span className="hidden text-[11px] text-ink-3 md:block">Updated {updatedFormatter.format(new Date(draft.updatedAt))}</span>
                  <Badge tone={draft.status === "ready" ? "good" : draft.status === "sent" ? "accent" : "neutral"}>{draft.status === "ready" ? "Ready" : draft.status === "sent" ? "Sent" : "Draft"}</Badge>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
