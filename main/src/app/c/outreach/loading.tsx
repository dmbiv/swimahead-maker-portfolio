import { Skel, SkelCoachHeader, WorkspaceLoadingSurface } from "@/components/skeleton";

export default function Loading() {
  return (
    <WorkspaceLoadingSurface label="Loading outreach">
      <div className="space-y-6">
        <SkelCoachHeader titleWidth="min(180px, 45%)" />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
          <div className="wr-card space-y-2.5 p-4">
            <Skel w="52%" h={14} />
            {Array.from({ length: 5 }).map((_, index) => <Skel key={index} w="100%" h={30} radius="var(--radius)" />)}
          </div>
          <div className="wr-card space-y-3 p-4">
            <Skel w="36%" h={14} />
            <Skel w="100%" h={34} radius="var(--radius)" />
            <Skel w="100%" h={220} radius="var(--radius)" />
          </div>
        </div>
      </div>
    </WorkspaceLoadingSurface>
  );
}
