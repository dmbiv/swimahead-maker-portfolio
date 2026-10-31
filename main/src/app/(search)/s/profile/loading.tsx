import { Skel, WorkspaceLoadingSurface } from "@/components/skeleton";

function Field() {
  return (
    <div className="space-y-1.5">
      <Skel w={90} h={11} />
      <Skel w="100%" h={34} radius="var(--radius)" />
    </div>
  );
}

function FieldCard({ fields }: { fields: number }) {
  return (
    <div className="wr-card space-y-3 p-4 sm:p-5">
      <div className="border-b border-line pb-2"><Skel w="42%" h={14} /></div>
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: fields }).map((_, index) => <Field key={index} />)}
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <WorkspaceLoadingSurface label="Loading profile">
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="space-y-2">
          <Skel w="min(180px, 50%)" h={26} />
          <Skel w="min(420px, 80%)" h={13} />
        </div>
        <div className="wr-card p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Skel w={128} h={13} />
                <Skel w={38} h={13} />
              </div>
              <Skel w="100%" h={8} radius={999} />
              <Skel w="72%" h={11} />
            </div>
            <div className="flex flex-wrap gap-1.5 sm:max-w-md">
              {[92, 74, 108, 66].map((w, index) => <Skel key={index} w={w} h={22} radius="var(--radius)" />)}
            </div>
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <FieldCard fields={6} />
          <FieldCard fields={4} />
          <FieldCard fields={4} />
          <FieldCard fields={2} />
        </div>
      </div>
    </WorkspaceLoadingSurface>
  );
}
