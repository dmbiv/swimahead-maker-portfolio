import { Skel, SkelTable, WorkspaceLoadingSurface } from "@/components/skeleton";

export default function Loading() {
  return (
    <WorkspaceLoadingSurface label="Loading swim times">
      <div className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-2">
            <Skel w="min(180px, 46%)" h={26} />
            <Skel w="min(400px, 78%)" h={13} />
          </div>
          <div className="flex gap-5">
            {[52, 46, 56].map((w, index) => (
              <div key={index} className="space-y-1.5">
                <Skel w={w} h={10} /><Skel w={w - 20} h={20} />
              </div>
            ))}
          </div>
        </div>
        <div className="wr-card space-y-3 p-3 sm:p-4">
          <Skel w="30%" h={13} />
          <Skel w="100%" h={36} radius="var(--radius)" />
        </div>
        <div className="wr-card p-3 sm:p-4">
          <Skel w="38%" h={13} />
        </div>
        <SkelTable rows={6} cols={6} />
      </div>
    </WorkspaceLoadingSurface>
  );
}
