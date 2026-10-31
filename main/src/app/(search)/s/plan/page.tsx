import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getOptionalAuthContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { contactRule, daysUntil, timelineFor } from "@/lib/compliance";
import { Badge, Card, SectionTitle } from "@/components/ui";
import { fmtDate, todayISO } from "@/lib/time";
import Link from "@/components/app-link";
import { PlanActions } from "./plan-actions";

export const metadata: Metadata = { title: "Recruiting dates" };
export const unstable_instant = { prefetch: "static" };

const MILESTONE_DETAILS: Record<string, string> = {
  "Build your list": "Add programs, current times, academic information, and required questionnaires.",
  "D1/D2 contact opens": "NCAA Division I and II recruiting communication may begin for this class. Verify the current rule before relying on this date.",
  "Official visits can begin (D1)": "Division I official visits may begin. Confirm dates and visit limits with each program.",
  "Narrow to a short list": "Compare academics, cost, roster needs, and communication with each staff.",
  "Senior-year decision check": "Compare written aid, admissions terms, total cost, and roster expectations.",
  "Late-cycle roster check": "Confirm roster availability, admissions requirements, and total cost in writing.",
  "Commit & confirm": "Complete final transcripts, eligibility steps, and roster confirmation.",
};

export default async function PlanPage() {
  const auth = await getOptionalAuthContext();
  if (!auth || auth.accountType !== "swimmer" || !auth.onboardingCompleted) redirect("/");
  const supabase = await createClient();
  const { data: s } = await supabase
    .from("swimmers").select("grad_year").eq("owner_user_id", auth.userId).maybeSingle();
  const gradYear = s?.grad_year ?? new Date().getFullYear() + 1;

  const today = todayISO();
  const items = timelineFor(gradYear);
  const rule = contactRule(gradYear, "D1");
  const upcoming = items.filter((item) => item.date >= today);
  const past = items.filter((item) => item.date < today);
  const next = upcoming[0];

  const milestoneHref = (title: string) => {
    if (title === "Build your list" || title === "Narrow to a short list") return "/s/explore";
    if (title === "D1/D2 contact opens") return "/s/outreach";
    return "/s/board";
  };

  return (
    <div className="max-w-3xl space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Recruiting dates</h1>
          <p className="mt-1 text-sm text-ink-2">Class of {gradYear} · Planning reminders, not legal advice · <Link href="/s/profile" className="text-accent-2 hover:underline">Change graduation year</Link></p>
        </div>
        <PlanActions items={items} gradYear={gradYear} />
      </header>

      {next && (
        <Card className="border-accent/40 bg-accent/5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><Badge tone="accent">Next up</Badge><span className="font-data text-xs text-ink-3">{fmtDate(next.date)}</span></div>
              <h2 className="mt-2 text-base font-semibold">{next.title}</h2>
              <p className="mt-1 text-xs text-ink-2">{MILESTONE_DETAILS[next.title] ?? next.detail}</p>
            </div>
            <Link href={milestoneHref(next.title)} className="wr-btn wr-btn--primary self-start sm:self-auto">Take the next step →</Link>
          </div>
        </Card>
      )}

      <Card>
        <SectionTitle>D1/D2 contact window</SectionTitle>
        {rule.open ? (
          <div className="space-y-2">
            <Badge tone="good">Open</Badge>
            <p className="text-sm text-ink-2">{rule.detail}</p>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-sm text-ink-2">
              <span className="mr-2 font-data text-2xl font-semibold text-ink">{daysUntil(rule.opensOn!)} days</span>
              until {fmtDate(rule.opensOn!)}
            </p>
            <p className="text-xs text-ink-3">{rule.detail}</p>
          </div>
        )}
        <p className="mt-3 border-t border-line pt-3 text-[11px] text-ink-3">Recruiting rules can change. Confirm dates with the NCAA and each program.</p>
      </Card>

      <section aria-labelledby="timeline-heading">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="timeline-heading" className="text-sm font-semibold">Upcoming timeline</h2>
          <span className="font-data text-xs text-ink-3">{upcoming.length} remaining</span>
        </div>
        <div className="space-y-2">
          {upcoming.map((item, index) => {
            return (
              <Card key={item.date} className="flex gap-4">
                <div className="w-28 shrink-0">
                  <div className="font-data text-xs text-ink-2">{fmtDate(item.date)}</div>
                  <Badge tone={index === 0 ? "accent" : "neutral"}>{index === 0 ? "Next" : "Upcoming"}</Badge>
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-medium">{item.title}</h3>
                  <p className="mt-1 text-xs text-ink-2">{MILESTONE_DETAILS[item.title] ?? item.detail}</p>
                </div>
                <Link href={milestoneHref(item.title)} className="self-center text-xs font-medium text-accent-2 hover:underline">Open →</Link>
              </Card>
            );
          })}
          {upcoming.length === 0 && <Card><p className="text-sm text-ink-2">No standard milestones remain for this graduation year. Keep final eligibility, admissions, and roster confirmations together.</p></Card>}
        </div>
      </section>

      {past.length > 0 && (
        <details className="wr-card p-4 sm:p-5">
          <summary className="cursor-pointer text-sm font-semibold">Past milestones <span className="font-data font-normal text-ink-3">({past.length})</span></summary>
          <div className="mt-3 divide-y divide-line">
            {past.slice().reverse().map((item) => (
              <div key={item.date} className="flex gap-4 py-3 first:pt-0 last:pb-0">
                <span className="w-28 shrink-0 font-data text-xs text-ink-3">{fmtDate(item.date)}</span>
                <div><h3 className="text-sm font-medium text-ink-2">{item.title}</h3><p className="mt-0.5 text-xs text-ink-3">{MILESTONE_DETAILS[item.title] ?? item.detail}</p></div>
              </div>
            ))}
          </div>
        </details>
      )}

      <Card>
        <SectionTitle>Roster and aid notes</SectionTitle>
        <ul className="list-disc space-y-2 pl-4 text-xs text-ink-2">
          <li>Division I programs subject to House settlement roster rules may use a 30-person swimming and diving roster limit. Confirm the current limit with each program.</li>
          <li>Athletic aid budgets and renewal terms vary by school. Ask for the full offer and renewal conditions in writing.</li>
          <li>Division III does not award athletic scholarships. NAIA programs may award athletic aid. Compare the complete aid package and net cost.</li>
        </ul>
      </Card>
    </div>
  );
}
