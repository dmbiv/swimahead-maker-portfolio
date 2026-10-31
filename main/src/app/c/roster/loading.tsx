import { Skel, SkelCoachHeader, SkelTable, WorkspaceLoadingSurface } from "@/components/skeleton";

export default function Loading() {
  return (
    <WorkspaceLoadingSurface label="Loading roster">
      <div className="space-y-6">
        <SkelCoachHeader />
        <div className="space-y-4">
          <div className="wr-card space-y-3 p-4">
            <Skel w="30%" h={15} />
            <div className="grid gap-2 sm:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => <Skel key={index} w="100%" h={40} radius="var(--radius)" />)}
            </div>
          </div>
        </div>
        <div className="wr-card space-y-3 p-4">
          <Skel w="38%" h={14} />
          <Skel w="100%" h={34} radius="var(--radius)" />
        </div>
        <SkelTable rows={8} cols={6} />
      </div>
    </WorkspaceLoadingSurface>
  );
}
