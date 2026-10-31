import { Skel, SkelCoachHeader, WorkspaceLoadingSurface } from "@/components/skeleton";

export default function Loading() {
  return (
    <WorkspaceLoadingSurface label="Loading coach workspace">
      <div className="space-y-6">
        <SkelCoachHeader />
        <div className="grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="wr-card space-y-2 p-4">
              <Skel w="42%" h={10} />
              <Skel w="30%" h={26} />
              <Skel w="64%" h={10} />
              <Skel w="48%" h={10} />
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Skel w={104} h={14} />
            <Skel w={94} h={11} />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="wr-card p-3"><Skel w="72%" h={13} /></div>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {[86, 100, 132, 96, 92].map((w, index) => <Skel key={index} w={w} h={32} radius="var(--radius)" />)}
        </div>
      </div>
    </WorkspaceLoadingSurface>
  );
}
