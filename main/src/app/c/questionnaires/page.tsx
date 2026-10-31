import Link from "@/components/app-link";
import { getCoachContext } from "@/lib/coach-context";
import { configuredSiteUrl } from "@/lib/env";
import { listQuestionnaires } from "@/lib/questionnaire-actions";
import { listCampaigns } from "@/lib/campaign-actions";
import { CollegeSwitcher } from "../college-switcher";
import { QuestionnaireManager } from "./questionnaire-manager";

export default async function QuestionnairesPage({ searchParams }: { searchParams: Promise<{ college?: string }> }) {
  const { college: requested } = await searchParams;
  const { active: college, choices } = await getCoachContext(requested);

  if (!college) {
    return (
      <div className="max-w-xl space-y-3">
        <h1>Questionnaires</h1>
        <p className="text-sm text-ink-2">Add your program first so questionnaires attach to the right team.</p>
        <Link href="/c/college" className="wr-btn wr-btn--neutral w-fit">Add your program</Link>
      </div>
    );
  }

  const [questionnaires, campaigns] = await Promise.all([
    listQuestionnaires(college.id),
    listCampaigns(college.id),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1>Recruiting questionnaires</h1>
          <p className="mt-1 text-sm text-ink-2">
            Build a form, share the link, and review who fills it out. Promote the ones you want into a campaign ledger.
          </p>
        </div>
        <CollegeSwitcher colleges={choices} activeId={college.id} />
      </div>

      <QuestionnaireManager
        collegeId={college.id}
        questionnaires={questionnaires}
        campaigns={campaigns.map((c) => ({ id: c.id, name: c.name, classYear: c.classYear }))}
        siteUrl={configuredSiteUrl()}
      />
    </div>
  );
}
