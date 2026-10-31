import { Skel, SkelCoachHeader, WorkspaceLoadingSurface } from "@/components/skeleton";

export default function Loading() {
  return (
    <WorkspaceLoadingSurface label="Loading questionnaires">
      <div className="space-y-6">
        <SkelCoachHeader />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="wr-card space-y-2.5 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Skel w="42%" h={15} />
                <Skel w={70} h={20} radius="var(--radius)" />
              </div>
              <Skel w="66%" h={12} />
              <div className="flex flex-wrap gap-2">
                {[96, 78, 110].map((w, item) => <Skel key={item} w={w} h={26} radius="var(--radius)" />)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </WorkspaceLoadingSurface>
  );
}
