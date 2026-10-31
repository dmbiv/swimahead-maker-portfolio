import Link from "@/components/app-link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getOptionalAuthContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadPublicSwimmingProgramSummaries } from "@/lib/public-program-summaries";
import { loadSwimmerProgramStatuses } from "@/lib/swimmer-program-statuses";
import { ProgramsBoard, type BoardRow } from "./board-list";

export const metadata: Metadata = { title: "My programs" };
export const unstable_instant = { prefetch: "static" };

export default async function BoardPage({ searchParams }: {
  searchParams: Promise<{ view?: string | string[] }>;
}) {
  const [auth, params, directory] = await Promise.all([
    getOptionalAuthContext(),
    searchParams,
    loadPublicSwimmingProgramSummaries(),
  ]);
  if (!auth || auth.accountType !== "swimmer" || !auth.onboardingCompleted) redirect("/");

  const supabase = await createClient();
  const { data, error } = await loadSwimmerProgramStatuses(supabase, auth.userId);

  const programs = new Map(directory.status === "ready" ? directory.programs.map((program) => [program.id, program]) : []);
  const rows: BoardRow[] = data.flatMap((r): BoardRow[] => {
    const program = programs.get(r.athletic_program_id);
    if (!program) return [];
    return [{
      programId: r.athletic_program_id,
      status: r.status,
      reason: r.reason,
      name: program.programName,
      location: [program.city, program.stateCode].filter(Boolean).join(", "),
      squad: program.squad,
      division: program.division,
      conference: program.conference?.shortName ?? program.conference?.name ?? null,
      createdAt: r.created_at,
    }];
  });
  const requestedView = params.view;
  const initialView = requestedView === "ruled-out" || requestedView === "all" ? requestedView : "saved";

  return (
    <div className="space-y-5">
      <header>
        <h1>My programs</h1>
        <p className="mt-1 text-sm text-ink-2">Keep a focused working list.</p>
      </header>
      {error || directory.status !== "ready" ? (
        <section className="wr-card p-8 text-center" role="alert">
          <h2 className="text-base font-semibold">Your programs couldn’t load</h2>
          <p className="mt-2 text-sm text-ink-3">Your saved choices are still intact. The list and current program directory must both finish loading before counts are shown.</p>
          <Link href="/s/board" className="wr-btn wr-btn--neutral mt-4">Reload</Link>
        </section>
      ) : (
        <ProgramsBoard rows={rows} initialView={initialView} />
      )}
    </div>
  );
}
