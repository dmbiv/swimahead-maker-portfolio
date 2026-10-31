import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "@/components/app-link";
import { Skel } from "@/components/skeleton";
import { getOptionalAuthContext } from "@/lib/auth";
import { loadExploreSwimmingPrograms } from "@/lib/explore-programs";
import { parsePublicProgramFilters } from "@/lib/public-programs";
import { conferenceProgramsHref, safeExploreReturnHref } from "@/lib/explore-navigation";
import { createClient } from "@/lib/supabase/server";
import { loadSwimmerProgramStatusIndex } from "@/lib/swimmer-program-statuses";
import { ProgramCard } from "../../explorer";
import { ProgramVisibilityProvider } from "../../program-visibility";
import { ProgramControls } from "../../swimmer-controls";
import { ConferenceSquadSelector, type ConferenceSquad } from "./conference-squad-selector";

export const metadata: Metadata = { title: "Conference programs" };
export const unstable_instant = {
  prefetch: "static",
  samples: [{
    params: { conferenceId: "00000000-0000-0000-0000-000000000000" },
    searchParams: { from: null, squad: null },
  }],
};

type ConferencePageSearchParams = {
  from?: string | string[];
  squad?: string | string[];
};

function requestedSquad(value: string | string[] | undefined): ConferenceSquad {
  const selected = Array.isArray(value) ? value[0] : value;
  return selected === "men" || selected === "women" || selected === "coed" ? selected : "all";
}

function ConferenceProgramsLoading() {
  return (
    <div className="space-y-4" aria-label="Loading conference programs">
      <Skel w={150} h={32} radius="var(--radius)" />
      <div className="space-y-2">
        <Skel w="min(420px, 75%)" h={25} />
        <Skel w={180} h={14} />
      </div>
      {[0, 1, 2].map((item) => (
        <div key={item} className="wr-card space-y-3 p-4 sm:p-5">
          <Skel w="min(480px, 70%)" h={18} />
          <Skel w="min(360px, 55%)" h={13} />
          <Skel w="100%" h={72} radius="var(--radius)" />
        </div>
      ))}
    </div>
  );
}

export default function ConferenceProgramsPage({
  params,
  searchParams,
}: {
  params: Promise<{ conferenceId: string }>;
  searchParams: Promise<ConferencePageSearchParams>;
}) {
  return (
    <Suspense fallback={<ConferenceProgramsLoading />}>
      {Promise.all([params, searchParams]).then(([{ conferenceId }, query]) => (
        <ConferencePrograms
          conferenceId={conferenceId}
          backHref={safeExploreReturnHref(query.from)}
          squad={requestedSquad(query.squad)}
        />
      ))}
    </Suspense>
  );
}

async function ConferencePrograms({
  conferenceId,
  backHref,
  squad,
}: {
  conferenceId: string;
  backHref: string;
  squad: ConferenceSquad;
}) {
  const [directory, auth] = await Promise.all([
    loadExploreSwimmingPrograms(),
    getOptionalAuthContext(),
  ]);

  if (directory.status !== "ready") {
    return (
      <div className="space-y-4">
        <Link href={backHref} className="wr-btn wr-btn--neutral wr-btn--small">
          <span aria-hidden>←</span> Back to program search
        </Link>
        <section className="wr-card p-8 text-center" role="alert">
          <h1 className="text-base font-semibold">Conference programs couldn’t load</h1>
          <p className="mt-2 text-sm text-ink-3">The program directory is not available right now.</p>
        </section>
      </div>
    );
  }

  const conferencePrograms = directory.programs.filter((program) => program.conference?.id === conferenceId);
  if (conferencePrograms.length === 0) notFound();

  const conference = conferencePrograms[0].conference;
  if (!conference) notFound();
  const programs = squad === "all"
    ? conferencePrograms
    : conferencePrograms.filter((program) => program.squad === squad);

  const isSwimmer = auth?.accountType === "swimmer" && auth.onboardingCompleted;
  let statuses: Record<string, "saved" | "ruled_out"> = {};
  if (isSwimmer && auth) {
    const supabase = await createClient();
    const result = await loadSwimmerProgramStatusIndex(supabase, auth.userId);
    if (!result.error) {
      statuses = Object.fromEntries(result.data.map((row) => [row.athletic_program_id, row.status]));
    }
  }

  const controls = isSwimmer
    ? (programId: string) => (
        <ProgramControls
          key={`${programId}:${statuses[programId] ?? "none"}`}
          programId={programId}
          initial={statuses[programId]}
        />
      )
    : undefined;
  const filters = parsePublicProgramFilters({ squad });
  const swimmerAdmissionScores = { sat: null, act: null };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Link href={backHref} className="wr-btn wr-btn--neutral wr-btn--small">
          <span aria-hidden>←</span> Back to program search
        </Link>
        <ConferenceSquadSelector conferenceId={conferenceId} returnHref={backHref} squad={squad} />
      </div>

      <header>
        <h1>{conference.name}</h1>
        <p className="mt-1 text-sm text-ink-2">
          {programs.length} {programs.length === 1 ? "college swimming program" : "college swimming programs"}
        </p>
      </header>

      {programs.length > 0 ? (
        <ProgramVisibilityProvider
          showRuledOut
          programIds={programs.map((program) => program.id)}
          initialStatuses={statuses}
        >
          <div className="space-y-3">
            {programs.map((program) => (
              <ProgramCard
                key={program.id}
                program={program}
                cips={[]}
                controls={controls}
                status={statuses[program.id]}
                filters={filters}
                swimmerAdmissionScores={swimmerAdmissionScores}
              />
            ))}
          </div>
        </ProgramVisibilityProvider>
      ) : (
        <section className="wr-card p-8 text-center">
          <h2 className="text-base font-semibold">No programs in this squad</h2>
          <p className="mt-2 text-sm text-ink-3">This conference has no currently listed {squad} swimming programs.</p>
          <Link href={conferenceProgramsHref(conferenceId, backHref)} className="wr-btn wr-btn--neutral mt-4">Show all squads</Link>
        </section>
      )}
    </div>
  );
}
