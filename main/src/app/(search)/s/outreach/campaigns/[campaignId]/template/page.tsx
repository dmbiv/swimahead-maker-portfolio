import { Suspense } from "react";
import { notFound } from "next/navigation";
import { CampaignEditor } from "../../../campaign-editor";
import { loadOutreachCampaignEditor, loadOutreachResults } from "../../../data";
import { OutreachBreadcrumbs } from "../../../outreach-ui";
import { OutreachUnavailable } from "../../../unavailable";
import CampaignLoading from "../loading";

export const unstable_instant = {
  prefetch: "static",
  samples: [{ params: { campaignId: "00000000-0000-0000-0000-000000000000" } }],
};

export default function EditCampaignTemplatePage({ params }: { params: Promise<{ campaignId: string }> }) {
  return (
    <Suspense fallback={<CampaignLoading />}>
      {params.then(({ campaignId }) => <EditCampaignTemplate campaignId={campaignId} />)}
    </Suspense>
  );
}

async function EditCampaignTemplate({ campaignId }: { campaignId: string }) {
  const results = loadOutreachResults();
  const workspace = await loadOutreachCampaignEditor(campaignId);
  if (workspace.status === "unavailable") return <OutreachUnavailable message={workspace.message} />;
  const campaign = workspace.campaign;
  if (!campaign) notFound();
  return (
    <div className="space-y-4">
      <OutreachBreadcrumbs items={[
        { label: "Campaign folders", href: "/s/outreach/campaigns" },
        { label: campaign.name, href: `/s/outreach/campaigns/${campaign.id}` },
        { label: "Master template" },
      ]} />
      <CampaignEditor campaign={campaign} programs={workspace.programs} swimmer={workspace.swimmer} results={results} storageReady={workspace.storageReady} />
    </div>
  );
}
