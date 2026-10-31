import { Skel, WorkspaceLoadingSurface } from "@/components/skeleton";

function ProgramCardSkel() {
  return (
    <div className="wr-card space-y-3 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <Skel w="70%" h={16} />
          <Skel w="45%" h={12} />
        </div>
        <Skel w={70} h={22} radius="var(--radius)" />
      </div>
      <div className="flex flex-wrap gap-2">
        {[80, 64, 96].map((w, i) => <Skel key={i} w={w} h={20} radius="var(--radius)" />)}
      </div>
      <Skel w="90%" h={12} />
    </div>
  );
}

export default function Loading() {
  return (
    <WorkspaceLoadingSurface label="Loading program search">
      <div className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <Skel w="min(280px, 60%)" h={24} />
          <Skel w={132} h={28} radius="var(--radius)" />
        </div>
        <div className="wr-card flex flex-wrap gap-2 p-3 sm:p-4">
          {[120, 90, 90, 110, 80].map((w, i) => <Skel key={i} w={w} h={32} radius="var(--radius)" />)}
        </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]">
          <div className="order-2 space-y-3 lg:order-1">
            {Array.from({ length: 4 }).map((_, i) => <ProgramCardSkel key={i} />)}
          </div>
          <div className="order-1 lg:order-2">
            <Skel w="100%" h={320} radius="var(--radius)" />
          </div>
        </div>
      </div>
    </WorkspaceLoadingSurface>
  );
}
