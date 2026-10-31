import Link from "@/components/app-link";
import type { Metadata } from "next";
import { Explorer } from "./explorer";
import { ProgramControls } from "./swimmer-controls";
import {
  filterPublicPrograms,
  parsePublicProgramFilters,
  type PublicProgramSearchParams,
  type SwimmerAdmissionScores,
} from "@/lib/public-programs";
import {
  loadExploreDirectory,
  loadPublicFitSummary,
  loadPublicProgramFit,
  loadPublicSwimmingStrength,
} from "@/lib/explore-programs";
import { getOptionalAuthContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadSwimmerProgramStatusIndex } from "@/lib/swimmer-program-statuses";
import { canonicalEvent, EVENT_ORDER } from "@/lib/events";
import { evaluateProgramFit, type ProgramFitEvaluation, type ProgramFitInputTime } from "@/lib/program-fit";
import type { Course, EventCode, Gender } from "@/lib/types";

export const metadata: Metadata = {
  title: "Find College Swimming Programs",
  description: "Search college swimming programs with SwimAhead and compare division, location, academics, cost, and swimming fit.",
  alternates: { canonical: "/" },
};
export const unstable_instant = {
  prefetch: "runtime",
  samples: [{
    searchParams: {
      q: null,
      squad: null,
      division: null,
      conference: null,
      state: null,
      control: null,
      enrollmentMin: null,
      enrollmentMax: null,
      netPriceMax: null,
      admissionMax: null,
      academicTest: null,
      academicMode: null,
      academicValue: null,
      cip: null,
      sort: null,
      fitMode: null,
      fitRank: null,
      fitEvent: null,
      fitMatch: null,
      showRuledOut: null,
      page: null,
    },
  }],
};

function requestedPage(params: PublicProgramSearchParams): number {
  const raw = params.page;
  const value = Array.isArray(raw) ? raw[0] : raw;
  const page = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

function DirectoryState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="space-y-4">
      <h1>College swimming programs</h1>
      <section className="wr-card p-8 text-center">
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="mx-auto mt-2 max-w-lg text-sm text-ink-3">{detail}</p>
        <Link href="/s/explore" className="wr-btn wr-btn--neutral mt-4">Reload</Link>
      </section>
    </div>
  );
}

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<PublicProgramSearchParams>;
}) {
  const params = await searchParams;
  let filters = parsePublicProgramFilters(params);
  const [{ result, facets }, auth, fitSummary, swimmingStrength] = await Promise.all([
    loadExploreDirectory(),
    getOptionalAuthContext(),
    loadPublicFitSummary(),
    filters.sort === "swimming-strength"
      ? loadPublicSwimmingStrength()
      : Promise.resolve({ scores: {}, coveredProgramCount: 0 }),
  ]);

  if (result.status === "unconfigured") {
    return <DirectoryState title="College data isn’t connected" detail="Add a Supabase connection to load the directory." />;
  }
  if (result.status === "error") {
    return <DirectoryState title="Programs couldn’t load" detail={result.message} />;
  }
  if (result.status === "empty") {
    return <DirectoryState title="No programs published" detail="Load the program dataset to populate search." />;
  }

  const fitDatasetReady = fitSummary.datasetReady;

  const isSwimmer = auth?.accountType === "swimmer" && auth.onboardingCompleted;
  let statuses: Record<string, "saved" | "ruled_out"> | undefined;
  let swimmerGender: Gender | null = null;
  let swimmerTimes: ProgramFitInputTime[] = [];
  const swimmerAdmissionScores: SwimmerAdmissionScores = { sat: null, act: null };
  if (isSwimmer && auth) {
    const supabase = await createClient();
    const [statusResult, { data: swimmer }] = await Promise.all([
      loadSwimmerProgramStatusIndex(supabase, auth.userId),
      supabase
        .from("swimmers")
        .select("gender,sat,act,swim_times(event,course,seconds)")
        .eq("owner_user_id", auth.userId)
        .maybeSingle(),
    ]);
    statuses = Object.fromEntries((statusResult.error ? [] : statusResult.data).map((row) => [row.athletic_program_id, row.status]));
    swimmerGender = swimmer?.gender === "M" || swimmer?.gender === "F" ? swimmer.gender : null;
    const sat = Number(swimmer?.sat);
    const act = Number(swimmer?.act);
    swimmerAdmissionScores.sat = Number.isInteger(sat) && sat >= 400 && sat <= 1600 ? sat : null;
    swimmerAdmissionScores.act = Number.isInteger(act) && act >= 1 && act <= 36 ? act : null;
    swimmerTimes = (swimmer?.swim_times ?? []).flatMap((row): ProgramFitInputTime[] => {
      if (!(row.course === "SCY" || row.course === "SCM" || row.course === "LCM")) return [];
      const seconds = Number(row.seconds);
      return Number.isFinite(seconds) && seconds > 0
        ? [{ event: row.event, course: row.course as Course, seconds }]
        : [];
    });
  }

  if (params.academicTest == null && swimmerAdmissionScores.sat === null && swimmerAdmissionScores.act !== null) {
    filters = { ...filters, academicTest: "act" };
  }

  let matchingPrograms = filterPublicPrograms(
    result.programs,
    filters,
    swimmingStrength.scores,
    swimmerAdmissionScores,
  );

  const fitEventOptions = [...new Set(swimmerTimes.flatMap((time): EventCode[] => {
    const event = canonicalEvent(time.event, time.course);
    return event ? [event] : [];
  }))].sort((left, right) => EVENT_ORDER.indexOf(left) - EVENT_ORDER.indexOf(right));
  const fitSetupIssue: "gender" | "times" | "events" | null = !swimmerGender
    ? "gender"
    : fitEventOptions.length === 0
      ? "times"
      : filters.fitMode !== "none" && filters.fitEvents.length === 0
        ? "events"
      : null;
  let fitCoveragePrograms = 0;
  let fitQualifiedPrograms = 0;
  const fitCoveredConferenceCount = fitSummary.coveredConferenceCount;
  const fitEvaluations: Record<string, ProgramFitEvaluation> = {};
  if (isSwimmer && filters.fitMode !== "none") {
    if (swimmerGender && fitSetupIssue === null) {
      const fitResult = await loadPublicProgramFit(
        swimmerGender === "M" ? "men" : "women",
        filters.fitMode,
        filters.fitMode === "conference_place" ? 3 : filters.fitRank,
        filters.fitEvents,
      );
      for (const program of matchingPrograms) {
        const benchmarks = fitResult.benchmarksByProgram[program.id] ?? [];
        fitEvaluations[program.id] = evaluateProgramFit(benchmarks, swimmerTimes, swimmerGender, {
          mode: filters.fitMode,
          rank: filters.fitMode === "conference_place" ? 3 : filters.fitRank,
          events: filters.fitEvents,
          match: filters.fitMatch,
        });
      }
      fitCoveragePrograms = matchingPrograms.filter((program) => fitEvaluations[program.id]?.coveredEventCount > 0).length;
      matchingPrograms = matchingPrograms
        .filter((program) => fitEvaluations[program.id]?.passed);
      fitQualifiedPrograms = matchingPrograms.length;
    } else {
      fitCoveragePrograms = 0;
      matchingPrograms = [];
    }
  }

  const showRuledOutRaw = params.showRuledOut;
  const showRuledOut = (Array.isArray(showRuledOutRaw) ? showRuledOutRaw[0] : showRuledOutRaw) === "1";
  const ruledOutCount = isSwimmer
    ? matchingPrograms.filter((program) => statuses?.[program.id] === "ruled_out").length
    : 0;
  const programs = isSwimmer && !showRuledOut
    ? matchingPrograms.filter((program) => statuses?.[program.id] !== "ruled_out")
    : matchingPrograms;

  const controls = isSwimmer
    ? (programId: string) => (
        <ProgramControls key={`${programId}:${statuses?.[programId] ?? "none"}`} programId={programId} initial={statuses?.[programId]} />
      )
    : undefined;

  return (
    <div className="space-y-4">
      <Explorer
        allPrograms={result.programs}
        facets={facets}
        programs={programs}
        filters={filters}
        requestedPage={requestedPage(params)}
        controls={controls}
        statuses={statuses}
        isSwimmer={isSwimmer}
        showRuledOut={showRuledOut}
        ruledOutCount={ruledOutCount}
        fitEvaluations={fitEvaluations}
        fitEventOptions={fitEventOptions}
        fitCoveragePrograms={fitCoveragePrograms}
        fitQualifiedPrograms={fitQualifiedPrograms}
        fitCoveredConferenceCount={fitCoveredConferenceCount}
        fitDatasetReady={fitDatasetReady}
        fitSetupIssue={fitSetupIssue}
        swimmerAdmissionScores={swimmerAdmissionScores}
        swimmingStrength={swimmingStrength.scores}
        swimmingStrengthCoverage={swimmingStrength.coveredProgramCount}
      />
    </div>
  );
}
