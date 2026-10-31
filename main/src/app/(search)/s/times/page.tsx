import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getOptionalAuthContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SwimsImport } from "./swims-import";
import { TimesTable, type TimeRow } from "./times-table";
import { AddTimeForm } from "./add-time-form";
import { todayISO } from "@/lib/time";
import type { Gender } from "@/lib/types";

export const metadata: Metadata = { title: "My times" };
export const unstable_instant = { prefetch: "static" };

export default async function TimesPage() {
  const auth = await getOptionalAuthContext();
  if (!auth || auth.accountType !== "swimmer" || !auth.onboardingCompleted) redirect("/");

  const supabase = await createClient();
  const { data: swimmer } = await supabase
    .from("swimmers")
    .select("id,swims_member_id,gender,swim_times(id,event,course,seconds,date,meet,source)")
    .eq("owner_user_id", auth.userId)
    .maybeSingle();
  const times: TimeRow[] = (swimmer?.swim_times ?? []).map((t) => ({
    ...t,
    course: t.course as TimeRow["course"],
    seconds: Number(t.seconds),
  })).sort((left, right) => right.date.localeCompare(left.date));
  const eventCount = new Set(times.map((time) => `${time.event}:${time.course}`)).size;
  const courses = [...new Set(times.map((time) => time.course))];
  const gender: Gender | null = swimmer?.gender === "M" || swimmer?.gender === "F" ? swimmer.gender : null;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1>My times</h1>
          <p className="mt-1 text-sm text-ink-2">Keep one reliable history for program research and coach emails.</p>
        </div>
        {times.length > 0 && (
          <div className="flex gap-5 text-right">
            <div><div className="wr-stat-label">Results</div><div className="font-data text-lg font-semibold">{times.length}</div></div>
            <div><div className="wr-stat-label">Events</div><div className="font-data text-lg font-semibold">{eventCount}</div></div>
            <div className="hidden sm:block"><div className="wr-stat-label">Courses</div><div className="font-data text-lg font-semibold">{courses.length}</div></div>
          </div>
        )}
      </header>
      <SwimsImport swimsMemberId={swimmer?.swims_member_id ?? null} />
      <AddTimeForm today={todayISO()} />
      <TimesTable rows={times} gender={gender} />
    </div>
  );
}
