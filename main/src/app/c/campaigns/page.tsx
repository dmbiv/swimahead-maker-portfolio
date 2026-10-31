import Link from "@/components/app-link";
import { getCoachContext } from "@/lib/coach-context";
import { listCampaigns } from "@/lib/campaign-actions";
import { CollegeSwitcher } from "../college-switcher";
import { CampaignCreateForm } from "./campaign-create-form";
import { CampaignDeleteButton } from "./campaign-delete-button";

export default async function CampaignsPage({ searchParams }: { searchParams: Promise<{ college?: string }> }) {
  const { college: requested } = await searchParams;
  const { active: college, choices } = await getCoachContext(requested);

  if (!college) {
    return (
      <div className="max-w-xl space-y-3">
        <h1>Recruiting</h1>
        <p className="text-sm text-ink-2">Set your college first so recruit search has roster context.</p>
        <Link href="/c/college" className="wr-btn wr-btn--neutral w-fit">Set your college</Link>
      </div>
    );
  }

  const campaigns = await listCampaigns(college.id);
  const defaultGender = college.squad === "women" ? "F" : "M";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1>Recruiting campaigns</h1>
          <p className="mt-1 text-sm text-ink-2">
            {college.name}, {college.squad === "women" ? "women" : college.squad === "men" ? "men" : "coed"}
          </p>
        </div>
        <CollegeSwitcher colleges={choices} activeId={college.id} />
      </div>

      {campaigns.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {campaigns.map((c) => (
            <li key={c.id} className="wr-card flex items-start gap-3 p-4">
              <Link href={`/c/campaigns/${c.id}`} className="min-w-0 flex-1 hover:text-[var(--accent)]">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{c.name}</span>
                  <span className="text-xs text-ink-3">{c.status === "archived" ? "Archived" : "Active"}</span>
                </div>
                <p className="mt-1 text-sm text-ink-2">
                  Class of {c.classYear} · {c.gender === "F" ? "Women" : "Men"} · {c.recruitCount} recruit{c.recruitCount === 1 ? "" : "s"}
                </p>
              </Link>
              <CampaignDeleteButton campaignId={c.id} name={c.name} recruitCount={c.recruitCount} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-3">No campaigns yet. Create one for the class you&apos;re recruiting.</p>
      )}

      <CampaignCreateForm
        collegeId={college.id}
        defaultGender={defaultGender}
        currentYear={new Date().getUTCFullYear()}
      />
    </div>
  );
}
