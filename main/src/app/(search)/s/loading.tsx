import { Skel, WorkspaceLoadingSurface } from "@/components/skeleton";

export default function Loading() {
  return (
    <WorkspaceLoadingSurface label="Loading swimmer home">
      <div className="swimmer-home space-y-6">
      <div className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2"><Skel w={90} h={12} /><Skel w="min(340px, 72vw)" h={29} /><Skel w="min(440px, 80vw)" h={13} /></div>
        <Skel w={150} h={38} radius="var(--radius)" className="self-start sm:self-auto" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => <div key={index} className="wr-card dashboard-stat-card space-y-2 p-4"><Skel w="45%" h={10} /><Skel w="35%" h={27} /><Skel w="68%" h={10} /></div>)}
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <div className="wr-card space-y-3 p-4 sm:p-5"><Skel w="35%" h={14} />{Array.from({ length: 4 }).map((_, index) => <Skel key={index} w="100%" h={48} radius="var(--radius)" />)}</div>
        <div className="space-y-5"><div className="wr-card space-y-3 p-4 sm:p-5"><Skel w="48%" h={14} /><Skel w="30%" h={20} /><Skel w="90%" h={13} /></div><div className="wr-card space-y-3 p-4 sm:p-5"><Skel w="45%" h={14} />{Array.from({ length: 4 }).map((_, index) => <Skel key={index} w="100%" h={27} />)}</div></div>
      </div>
      </div>
    </WorkspaceLoadingSurface>
  );
}
