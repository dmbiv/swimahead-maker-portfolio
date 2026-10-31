import { Suspense } from "react";
import { notFound } from "next/navigation";
import { DraftEditor } from "../../../../draft-editor";
import { loadOutreachDraftEditor } from "../../../../data";
import { OutreachBreadcrumbs } from "../../../../outreach-ui";
import { OutreachUnavailable } from "../../../../unavailable";
import CampaignLoading from "../../loading";

export const unstable_instant = {
  prefetch: "static",
  samples: [{
    params: {
      campaignId: "00000000-0000-0000-0000-000000000000",
      programId: "00000000-0000-0000-0000-000000000000",
    },
  }],
};

export default function SchoolDraftPage({ params }: {
  params: Promise<{ campaignId: string; programId: string }>;
}) {
  return (
    <Suspense fallback={<CampaignLoading />}>
      {params.then(({ campaignId, programId }) => (
        <SchoolDraft campaignId={campaignId} programId={programId} />
      ))}
    </Suspense>
  );
}

async function SchoolDraft({ campaignId, programId }: { campaignId: string; programId: string }) {
  const workspace = await loadOutreachDraftEditor(campaignId, programId);
  if (workspace.status === "unavailable") return <OutreachUnavailable message={workspace.message} />;
  const campaign = workspace.campaign;
  const program = workspace.program;
  if (!campaign || !program) notFound();
  const existingDraft = workspace.existingDraft;
  const programSaved = workspace.programSaved;
  if (!existingDraft) notFound();

  return (
    <div className="space-y-4">
      <OutreachBreadcrumbs items={[
        { label: "Campaign folders", href: "/s/outreach/campaigns" },
        { label: campaign.name, href: `/s/outreach/campaigns/${campaign.id}` },
        { label: program.short },
      ]} />
      <DraftEditor
        campaign={campaign}
        program={program}
        swimmer={workspace.swimmer}
        existingDraft={existingDraft}
        programSaved={programSaved}
        storageReady={workspace.storageReady}
      />
    </div>
  );
}
