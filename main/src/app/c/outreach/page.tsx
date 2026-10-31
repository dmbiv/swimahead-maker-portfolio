import Link from "@/components/app-link";
import { getCoachContext } from "@/lib/coach-context";
import { listTemplates, listConnectedSenders } from "@/lib/coach-outreach";
import { OUTREACH_PLACEHOLDERS } from "@/lib/coach-outreach-defs";
import { getEmailOAuthConfig } from "@/lib/email/oauth";
import { listCampaigns } from "@/lib/campaign-actions";
import { CollegeSwitcher } from "../college-switcher";
import { OutreachWorkbench } from "./outreach-workbench";

export default async function OutreachPage({ searchParams }: { searchParams: Promise<{ college?: string }> }) {
  const { college: requested } = await searchParams;
  const { active: college, choices } = await getCoachContext(requested);

  if (!college) {
    return (
      <div className="max-w-xl space-y-3">
        <h1>Outreach</h1>
        <p className="text-sm text-ink-2">Add your program first.</p>
        <Link href="/c/college" className="wr-btn wr-btn--neutral w-fit">Add your program</Link>
      </div>
    );
  }

  const [templates, campaigns, connectedSenders] = await Promise.all([
    listTemplates(),
    listCampaigns(college.id),
    listConnectedSenders(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1>Outreach</h1>
          <p className="mt-1 text-sm text-ink-2">
            Write templates with placeholders, then send autofilled emails to a whole campaign at once.
          </p>
        </div>
        <CollegeSwitcher colleges={choices} activeId={college.id} />
      </div>

      <OutreachWorkbench
        templates={templates}
        campaigns={campaigns.map((c) => ({ id: c.id, name: c.name, classYear: c.classYear }))}
        placeholders={OUTREACH_PLACEHOLDERS.map((p) => ({ key: p.key, label: p.label }))}
        connectedSenders={connectedSenders}
        mailboxProviderConfigured={getEmailOAuthConfig("google") !== null || getEmailOAuthConfig("microsoft") !== null}
      />
    </div>
  );
}
