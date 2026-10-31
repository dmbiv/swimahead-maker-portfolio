import { Shell } from "@/components/shell";
import { requireCoachWorkspace } from "@/lib/auth";
import { getCoachContext } from "@/lib/coach-context";

export default async function CoachLayout({ children }: { children: React.ReactNode }) {
  const { context, membership } = await requireCoachWorkspace();
  const { active: college } = await getCoachContext();
  const identity = context.displayName || context.email;
  const workspaceLabel = college?.name ?? membership.workspaceName;
  return (
    <Shell persona="coach" subtitle={`${identity} · ${workspaceLabel}`}>
      {children}
    </Shell>
  );
}
