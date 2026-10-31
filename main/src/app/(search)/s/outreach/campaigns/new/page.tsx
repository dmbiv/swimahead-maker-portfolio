import { Suspense } from "react";
import type { Metadata } from "next";
import { CampaignEditor } from "../../campaign-editor";
import { loadOutreachCampaignEditor, loadOutreachResults } from "../../data";
import { OutreachBreadcrumbs } from "../../outreach-ui";
import { OutreachUnavailable } from "../../unavailable";
import Loading from "../../loading";

export const metadata: Metadata = { title: "New outreach campaign" };
export const unstable_instant = { prefetch: "static" };

export default function NewCampaignPage() {
  return <Suspense fallback={<Loading />}><NewCampaign /></Suspense>;
}

async function NewCampaign() {
  const results = loadOutreachResults();
  const workspace = await loadOutreachCampaignEditor();
  if (workspace.status === "unavailable") return <OutreachUnavailable message={workspace.message} />;
  return (
    <div className="space-y-4">
      <OutreachBreadcrumbs items={[{ label: "Campaign folders", href: "/s/outreach/campaigns" }, { label: "New campaign" }]} />
      <CampaignEditor programs={workspace.programs} swimmer={workspace.swimmer} results={results} storageReady={workspace.storageReady} />
    </div>
  );
}
