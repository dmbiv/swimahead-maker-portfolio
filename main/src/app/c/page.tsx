import Link from "@/components/app-link";
import { requireCoachWorkspace } from "@/lib/auth";
import { getCoachContext } from "@/lib/coach-context";
import { autoMatchCollege } from "@/lib/coach-college-directory";
import { listRoster } from "@/lib/coach-roster";
import { listCampaigns } from "@/lib/campaign-actions";
import { listQuestionnaires } from "@/lib/questionnaire-actions";
import { CollegePicker } from "./college-picker";
import { CollegeSwitcher } from "./college-switcher";

export default async function CoachOverview({ searchParams }: { searchParams: Promise<{ college?: string }> }) {
  const { college: requested } = await searchParams;
  const { context } = await requireCoachWorkspace();
  const { active: college, choices } = await getCoachContext(requested);

  if (!college) {
    const suggestion = context.displayName ? await autoMatchCollege(context.displayName) : null;
    return <CollegePicker suggestion={suggestion} attachedProgramIds={[]} />;
  }

  const [roster, campaigns, questionnaires] = await Promise.all([
    listRoster(college.id),
    listCampaigns(college.id),
    listQuestionnaires(),
  ]);

  const newSubmissions = questionnaires.reduce((sum, q) => sum + q.newCount, 0);
  const totalRecruits = campaigns.reduce((sum, c) => sum + c.recruitCount, 0);
  const subtitle = [college.division, context.displayName || context.email].filter(Boolean).join(" · ");
  const q = `?college=${college.id}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1>{college.name}</h1>
          <p className="mt-1 text-sm text-ink-2">{subtitle}</p>
        </div>
        <CollegeSwitcher colleges={choices} activeId={college.id} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard href={`/c/roster${q}`} label="Roster" value={roster.length} unit={roster.length === 1 ? "swimmer" : "swimmers"} cta="Manage roster" />
        <SummaryCard href={`/c/campaigns${q}`} label="Recruits tracked" value={totalRecruits} unit={`across ${campaigns.length} ${campaigns.length === 1 ? "campaign" : "campaigns"}`} cta="Open recruiting" />
        <SummaryCard
          href={`/c/questionnaires${q}`}
          label="New submissions"
          value={newSubmissions}
          unit={newSubmissions === 1 ? "awaiting review" : "awaiting review"}
          cta="Review questionnaires"
          highlight={newSubmissions > 0}
        />
      </div>

      {campaigns.length > 0 ? (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-base font-semibold">Campaigns</h2>
            <Link href={`/c/campaigns${q}`} className="text-xs text-ink-3 underline underline-offset-2">All campaigns</Link>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {campaigns.slice(0, 4).map((c) => (
              <li key={c.id}>
                <Link href={`/c/campaigns/${c.id}`} className="wr-card block p-3 hover:border-[var(--accent)]">
                  <span className="font-medium">{c.name}</span>
                  <span className="ml-2 text-sm text-ink-2">
                    Class of {c.classYear} · {c.recruitCount} {c.recruitCount === 1 ? "recruit" : "recruits"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="wr-card p-4">
          <p className="text-sm font-medium">Start recruiting</p>
          <p className="mt-1 text-sm text-ink-2">Create a campaign for a graduating class, then search for recruits that fit your roster.</p>
          <Link href={`/c/campaigns${q}`} className="wr-btn wr-btn--primary mt-3 w-fit">Create a campaign</Link>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Link href={`/c/roster${q}`} className="wr-btn wr-btn--neutral">Roster</Link>
        <Link href={`/c/campaigns${q}`} className="wr-btn wr-btn--neutral">Recruiting</Link>
        <Link href={`/c/questionnaires${q}`} className="wr-btn wr-btn--neutral">Questionnaires</Link>
        <Link href={`/c/outreach${q}`} className="wr-btn wr-btn--neutral">Outreach</Link>
        <Link href={`/c/settings${q}`} className="wr-btn wr-btn--neutral">Settings</Link>
      </div>
    </div>
  );
}

function SummaryCard({
  href,
  label,
  value,
  unit,
  cta,
  highlight,
}: {
  href: string;
  label: string;
  value: number;
  unit: string;
  cta: string;
  highlight?: boolean;
}) {
  return (
    <Link href={href} className={`wr-card block p-4 hover:border-[var(--accent)] ${highlight ? "border-[var(--accent)]" : ""}`}>
      <p className="text-xs uppercase tracking-wide text-ink-3">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-ink-3">{unit}</p>
      <p className="mt-2 text-xs text-[var(--accent-2)]">{cta}</p>
    </Link>
  );
}
