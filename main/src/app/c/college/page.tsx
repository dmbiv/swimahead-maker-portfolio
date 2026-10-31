import Link from "@/components/app-link";
import { requireCoachWorkspace } from "@/lib/auth";
import { listCoachColleges } from "@/lib/coach-college";
import { autoMatchCollege } from "@/lib/coach-college-directory";
import { CollegePicker } from "../college-picker";
import { ProgramRemoveButton } from "./program-remove-button";

export default async function CoachCollegePage() {
  const { context, membership } = await requireCoachWorkspace();
  const colleges = await listCoachColleges(membership);
  const suggestion = colleges.length === 0 && context.displayName
    ? await autoMatchCollege(context.displayName)
    : null;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1>Programs</h1>
        <p className="mt-1 text-sm text-ink-2">
          Keep each team separate so its roster, recruiting bar, and campaigns use the right context.
        </p>
      </div>

      {colleges.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {colleges.map((college) => (
            <div key={college.id} className="wr-card p-4">
              <p className="font-medium">{college.name}</p>
              <p className="mt-1 text-xs text-ink-3">
                {[college.squad === "women" ? "Women" : college.squad === "men" ? "Men" : "Coed", college.division]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <div className="mt-3 flex flex-wrap items-start gap-2">
                <Link href={`/c/roster?college=${college.id}`} className="wr-btn wr-btn--neutral wr-btn--small">
                  Roster
                </Link>
                <Link href={`/c/campaigns?college=${college.id}`} className="wr-btn wr-btn--neutral wr-btn--small">
                  Campaigns
                </Link>
                {(membership.role === "owner" || membership.role === "admin" || membership.role === "head_coach") ? (
                  <ProgramRemoveButton collegeId={college.id} name={college.name} />
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <CollegePicker
        suggestion={suggestion}
        mode={colleges.length === 0 ? "first" : "add"}
        attachedProgramIds={colleges.map((college) => college.athleticProgramId)}
        headingLevel="h2"
      />
    </div>
  );
}
