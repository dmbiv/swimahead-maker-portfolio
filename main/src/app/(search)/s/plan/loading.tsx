import { Skel, SkelCard, WorkspaceLoadingSurface } from "@/components/skeleton";

export default function Loading() {
  return (
    <WorkspaceLoadingSurface label="Loading recruiting dates">
      <div className="max-w-3xl space-y-5">
        <header className="space-y-2">
          <Skel w="min(220px, 55%)" h={26} />
          <Skel w={120} h={13} />
        </header>
        <SkelCard lines={2} />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="wr-card flex items-start gap-3 p-4 sm:p-5">
              <Skel w={10} h={10} radius={999} className="mt-1" />
              <div className="flex-1 space-y-2">
                <Skel w="55%" h={14} />
                <Skel w="85%" h={12} />
              </div>
              <Skel w={70} h={12} />
            </div>
          ))}
        </div>
      </div>
    </WorkspaceLoadingSurface>
  );
}
