import Link from "@/components/app-link";
import { getCoachContext } from "@/lib/coach-context";
import { getCollegeSwimCloudRosterUrl } from "@/lib/coach-college";
import { listRoster } from "@/lib/coach-roster";
import { analyzeRoster } from "@/lib/coach-roster-analysis";
import { CollegeSwitcher } from "../college-switcher";
import { RosterImport } from "./roster-import";
import { RosterTable } from "./roster-table";
import { StrengthsPanel } from "./strengths-panel";

export default async function RosterPage({ searchParams }: { searchParams: Promise<{ college?: string }> }) {
  const { college: requested } = await searchParams;
  const { active, choices } = await getCoachContext(requested);

  if (!active) {
    return (
      <div className="max-w-xl space-y-3">
        <h1>Roster</h1>
        <p className="text-sm text-ink-2">Add your program first so your roster has context.</p>
        <Link href="/c/college" className="wr-btn wr-btn--neutral w-fit">Add your program</Link>
      </div>
    );
  }

  const [roster, swimcloudUrl] = await Promise.all([
    listRoster(active.id),
    getCollegeSwimCloudRosterUrl(active),
  ]);
  const analysis = analyzeRoster(roster);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1>{active.name} roster</h1>
          <p className="mt-1 text-sm text-ink-2">
            {roster.length} {roster.length === 1 ? "swimmer" : "swimmers"}, scored on the SwimAhead College Index (SCY)
          </p>
        </div>
        <CollegeSwitcher colleges={choices} activeId={active.id} />
      </div>

      {roster.length > 0 ? <StrengthsPanel analysis={analysis} /> : null}

      <RosterImport collegeId={active.id} swimcloudRosterUrl={swimcloudUrl} rosterCount={roster.length} />

      {roster.length > 0 ? (
        <RosterTable roster={roster} />
      ) : (
        <p className="text-sm text-ink-3">No swimmers yet. Add your roster above to see strengths and gaps.</p>
      )}
    </div>
  );
}
