import { Suspense } from "react";
import Link from "@/components/app-link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui";
import {
  OUTREACH_STAGE_LABELS,
  outreachStageSupportsResults,
  removeOutreachResultsBlock,
  renderOutreachTimes,
} from "@/lib/swimmer-outreach";
import { DeleteCampaignButton } from "../../campaign-actions";
import { ApplyTemplateButton } from "../../apply-template-button";
import { loadOutreachCampaignFolder } from "../../data";
import { OutreachBreadcrumbs } from "../../outreach-ui";
import { OutreachUnavailable } from "../../unavailable";
import CampaignLoading from "./loading";

const updatedFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });
export const unstable_instant = {
  prefetch: "static",
  samples: [{ params: { campaignId: "00000000-0000-0000-0000-000000000000" } }],
};

export default function CampaignFolderPage({ params }: { params: Promise<{ campaignId: string }> }) {
  return (
    <Suspense fallback={<CampaignLoading />}>
      {params.then(({ campaignId }) => <CampaignFolder campaignId={campaignId} />)}
    </Suspense>
  );
}

async function CampaignFolder({ campaignId }: { campaignId: string }) {
  const workspace = await loadOutreachCampaignFolder(campaignId);
  if (workspace.status === "unavailable") return <OutreachUnavailable message={workspace.message} />;
  const campaign = workspace.campaign;
  if (!campaign) notFound();
  const drafts = workspace.drafts;
  const draftedIds = new Set(drafts.map((draft) => draft.programId));
  const availablePrograms = workspace.savedPrograms.filter((program) => !draftedIds.has(program.id));
  const programsById = new Map(workspace.programs.map((program) => [program.id, program]));
  const supportsResults = outreachStageSupportsResults(campaign.stage);
  const subjectTemplate = supportsResults ? campaign.subjectTemplate : removeOutreachResultsBlock(campaign.subjectTemplate);
  const bodyTemplate = supportsResults ? campaign.bodyTemplate : removeOutreachResultsBlock(campaign.bodyTemplate);

  return (
    <div className="space-y-4">
      <OutreachBreadcrumbs items={[{ label: campaign.name }]} />

      <section className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-3">
        <div className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-lg font-semibold">{campaign.name}</h2>
            <Badge tone="neutral">{OUTREACH_STAGE_LABELS[campaign.stage]}</Badge>
          </span>
          <p className="mt-1 text-[11px] text-ink-3">Updated {updatedFormatter.format(new Date(campaign.updatedAt))}</p>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <Link href={`/s/outreach/campaigns/${campaign.id}/template`} className="wr-btn wr-btn--neutral wr-btn--small">Edit template</Link>
          <DeleteCampaignButton campaignId={campaign.id} name={campaign.name} draftCount={drafts.length} leavePage />
        </div>
      </section>

      <section className="wr-card overflow-hidden p-0" aria-labelledby="original-template-title">
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
          <h2 id="original-template-title" className="text-sm font-semibold">Original template</h2>
          <Link href={`/s/outreach/campaigns/${campaign.id}/template`} className="text-[11px] font-semibold text-accent-2 hover:underline">Edit</Link>
        </div>
        <div className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <div>
            <p className="wr-field-label">Subject</p>
            <p className="mt-1 break-words text-xs font-semibold">{subjectTemplate}</p>
          </div>
          <div>
            <p className="wr-field-label">Message</p>
            <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap font-sans text-xs leading-5 text-ink-2">{bodyTemplate}</pre>
          </div>
        </div>
        {supportsResults && campaign.timeConfig.entries.length > 0 && (
          <div className="border-t border-line px-4 py-3">
            <p className="wr-field-label">Selected results</p>
            <pre className="mt-1 whitespace-pre-wrap font-sans text-[11px] leading-5 text-ink-2">{renderOutreachTimes(campaign.timeConfig)}</pre>
          </div>
        )}
      </section>

      <section className="wr-card overflow-hidden p-0" aria-labelledby="campaign-schools-title">
        <div className="border-b border-line px-4 py-2.5">
          <h2 id="campaign-schools-title" className="text-sm font-semibold">Schools</h2>
          <p className="mt-0.5 text-[11px] text-ink-3">Apply the template to create a filled, editable email for a school.</p>
        </div>

        <div className="border-b border-line bg-sunken/30 px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-ink-3">Applied to {drafts.length}</div>
        {drafts.length === 0 ? (
          <p className="px-4 py-4 text-xs text-ink-3">This template has not been applied to a school yet.</p>
        ) : (
          <div className="divide-y divide-line">
            {drafts.map((draft) => {
              const program = programsById.get(draft.programId);
              if (!program) return null;
              return (
                <Link key={draft.id} href={`/s/outreach/campaigns/${campaign.id}/drafts/${program.id}`} className="flex min-w-0 items-center gap-3 px-4 py-2.5 hover:bg-sunken/50">
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-xs">{program.short}</strong>
                    <span className="mt-0.5 block truncate text-[11px] text-ink-3">{draft.coachName || "Coach not added"}{draft.coachEmail ? ` | ${draft.coachEmail}` : ""}</span>
                  </span>
                  <Badge tone={draft.status === "ready" ? "good" : draft.status === "sent" ? "accent" : "neutral"}>{draft.status === "ready" ? "Ready" : draft.status === "sent" ? "Sent" : "Draft"}</Badge>
                  <span className="text-[11px] font-semibold text-accent-2">Edit</span>
                </Link>
              );
            })}
          </div>
        )}

        <div className="border-y border-line bg-sunken/30 px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-ink-3">Available saved schools {availablePrograms.length}</div>
        {workspace.savedPrograms.length === 0 ? (
          <p className="px-4 py-4 text-xs text-ink-3">No saved programs. <Link href="/s/explore" className="font-semibold text-accent-2 hover:underline">Find and save programs</Link>.</p>
        ) : availablePrograms.length === 0 ? (
          <p className="px-4 py-4 text-xs text-ink-3">This template has been applied to every saved school.</p>
        ) : (
          <div className="divide-y divide-line">
            {availablePrograms.map((program) => (
              <div key={program.id} className="flex min-w-0 items-center gap-3 px-4 py-2.5 hover:bg-sunken/50">
                <span className="min-w-0 flex-1 truncate text-xs font-medium">{program.short}</span>
                {program.division && <span className="hidden text-[11px] text-ink-3 sm:block">{program.division}</span>}
                <ApplyTemplateButton campaignId={campaign.id} programId={program.id} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
