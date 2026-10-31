import { Skel, WorkspaceLoadingSurface } from "@/components/skeleton";

export default function Loading() {
  return (
    <WorkspaceLoadingSurface label="Loading outreach campaigns">
      <div className="max-w-5xl space-y-4">
        <div className="space-y-1.5 border-b border-line pb-3">
          <Skel w={112} h={11} />
          <Skel w={104} h={22} />
        </div>
        <div className="space-y-3">
          <Skel w="min(150px, 38%)" h={12} />
          <div className="wr-card overflow-hidden p-0">
            <div className="border-b border-line px-4 py-3"><Skel w="28%" h={15} /><Skel className="mt-2" w="46%" h={10} /></div>
            {Array.from({ length: 5 }).map((_, item) => (
              <div key={item} className="flex items-center gap-3 border-b border-line/60 px-4 py-3 last:border-b-0">
                <div className="min-w-0 flex-1 space-y-2"><Skel w={`${52 + (item % 3) * 9}%`} h={13} /><Skel w="42%" h={10} /></div>
                <Skel w={42} h={24} /><Skel w={48} h={24} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </WorkspaceLoadingSurface>
  );
}
