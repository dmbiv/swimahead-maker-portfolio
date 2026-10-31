import Link from "@/components/app-link";
import { requireCoachWorkspace } from "@/lib/auth";
import { getCoachContext } from "@/lib/coach-context";
import { CollegeSwitcher } from "../college-switcher";
import { MailboxSettingsSection } from "./mailbox-settings";

export default async function CoachSettingsPage({ searchParams }: {
  searchParams: Promise<{ college?: string; mailbox?: string }>;
}) {
  const { college: requested, mailbox } = await searchParams;
  const { context, membership } = await requireCoachWorkspace();
  const { active: college, choices } = await getCoachContext(requested);

  return (
    <div className="max-w-xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1>Settings</h1>
        {college ? <CollegeSwitcher colleges={choices} activeId={college.id} /> : null}
      </div>
      <div className="wr-card p-4 text-sm">
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1">
          <dt className="text-ink-3">Coach</dt><dd>{context.displayName || context.email}</dd>
          <dt className="text-ink-3">College</dt>
          <dd>{college?.name ?? "Not set"}</dd>
          {college?.division && (<><dt className="text-ink-3">Division</dt><dd>{college.division}</dd></>)}
          {college && (<><dt className="text-ink-3">Squad</dt><dd className="capitalize">{college.squad}</dd></>)}
        </dl>
        <p className="mt-3">
          <Link href="/c/college" className="text-[var(--accent-2)] underline underline-offset-2">
            {college ? "Manage programs" : "Set your program"}
          </Link>
        </p>
        <p className="mt-2">
          <Link href="/subscribe" className="text-[var(--accent-2)] underline underline-offset-2">
            View billing and coach access
          </Link>
        </p>
      </div>
      <MailboxSettingsSection
        workspaceId={membership.workspaceId}
        status={typeof mailbox === "string" ? mailbox.slice(0, 40) : null}
      />

      <div className="wr-card p-4 text-sm text-ink-2">
        Campaigns inherit the squad from the selected program by default. You can still choose a different squad when creating a campaign.
      </div>
    </div>
  );
}
