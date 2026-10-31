import { Suspense } from "react";
import Link from "@/components/app-link";
import type { Metadata } from "next";
import { Badge } from "@/components/ui";
import { OUTREACH_STAGE_LABELS } from "@/lib/swimmer-outreach";
import { DeleteCampaignButton } from "../campaign-actions";
import { loadOutreachCampaignList } from "../data";
import Loading from "../loading";
import { OutreachUnavailable } from "../unavailable";

export const metadata: Metadata = { title: "Outreach campaigns" };
export const unstable_instant = { prefetch: "static" };

const updatedFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

export default function CampaignFoldersPage() {
  return <Suspense fallback={<Loading />}><CampaignFolders /></Suspense>;
}

async function CampaignFolders() {
  const workspace = await loadOutreachCampaignList();
  if (workspace.status === "unavailable") return <OutreachUnavailable message={workspace.message} />;

  return (
    <section className="wr-card overflow-hidden p-0" aria-labelledby="campaign-list-title">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <h2 id="campaign-list-title" className="text-sm font-semibold">Campaigns and templates</h2>
          <p className="mt-0.5 text-[11px] text-ink-3">{workspace.campaigns.length} {workspace.campaigns.length === 1 ? "campaign" : "campaigns"}</p>
        </div>
        {workspace.campaigns.length > 0 && (
          <Link href="/s/outreach/campaigns/new" className="wr-btn wr-btn--primary wr-btn--small">Create new</Link>
        )}
      </div>

      {workspace.campaigns.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <h3 className="text-sm font-semibold">No campaigns yet</h3>
          <p className="mt-1 text-xs text-ink-3">Create a reusable template, then apply it to saved schools.</p>
          <Link href="/s/outreach/campaigns/new" className="wr-btn wr-btn--primary mt-3">Create campaign</Link>
        </div>
      ) : (
        <div className="divide-y divide-line">
          {workspace.campaigns.map((campaign) => {
            const draftCount = workspace.draftCounts[campaign.id] ?? 0;
            return (
              <div key={campaign.id} className="flex min-w-0 flex-col gap-2 px-4 py-3 hover:bg-sunken/35 sm:flex-row sm:items-center">
                <Link href={`/s/outreach/campaigns/${campaign.id}`} className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <strong className="truncate text-sm hover:text-accent">{campaign.name}</strong>
                    <Badge tone="neutral">{OUTREACH_STAGE_LABELS[campaign.stage]}</Badge>
                  </span>
                  <span className="mt-1 block truncate text-xs text-ink-3">{campaign.subjectTemplate}</span>
                </Link>
                <span className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
                  <span className="text-right text-[10px] leading-4 text-ink-3">
                    <span className="block">{draftCount} {draftCount === 1 ? "school" : "schools"}</span>
                    <span className="hidden md:block">{updatedFormatter.format(new Date(campaign.updatedAt))}</span>
                  </span>
                  <Link href={`/s/outreach/campaigns/${campaign.id}`} className="wr-btn wr-btn--neutral wr-btn--small">Open</Link>
                  <Link href={`/s/outreach/campaigns/${campaign.id}/template`} className="wr-btn wr-btn--ghost wr-btn--small">Edit</Link>
                  <DeleteCampaignButton campaignId={campaign.id} name={campaign.name} draftCount={draftCount} />
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
