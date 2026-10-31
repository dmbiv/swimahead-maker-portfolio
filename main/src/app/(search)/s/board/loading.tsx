import { Skel, SkelList, WorkspaceLoadingSurface } from "@/components/skeleton";

export default function Loading() {
  return (
    <WorkspaceLoadingSurface label="Loading saved programs">
      <div className="space-y-5">
        <div className="space-y-2">
          <Skel w="min(200px, 48%)" h={26} />
          <Skel w="min(280px, 62%)" h={13} />
        </div>
        <div className="space-y-4">
          <div className="wr-card space-y-3 p-3 sm:p-4">
            <div className="flex flex-wrap gap-2">
              {[86, 96, 68].map((w, index) => <Skel key={index} w={w} h={30} radius="var(--radius)" />)}
            </div>
            <Skel w="100%" h={32} radius="var(--radius)" />
          </div>
          <SkelList rows={5} />
        </div>
      </div>
    </WorkspaceLoadingSurface>
  );
}
