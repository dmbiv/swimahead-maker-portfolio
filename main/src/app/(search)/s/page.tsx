import Link from "@/components/app-link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Badge, Card, Meter, SectionTitle, Stat } from "@/components/ui";
import { PerformanceScoreValue } from "@/components/performance-score";
import { getOptionalAuthContext } from "@/lib/auth";
import { timelineFor } from "@/lib/compliance";
import { canonicalEvent, EVENT_LABELS, EVENT_ORDER } from "@/lib/events";
import { fmtClock, fmtDate, todayISO } from "@/lib/time";
import { createClient } from "@/lib/supabase/server";
import { loadPublicSwimmingProgramSummaries } from "@/lib/public-program-summaries";
import { loadSwimmerProgramStatusIndex } from "@/lib/swimmer-program-statuses";
import { performanceScore } from "@/lib/performance-points";
import type { Course, EventCode, Gender } from "@/lib/types";

export const metadata: Metadata = { title: "Home" };
export const unstable_instant = { prefetch: "static" };

type DashboardTime = {
  event: string;
  course: Course;
  seconds: number;
};

type SavedProgram = {
  programId: string;
  name: string;
  location: string;
  squad: "men" | "women" | "coed" | null;
};

function squadLabel(squad: SavedProgram["squad"]): string {
  if (squad === "men") return "Men’s swimming";
  if (squad === "women") return "Women’s swimming";
  if (squad === "coed") return "Coed swimming";
  return "Swimming program";
}

function profileProgress(swimmer: Record<string, unknown> | null): {
  percent: number;
  missing: string[];
} {
  const majors = Array.isArray(swimmer?.majors) ? swimmer.majors : [];
  const checks = [
    { label: "name", done: Boolean(swimmer?.first_name && swimmer?.last_name) },
    { label: "graduation year", done: Boolean(swimmer?.grad_year) },
    { label: "team", done: Boolean(swimmer?.club) },
    { label: "location", done: Boolean(swimmer?.city && swimmer?.state) },
    { label: "email", done: Boolean(swimmer?.email) },
    { label: "phone", done: Boolean(swimmer?.phone) },
    { label: "GPA", done: Number(swimmer?.gpa) > 0 },
    { label: "academic interests", done: majors.length > 0 },
    { label: "short bio", done: Boolean(swimmer?.bio) },
    { label: "race video", done: Boolean(swimmer?.video_url) },
  ];
  return {
    percent: Math.round((checks.filter((check) => check.done).length / checks.length) * 100),
    missing: checks.filter((check) => !check.done).map((check) => check.label),
  };
}

function bestDashboardTimes(rows: DashboardTime[], gender: Gender | null) {
  const best = new Map<EventCode, DashboardTime>();
  for (const row of rows) {
    if (row.course !== "SCY") continue;
    const event = canonicalEvent(row.event, row.course);
    if (!event) continue;
    const current = best.get(event);
    if (!current || row.seconds < current.seconds) best.set(event, row);
  }
  return EVENT_ORDER.flatMap((event) => {
    const time = best.get(event);
    return time ? [{ event, time, score: performanceScore(time, gender) }] : [];
  }).sort((left, right) => (right.score?.value ?? -1) - (left.score?.value ?? -1) || EVENT_ORDER.indexOf(left.event) - EVENT_ORDER.indexOf(right.event)).slice(0, 5);
}

export default async function SwimmerOverview() {
  const directoryPromise = loadPublicSwimmingProgramSummaries();
  const auth = await getOptionalAuthContext();
  if (!auth || auth.accountType !== "swimmer" || !auth.onboardingCompleted) redirect("/");

  const supabase = await createClient();
  const [{ data: swimmer }, statusResult, directory] = await Promise.all([
    supabase
      .from("swimmers")
      .select("first_name,last_name,gender,grad_year,club,city,state,email,phone,gpa,majors,bio,video_url,swim_times(event,course,seconds)")
      .eq("owner_user_id", auth.userId)
      .maybeSingle(),
    loadSwimmerProgramStatusIndex(supabase, auth.userId),
    directoryPromise,
  ]);
  const statusRows = statusResult.error ? [] : statusResult.data;

  const times: DashboardTime[] = (swimmer?.swim_times ?? []).map((row) => ({
    event: row.event as string,
    course: row.course as Course,
    seconds: Number(row.seconds),
  }));
  const programsById = new Map(directory.status === "ready" ? directory.programs.map((program) => [program.id, program]) : []);
  const savedPrograms: SavedProgram[] = statusRows
    .filter((row) => row.status === "saved")
    .flatMap((row): SavedProgram[] => {
      const program = programsById.get(row.athletic_program_id);
      if (!program) return [];
      return [{
        programId: row.athletic_program_id,
        name: program.programName,
        location: [program.city, program.stateCode].filter(Boolean).join(", "),
        squad: program.squad,
      }];
    });
  const ruledOutCount = statusRows.filter((row) => row.status === "ruled_out" && programsById.has(row.athletic_program_id)).length;
  const progress = profileProgress(swimmer as Record<string, unknown> | null);
  const gender: Gender | null = swimmer?.gender === "M" || swimmer?.gender === "F" ? swimmer.gender : null;
  const best = bestDashboardTimes(times, gender);
  const today = todayISO();
  const gradYear = swimmer?.grad_year ?? new Date().getFullYear() + 1;
  const nextMilestone = timelineFor(gradYear).find((item) => item.date >= today);
  const firstName = swimmer?.first_name?.trim() || auth.displayName?.split(/\s+/)[0] || "there";

  const checklist = [
    { label: "Complete your recruiting profile", done: progress.percent === 100, href: "/s/profile", detail: `${progress.percent}% complete` },
    { label: "Add your best times", done: times.length > 0, href: "/s/times", detail: times.length ? `${times.length} results added` : "No times yet" },
    { label: "Build a college list", done: savedPrograms.length >= 5, href: "/s/explore", detail: savedPrograms.length ? `${savedPrograms.length} saved` : "Start exploring" },
    { label: "Prepare an intro email", done: savedPrograms.length > 0 && times.length > 0 && progress.percent >= 60, href: "/s/outreach", detail: "Use your profile and times" },
  ];
  const nextAction = checklist.find((item) => !item.done) ?? {
    label: "Review your saved programs",
    href: "/s/board",
    detail: "Keep your list current",
  };

  return (
    <div className="swimmer-home space-y-6">
      <header className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold text-accent-2">Class of {gradYear}</p>
          <h1 className="mt-1">Welcome back, {firstName}</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-2">Keep moving your recruiting work forward.</p>
        </div>
        <Link href={nextAction.href} className="wr-btn wr-btn--primary self-start sm:self-auto">
          {nextAction.label} <span aria-hidden>→</span>
        </Link>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Recruiting summary">
        <Link href="/s/profile" className="wr-card dashboard-stat-card p-4 no-underline">
          <Stat label="Profile" value={`${progress.percent}%`} hint={progress.percent === 100 ? "Ready to share" : `${progress.missing.length} items left`} tone={progress.percent === 100 ? "good" : undefined} />
        </Link>
        <Link href="/s/times" className="wr-card dashboard-stat-card p-4 no-underline">
          <Stat label="Results" value={times.length} hint={`${best.length} SCY best ${best.length === 1 ? "event" : "events"}`} />
        </Link>
        <Link href="/s/board?view=saved" className="wr-card dashboard-stat-card p-4 no-underline">
          <Stat label="Saved" value={savedPrograms.length} hint={savedPrograms.length >= 8 ? "A focused list" : "Aim for 8–12 programs to start"} />
        </Link>
        <Link href="/s/board?view=ruled-out" className="wr-card dashboard-stat-card p-4 no-underline">
          <Stat label="Ruled out" value={ruledOutCount} hint="Always reversible..." />
        </Link>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <div className="space-y-5">
          <Card>
            <SectionTitle right={<span className="font-data text-xs text-ink-3">{checklist.filter((item) => item.done).length}/{checklist.length}</span>}>
              Recruiting setup
            </SectionTitle>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex-1"><Meter label="Recruiting setup" value={(checklist.filter((item) => item.done).length / checklist.length) * 100} tone={checklist.every((item) => item.done) ? "good" : "accent"} /></div>
              <span className="shrink-0 text-xs text-ink-3">{checklist.every((item) => item.done) ? "Ready" : "In progress"}</span>
            </div>
            <ol className="divide-y divide-line">
              {checklist.map((item, index) => (
                <li key={item.href}>
                  <Link href={item.href} className="dashboard-check-row group">
                    <span className={`dashboard-check ${item.done ? "dashboard-check--done" : ""}`} aria-hidden>{item.done ? "✓" : index + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-ink group-hover:text-accent-2">{item.label}</span>
                      <span className="block text-xs text-ink-3">{item.detail}</span>
                    </span>
                    <span className="text-ink-3 group-hover:text-accent" aria-hidden>→</span>
                  </Link>
                </li>
              ))}
            </ol>
          </Card>

          <Card>
            <SectionTitle right={<Link href="/s/board" className="text-xs font-medium text-accent-2 hover:underline">View all</Link>}>
              Recently saved
            </SectionTitle>
            {savedPrograms.length ? (
              <div className="divide-y divide-line">
                {savedPrograms.slice(0, 4).map((program) => (
                  <div key={program.programId} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{program.name}</div>
                      <div className="text-xs text-ink-3">{squadLabel(program.squad)} · {program.location || "Location not reported"}</div>
                    </div>
                    <Link href={`/s/outreach/drafts/new?program=${encodeURIComponent(program.programId)}`} prefetch={false} className="wr-btn wr-btn--neutral wr-btn--small">Draft email</Link>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-4 text-center">
                <p className="text-sm font-medium">Your college list is empty</p>
                <p className="mt-1 text-xs text-ink-3">Save programs as you research so you can compare and contact them later.</p>
                <Link href="/s/explore" className="wr-btn wr-btn--primary mt-3">Find programs</Link>
              </div>
            )}
          </Card>
        </div>

        <aside className="space-y-5">
          <Card>
            <SectionTitle right={<Link href="/s/plan" className="text-xs font-medium text-accent-2 hover:underline">Full timeline</Link>}>
              Next recruiting date
            </SectionTitle>
            {nextMilestone ? (
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="accent">Upcoming</Badge>
                  <span className="font-data text-xs text-ink-3">{fmtDate(nextMilestone.date)}</span>
                </div>
                <h3 className="mt-3 text-base font-semibold">{nextMilestone.title}</h3>
                <p className="mt-1 text-xs text-ink-2">{nextMilestone.detail}</p>
              </div>
            ) : (
              <p className="text-sm text-ink-2">Your standard recruiting timeline is complete. Keep final paperwork and roster confirmation organized.</p>
            )}
          </Card>

          <Card>
            <SectionTitle right={<Link href="/s/times" className="text-xs font-medium text-accent-2 hover:underline">Manage times</Link>}>
              Strongest SCY times
            </SectionTitle>
            {best.length ? (
              <dl className="divide-y divide-line">
                {best.map(({ event, time, score }) => (
                  <div key={event} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                    <dt className="text-sm text-ink-2">{EVENT_LABELS[event]}</dt>
                    <dd className="flex flex-wrap items-baseline justify-end gap-x-3 gap-y-1">
                      <span className="font-data text-sm font-semibold">{fmtClock(time.seconds)}</span>
                      <PerformanceScoreValue score={score} />
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <div className="py-3 text-center">
                <p className="text-sm font-medium">No SCY times yet</p>
                <Link href="/s/times" className="wr-btn wr-btn--neutral mt-3">Import or add times</Link>
              </div>
            )}
          </Card>

          <Card className="bg-sunken/40">
            <SectionTitle>Quick actions</SectionTitle>
            <div className="grid grid-cols-2 gap-2">
              <Link href="/s/explore" className="wr-btn wr-btn--neutral">Find programs</Link>
              <Link href="/s/times" className="wr-btn wr-btn--neutral">Update times</Link>
              <Link href="/s/outreach/campaigns" className="wr-btn wr-btn--neutral">Draft email</Link>
              <Link href="/s/profile" className="wr-btn wr-btn--neutral">Edit profile</Link>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
