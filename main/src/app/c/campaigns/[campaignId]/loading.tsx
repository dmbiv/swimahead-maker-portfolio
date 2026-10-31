import { Skel, SkelTable, WorkspaceLoadingSurface } from "@/components/skeleton";

export default function Loading() {
  return (
    <WorkspaceLoadingSurface label="Loading campaign">
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <Skel w={104} h={11} />
            <Skel w="min(280px, 60%)" h={26} />
            <Skel w="min(360px, 74%)" h={13} />
          </div>
          <div className="flex shrink-0 gap-2">
            <Skel w={118} h={28} radius="var(--radius)" />
            <Skel w={110} h={28} radius="var(--radius)" />
          </div>
        </div>
        <div className="wr-card space-y-3 p-4">
          <Skel w="30%" h={14} />
          <div className="grid gap-2 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => <Skel key={index} w="100%" h={34} radius="var(--radius)" />)}
          </div>
        </div>
        <SkelTable rows={8} cols={6} />
      </div>
    </WorkspaceLoadingSurface>
  );
}
