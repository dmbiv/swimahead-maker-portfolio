import { Skel, WorkspaceLoadingSurface } from "@/components/skeleton";

export default function CampaignLoading() {
  return (
    <WorkspaceLoadingSurface label="Loading campaign">
      <div className="max-w-5xl space-y-4">
        <div className="space-y-1.5 border-b border-line pb-3">
          <Skel w={112} h={11} />
          <Skel w={104} h={22} />
        </div>
        <Skel w="35%" h={12} />
        <div className="wr-card flex gap-4 p-4 sm:p-5"><Skel w={44} h={38} /><div className="flex-1 space-y-2"><Skel w="45%" h={18} /><Skel w="65%" h={11} /></div></div>
        <div className="grid gap-4 lg:grid-cols-2"><div className="wr-card p-4 sm:p-5"><Skel w="40%" h={15} /><div className="mt-4 space-y-3"><Skel w="100%" h={46} /><Skel w="100%" h={46} /></div></div><div className="wr-card p-4 sm:p-5"><Skel w="45%" h={15} /><Skel className="mt-4" w="100%" h={120} /></div></div>
      </div>
    </WorkspaceLoadingSurface>
  );
}
