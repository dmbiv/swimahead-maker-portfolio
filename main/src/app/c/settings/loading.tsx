import { Skel, WorkspaceLoadingSurface } from "@/components/skeleton";

export default function Loading() {
  return (
    <WorkspaceLoadingSurface label="Loading settings">
      <div className="max-w-xl space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <Skel w={124} h={26} />
          <Skel w={186} h={30} radius="var(--radius)" />
        </div>
        <div className="wr-card space-y-2 p-4">
          {[64, 78, 58, 52].map((w, index) => (
            <div key={index} className="flex gap-6">
              <Skel w={w} h={13} /><Skel w="46%" h={13} />
            </div>
          ))}
          <Skel w="38%" h={13} />
          <Skel w="46%" h={13} />
        </div>
        <div className="wr-card space-y-2 p-4">
          <Skel w="100%" h={13} /><Skel w="72%" h={13} />
        </div>
      </div>
    </WorkspaceLoadingSurface>
  );
}
