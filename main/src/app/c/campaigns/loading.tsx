import { Skel, SkelCoachHeader, WorkspaceLoadingSurface } from "@/components/skeleton";

export default function Loading() {
  return (
    <WorkspaceLoadingSurface label="Loading recruiting campaigns">
      <div className="space-y-6">
        <SkelCoachHeader />
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="wr-card space-y-2 p-4">
              <div className="flex items-center justify-between gap-2">
                <Skel w="48%" h={14} />
                <Skel w={52} h={11} />
              </div>
              <Skel w="76%" h={13} />
            </div>
          ))}
        </div>
        <div className="wr-card space-y-3 p-4">
          <Skel w="34%" h={14} />
          <div className="grid gap-2 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => <Skel key={index} w="100%" h={34} radius="var(--radius)" />)}
          </div>
        </div>
      </div>
    </WorkspaceLoadingSurface>
  );
}
