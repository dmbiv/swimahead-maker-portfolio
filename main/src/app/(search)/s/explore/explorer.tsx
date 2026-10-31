import Link from "@/components/app-link";
import { Majors } from "./majors";
import { ProgramFilters } from "./program-filters";
import { ProgramMap } from "./program-map";
import {
  HideWhenRuledOut,
  ProgramStatusArticle,
  ProgramStatusBadge,
  ProgramVisibilityProvider,
  WhenProgramStatus,
} from "./program-visibility";
import { RuleOutBar } from "./rule-out-bar";
import {
  academicScoreValue,
  cipCodeMatches,
  type PublicAcademicScoreMode,
  type PublicCipOffering,
  type PublicProgramFilters,
  type PublicProgramLinkType,
  type PublicProgramStrength,
  type PublicSwimmingProgram,
  type SwimmerAdmissionScores,
} from "@/lib/public-programs";
import { conferenceProgramsHref, programCardId, programListHref } from "@/lib/explore-navigation";
import type { ExploreFacets } from "@/lib/explore-programs";
import { eventLabelForCourse } from "@/lib/events";
import { buildSwimCloudVerificationLink } from "@/lib/swimcloud-links";
import { fmtClock } from "@/lib/time";
import type { ProgramFitEvaluation } from "@/lib/program-fit";
import type { EventCode } from "@/lib/types";

const RESULTS_PER_PAGE = 24;

const integerFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const percentFormatter = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 0,
});

function programDataKeys(
  programs: PublicSwimmingProgram[],
  statuses?: Record<string, "saved" | "ruled_out">,
): { results: string; withStatuses: string } {
  let resultHash = 2_166_136_261;
  let statusHash = 2_166_136_261;
  const mix = (hash: number, text: string): number => {
    let next = hash;
    for (let index = 0; index < text.length; index += 1) {
      next ^= text.charCodeAt(index);
      next = Math.imul(next, 16_777_619);
    }
    next ^= 124;
    return Math.imul(next, 16_777_619);
  };
  for (const program of programs) {
    resultHash = mix(resultHash, program.id);
    statusHash = mix(statusHash, program.id);
    statusHash = mix(statusHash, statuses?.[program.id] ?? "");
  }
  const size = programs.length;
  return {
    results: `${size}:${(resultHash >>> 0).toString(36)}`,
    withStatuses: `${size}:${(statusHash >>> 0).toString(36)}`,
  };
}

const linkLabels: Record<PublicProgramLinkType, string> = {
  program: "Team site",
  swimcloud: "SwimCloud",
  roster: "Roster",
  schedule: "Schedule",
  results: "Results",
  staff: "Staff",
  questionnaire: "Questionnaire",
  recruiting_form: "Recruiting form",
  news: "News",
};

function squadLabel(squad: PublicSwimmingProgram["squad"]): string {
  if (squad === "men") return "Men's";
  if (squad === "women") return "Women's";
  return "Coed";
}

function filterParams(filters: PublicProgramFilters, page: number, showRuledOut: boolean): string {
  const params = new URLSearchParams();
  if (filters.query) params.set("q", filters.query);
  if (filters.squad !== "all") params.set("squad", filters.squad);
  for (const division of filters.divisions) params.append("division", division);
  for (const conference of filters.conferences) params.append("conference", conference);
  for (const state of filters.states) params.append("state", state);
  for (const control of filters.controls) params.append("control", control);
  if (filters.minimumEnrollment !== null) params.set("enrollmentMin", String(filters.minimumEnrollment));
  if (filters.maximumEnrollment !== null) params.set("enrollmentMax", String(filters.maximumEnrollment));
  if (filters.maximumNetPrice !== null) params.set("netPriceMax", String(filters.maximumNetPrice));
  if (filters.maximumAdmissionRate !== null) {
    params.set("admissionMax", String(Math.round(filters.maximumAdmissionRate * 10000) / 100));
  }
  if (filters.academicMode !== "none") {
    params.set("academicTest", filters.academicTest);
    params.set("academicMode", filters.academicMode);
    if (filters.academicValue !== null) params.set("academicValue", String(filters.academicValue));
  } else if (filters.academicTest === "act") params.set("academicTest", "act");
  for (const cip of filters.cips) params.append("cip", cip);
  if (filters.sort !== "name") params.set("sort", filters.sort);
  if (filters.fitMode !== "none") params.set("fitMode", filters.fitMode);
  if (filters.fitMode === "program_rank") params.set("fitRank", String(filters.fitRank));
  for (const event of filters.fitEvents) params.append("fitEvent", event);
  if (filters.fitMatch === "all") params.set("fitMatch", "all");
  if (showRuledOut) params.set("showRuledOut", "1");
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/s/explore?${query}` : "/s/explore";
}

function selectedOfferings(program: PublicSwimmingProgram, cips: string[]): PublicCipOffering[] {
  const offerings = program.bachelorsOfferings;
  if (cips.length === 0) return offerings;
  return offerings.filter((offering) => cips.some((cip) => {
    if (cip.startsWith("family:")) return cipCodeMatches(offering.code, cip.slice("family:".length));
    if (cip.startsWith("code:")) return offering.code === cip.slice("code:".length);
    return false;
  }));
}

function fitHeading(filters: PublicProgramFilters, evaluation: ProgramFitEvaluation): string {
  if (filters.fitMode === "conference_score") return `Conference scoring range in ${evaluation.qualifyingEventCount} ${evaluation.qualifyingEventCount === 1 ? "event" : "events"}`;
  if (filters.fitMode === "conference_place") return `Conference top 3 range in ${evaluation.qualifyingEventCount} ${evaluation.qualifyingEventCount === 1 ? "event" : "events"}`;
  return `School top ${filters.fitRank} at conference meet in ${evaluation.qualifyingEventCount} ${evaluation.qualifyingEventCount === 1 ? "event" : "events"}`;
}

function academicModeNeeds(
  mode: PublicAcademicScoreMode,
): "median" | "middle50" | "percentile25" | "percentile75" | null {
  if (mode === "median_at_least" || mode === "median_at_most") return "median";
  if (mode === "middle_50") return "middle50";
  if (mode === "at_or_above_25th") return "percentile25";
  if (mode === "above_75th") return "percentile75";
  return null;
}

function programHasAcademicData(program: PublicSwimmingProgram, filters: PublicProgramFilters): boolean {
  const needed = academicModeNeeds(filters.academicMode) ?? "median";
  const range = program.admissionScores[filters.academicTest];
  if (needed === "middle50") return range.percentile25 !== null && range.percentile75 !== null;
  return range[needed] !== null;
}

export function ProgramCard({ program, cips, controls, status, filters, fitEvaluation, swimmerAdmissionScores, swimmingStrength, conferenceReturnHref }: {
  program: PublicSwimmingProgram;
  cips: string[];
  controls?: (programId: string) => React.ReactNode;
  status?: "saved" | "ruled_out";
  filters: PublicProgramFilters;
  fitEvaluation?: ProgramFitEvaluation;
  swimmerAdmissionScores: SwimmerAdmissionScores;
  swimmingStrength?: PublicProgramStrength;
  conferenceReturnHref?: string;
}) {
  const offerings = selectedOfferings(program, cips);
  const location = [program.city, program.stateCode].filter(Boolean).join(", ");
  const priority = ["staff", "questionnaire", "recruiting_form", "roster", "program"];
  const priorityRank = (type: PublicProgramLinkType) => {
    const index = priority.indexOf(type);
    return index < 0 ? priority.length : index;
  };
  const links = [...program.verifiedLinks].sort((a, b) => priorityRank(a.type) - priorityRank(b.type));
  const primaryLinks = links.slice(0, 3);
  const moreLinks = links.slice(3);
  const programRankBenchmark = filters.fitMode === "program_rank" && fitEvaluation?.passed
    ? fitEvaluation.bestComparison?.benchmark ?? null
    : null;
  const swimCloudVerification = programRankBenchmark
    ? buildSwimCloudVerificationLink({
        links: program.verifiedLinks,
        institutionName: program.institutionName,
        stateCode: program.stateCode,
        gender: programRankBenchmark.gender,
        seasonLabel: programRankBenchmark.seasonLabel,
        event: programRankBenchmark.event,
        course: programRankBenchmark.course,
      })
    : null;
  const academicRange = program.admissionScores[filters.academicTest];
  const swimmerAcademicScore = swimmerAdmissionScores[filters.academicTest];
  const academicCutoff = academicScoreValue(filters, swimmerAdmissionScores);
  const academicTestLabel = filters.academicTest.toUpperCase();

  return (
    <ProgramStatusArticle
      programId={program.id}
      initial={status}
      id={programCardId(program.id)}
      className="wr-card scroll-mt-24 p-4 sm:p-5"
    >
      <div className="flex flex-col gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h2 className="text-base font-semibold tracking-[-0.02em]">{program.programName}</h2>
            <span className="wr-badge border-accent/30 bg-accent/8 text-accent-2">
              {squadLabel(program.squad)} swimming
            </span>
            <ProgramStatusBadge programId={program.id} initial={status} />
          </div>
          <p className="mt-1 text-xs text-ink-3">
            {[location, program.division, program.governingBody]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {program.programName !== program.institutionName && <p className="mt-1 text-xs text-ink-3">Academic institution: {program.institutionName}</p>}
          <p className="mt-1 text-xs text-ink-2">
            <span className="font-semibold">Conference:</span>{" "}
            {program.conference ? (
              <Link
                href={conferenceProgramsHref(
                  program.conference.id,
                  conferenceReturnHref ? programListHref(conferenceReturnHref, program.id) : undefined,
                )}
                className="program-conference-link"
              >
                {program.conference.name}
              </Link>
            ) : "Not reported"}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {controls && controls(program.id)}
          <WhenProgramStatus programId={program.id} initial={status} is="saved">
            <Link href={`/s/outreach/drafts/new?program=${encodeURIComponent(program.id)}`} className="wr-btn wr-btn--neutral wr-btn--small">
              Draft email
            </Link>
          </WhenProgramStatus>
          {program.institutionWebsiteUrl && (
            <a href={program.institutionWebsiteUrl} target="_blank" rel="noreferrer" className="wr-btn wr-btn--neutral wr-btn--small">
              College site <span aria-hidden="true">↗</span>
            </a>
          )}
          {primaryLinks.map((link) => (
            <a key={link.id} href={link.url} target="_blank" rel="noreferrer" className="wr-btn wr-btn--neutral wr-btn--small">
              {linkLabels[link.type]} <span aria-hidden="true">↗</span>
            </a>
          ))}
          {moreLinks.length > 0 && (
            <details className="program-resource-menu">
              <summary className="wr-btn wr-btn--neutral wr-btn--small">More links ({moreLinks.length})</summary>
              <div className="program-resource-menu-popover">
                {moreLinks.map((link) => (
                  <a key={link.id} href={link.url} target="_blank" rel="noreferrer">{linkLabels[link.type]} <span aria-hidden>↗</span></a>
                ))}
              </div>
            </details>
          )}
        </div>
      </div>

      {fitEvaluation?.passed && (
        <section className="mt-3 rounded-[var(--radius)] border border-accent/25 bg-accent/5 px-3 py-2.5" aria-label="Performance opportunity">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <strong className="text-xs text-accent-2">{fitHeading(filters, fitEvaluation)}</strong>
            <span className="text-[10px] text-ink-3">Exact-course comparison</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
            {fitEvaluation.comparisons.filter((comparison) => comparison.qualifies).slice(0, 4).map((comparison) => (
              <span key={`${comparison.event}:${comparison.course}`} className="text-[11px] text-ink-2">
                <strong>{eventLabelForCourse(comparison.event, comparison.course)}</strong>: {fmtClock(comparison.swimmerSeconds)} vs {fmtClock(comparison.benchmarkSeconds)} {comparison.course}
                {comparison.benchmark.evidenceUrl && <a className="ml-1 font-semibold text-accent-2 hover:underline" href={comparison.benchmark.evidenceUrl} target="_blank" rel="noreferrer" aria-label={`Open evidence for ${eventLabelForCourse(comparison.event, comparison.course)}`}>source</a>}
              </span>
            ))}
          </div>
          {swimCloudVerification && (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-accent/20 pt-2 text-[10px]">
              <span className="text-ink-3">This school cutoff comes only from its conference championship; SwimCloud shows broader season times.</span>
              <a
                className="font-semibold text-accent-2 hover:underline"
                href={swimCloudVerification.href}
                target="_blank"
                rel="noreferrer"
                title={swimCloudVerification.kind === "direct"
                  ? `Open this team's ${swimCloudVerification.seasonLabel} SwimCloud times`
                  : `A verified SwimCloud team ID is not stored yet; find the team, then select ${swimCloudVerification.seasonLabel}`}
              >
                {swimCloudVerification.kind === "direct"
                  ? `Cross-check ${swimCloudVerification.seasonLabel} times on SwimCloud`
                  : "Find team on SwimCloud"} <span aria-hidden>↗</span>
              </a>
            </div>
          )}
        </section>
      )}

      {filters.academicMode !== "none" && (
        <section className="mt-3 rounded-[var(--radius)] border border-accent/25 bg-accent/5 px-3 py-2.5" aria-label="Academic score comparison">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <strong className="text-xs text-accent-2">{academicTestLabel} admissions score</strong>
            {swimmerAcademicScore !== null && <span className="font-data text-[10px] text-ink-3">Your saved score: {swimmerAcademicScore}</span>}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-2">
            {academicRange.median !== null && <span>Median: <strong className="font-data">{academicRange.median}</strong></span>}
            {academicRange.percentile25 !== null && academicRange.percentile75 !== null && (
              <span>Middle 50%: <strong className="font-data">{academicRange.percentile25}–{academicRange.percentile75}</strong></span>
            )}
            {(filters.academicMode === "median_at_least" || filters.academicMode === "median_at_most") && academicCutoff !== null && (
              <span>Filter cutoff: <strong className="font-data">{academicCutoff}</strong></span>
            )}
          </div>
          {filters.academicTest === "sat" && <p className="mt-1.5 text-[10px] text-ink-3">Composite values combine reported reading and math percentiles.</p>}
        </section>
      )}

      {filters.sort === "swimming-strength" && (
        <section className="mt-3 rounded-[var(--radius)] border border-accent/25 bg-accent/5 px-3 py-2.5" aria-label="Swimming strength">
          {swimmingStrength ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <strong className="text-xs text-accent-2">Swimming strength index {swimmingStrength.score.toFixed(1)} / 100</strong>
              <span className="text-[10px] text-ink-3">{swimmingStrength.eventCount} verified peer comparisons</span>
            </div>
          ) : (
            <p className="text-xs text-ink-3">Not enough verified event coverage to calculate a swimming strength index.</p>
          )}
        </section>
      )}

      <dl className="mt-4 grid grid-cols-2 border-y border-line sm:grid-cols-4">
        <div className="border-b border-line py-3 pr-3 sm:border-b-0 sm:border-r">
          <dt className="wr-stat-label">Control</dt>
          <dd className="mt-1 text-sm font-medium">{program.control}</dd>
        </div>
        <div className="border-b border-line py-3 pl-3 sm:border-b-0 sm:border-r sm:pr-3">
          <dt className="wr-stat-label">Undergraduate enrollment</dt>
          <dd className="font-data mt-1 text-sm">
            {program.undergraduateEnrollment === null
              ? "Not reported"
              : integerFormatter.format(program.undergraduateEnrollment)}
          </dd>
        </div>
        <div className="py-3 pr-3 sm:border-r sm:pl-3">
          <dt className="wr-stat-label">Admission rate</dt>
          <dd className="font-data mt-1 text-sm">
            {program.admissionRate === null ? "Not reported" : percentFormatter.format(program.admissionRate)}
          </dd>
        </div>
        <div className="py-3 pl-3">
          <dt className="wr-stat-label">Average net price</dt>
          <dd className="font-data mt-1 text-sm">
            {program.averageNetPrice === null ? "Not reported" : currencyFormatter.format(program.averageNetPrice)}
          </dd>
        </div>
      </dl>

      <Majors titles={offerings.map((o) => o.title)} />
    </ProgramStatusArticle>
  );
}

export function Explorer({
  programs,
  allPrograms,
  facets,
  filters,
  requestedPage,
  controls,
  statuses,
  isSwimmer = false,
  showRuledOut = false,
  ruledOutCount = 0,
  fitEvaluations = {},
  fitEventOptions = [],
  fitCoveragePrograms = 0,
  fitQualifiedPrograms = 0,
  fitCoveredConferenceCount = 0,
  fitDatasetReady = false,
  fitSetupIssue = null,
  swimmerAdmissionScores = { sat: null, act: null },
  swimmingStrength = {},
  swimmingStrengthCoverage = 0,
}: {
  programs: PublicSwimmingProgram[];
  allPrograms: PublicSwimmingProgram[];
  facets: ExploreFacets;
  filters: PublicProgramFilters;
  requestedPage: number;
  controls?: (programId: string) => React.ReactNode;
  statuses?: Record<string, "saved" | "ruled_out">;
  isSwimmer?: boolean;
  showRuledOut?: boolean;
  ruledOutCount?: number;
  fitEvaluations?: Record<string, ProgramFitEvaluation>;
  fitEventOptions?: EventCode[];
  fitCoveragePrograms?: number;
  fitQualifiedPrograms?: number;
  fitCoveredConferenceCount?: number;
  fitDatasetReady?: boolean;
  fitSetupIssue?: "gender" | "times" | "events" | null;
  swimmerAdmissionScores?: SwimmerAdmissionScores;
  swimmingStrength?: Record<string, PublicProgramStrength>;
  swimmingStrengthCoverage?: number;
}) {
  const { divisions, conferences, states, cipOptions, testScoreCoveragePrograms } = facets;
  const academicScoreCoverage = allPrograms.filter((program) => programHasAcademicData(program, filters)).length;
  const academicComparisonScore = academicScoreValue(filters, swimmerAdmissionScores);
  const academicSetupIssue = filters.academicMode === "none"
    ? null
    : filters.academicMode === "median_at_least" || filters.academicMode === "median_at_most"
      ? academicComparisonScore === null ? "score" : null
      : swimmerAdmissionScores[filters.academicTest] === null ? "score" : null;
  const pageCount = Math.max(1, Math.ceil(programs.length / RESULTS_PER_PAGE));
  const currentPage = Math.min(Math.max(1, requestedPage), pageCount);
  const pageStart = (currentPage - 1) * RESULTS_PER_PAGE;
  const pagePrograms = programs.slice(pageStart, pageStart + RESULTS_PER_PAGE);
  const programIds = programs.map((program) => program.id);
  const dataKeys = programDataKeys(programs, statuses);
  const campusCount = new Set(programs.flatMap((program) =>
    program.latitude !== null && program.longitude !== null ? [program.institutionId] : [])).size;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 aria-live="polite">{integerFormatter.format(programs.length)} {programs.length === 1 ? "program" : "programs"}</h1>
          {isSwimmer && ruledOutCount > 0 && !showRuledOut && (
            <p className="mt-1 text-xs text-ink-3">{ruledOutCount} ruled-out {ruledOutCount === 1 ? "program is" : "programs are"} hidden.</p>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <a
            href="https://collegecost.ed.gov/net-price"
            target="_blank"
            rel="noreferrer"
            className="wr-btn wr-btn--neutral wr-btn--small"
          >
            DOE net price calculator ↗
          </a>
          {isSwimmer && <Link href="/s/board" className="wr-btn wr-btn--neutral wr-btn--small">Open my list</Link>}
        </div>
      </div>

      <ProgramFilters
        filters={filters}
        divisions={divisions}
        conferences={conferences}
        states={states}
        cipOptions={cipOptions}
        showRuledOut={showRuledOut}
        ruledOutCount={ruledOutCount}
        signedIn={isSwimmer}
        fitEventOptions={fitEventOptions}
        fitCoveragePrograms={fitCoveragePrograms}
        fitQualifiedPrograms={fitQualifiedPrograms}
        fitCoveredConferenceCount={fitCoveredConferenceCount}
        fitDatasetReady={fitDatasetReady}
        fitSetupIssue={fitSetupIssue}
        swimmerAdmissionScores={swimmerAdmissionScores}
        academicScoreCoverage={academicScoreCoverage}
        testScoreCoveragePrograms={testScoreCoveragePrograms}
        academicMatchedPrograms={programs.length}
        swimmingStrengthCoverage={swimmingStrengthCoverage}
      />

      <ProgramVisibilityProvider
        key={dataKeys.results}
        showRuledOut={showRuledOut}
        programIds={programIds}
        initialStatuses={statuses}
      >
      {isSwimmer && <RuleOutBar key={`rules:${dataKeys.withStatuses}`} />}

      {programs.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]">
          <div className="space-y-3 order-2 lg:order-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-ink-3">
                {integerFormatter.format(pageStart + 1)}–{integerFormatter.format(pageStart + pagePrograms.length)} of {integerFormatter.format(programs.length)}
              </p>
              {pageCount > 1 && (
                <nav className="flex items-center gap-2" aria-label="Program pages">
                  {currentPage > 1 && <Link className="wr-btn wr-btn--neutral wr-btn--small" href={filterParams(filters, currentPage - 1, showRuledOut)}>Previous</Link>}
                  <span className="font-data text-xs text-ink-3">Page {currentPage} of {pageCount}</span>
                  {currentPage < pageCount && <Link className="wr-btn wr-btn--neutral wr-btn--small" href={filterParams(filters, currentPage + 1, showRuledOut)}>Next</Link>}
                </nav>
              )}
            </div>
            {pagePrograms.map((program) => (
              <HideWhenRuledOut key={program.id} programId={program.id}>
                <ProgramCard
                  program={program}
                  cips={filters.cips}
                  controls={controls}
                  status={statuses?.[program.id]}
                  filters={filters}
                  fitEvaluation={fitEvaluations[program.id]}
                  swimmerAdmissionScores={swimmerAdmissionScores}
                  swimmingStrength={swimmingStrength[program.id]}
                  conferenceReturnHref={filterParams(filters, currentPage, showRuledOut)}
                />
              </HideWhenRuledOut>
            ))}
            {pageCount > 1 && (
              <nav className="flex items-center justify-center gap-3 border-t border-line pt-4" aria-label="Program pages">
                {currentPage > 1 ? <Link className="wr-btn wr-btn--neutral wr-btn--small" href={filterParams(filters, currentPage - 1, showRuledOut)}>Previous</Link> : <span />}
                <span className="font-data text-xs text-ink-3">Page {currentPage} of {pageCount}</span>
                {currentPage < pageCount ? <Link className="wr-btn wr-btn--neutral wr-btn--small" href={filterParams(filters, currentPage + 1, showRuledOut)}>Next</Link> : <span />}
              </nav>
            )}
          </div>
          <div className="order-1 lg:order-2">
            <div className="lg:sticky lg:top-4">
              <ProgramMap
                key={`map:${dataKeys.results}`}
                campusCount={campusCount}
                listBaseHref={filterParams(filters, 1, showRuledOut)}
              />
            </div>
          </div>
        </div>
      ) : (
        <section className="wr-card p-8 text-center">
          <h2 className="text-base font-semibold">{filters.fitMode !== "none" ? (fitSetupIssue === "gender" ? "Add your competition category first" : fitSetupIssue === "times" ? "Add a result to compare programs" : fitSetupIssue === "events" ? "Choose an event to compare" : !fitDatasetReady ? "The benchmark dataset is empty" : fitCoveragePrograms === 0 ? "No verified benchmarks cover this selection" : "No covered programs meet this performance target") : academicSetupIssue ? `Add your ${filters.academicTest.toUpperCase()} score first` : filters.academicMode !== "none" && academicScoreCoverage === 0 ? `No colleges report this ${filters.academicTest.toUpperCase()} range` : isSwimmer && ruledOutCount > 0 && !showRuledOut ? "All matching programs are ruled out" : "No programs match these filters"}</h2>
          <p className="mt-1 text-sm text-ink-3">{filters.fitMode !== "none" ? (fitSetupIssue === "gender" ? "Your profile category determines which verified cutoff set applies." : fitSetupIssue === "times" ? "The comparison uses your logged results and never invents a time." : fitSetupIssue === "events" ? "Select one or more events in the performance filter. The app will not silently use whichever result produces the most matches." : !fitDatasetReady ? "The migration created the benchmark tables, but no verified conference result set has been imported yet." : fitCoveragePrograms === 0 ? "The loaded result sets do not cover these programs, events, and course yet." : "Try another event, choose match any event, or clear the performance target.") : academicSetupIssue ? "Save the score in Profile, then this filter can compare it with each college’s reported admissions range." : filters.academicMode !== "none" && academicScoreCoverage === 0 ? "Try the other test type or clear the academic score filter. Colleges without the required reported values are omitted." : isSwimmer && ruledOutCount > 0 && !showRuledOut ? "Show them temporarily or restore programs from your list." : "Clear one or more filters to widen the result set."}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {filters.fitMode !== "none" && (fitSetupIssue === "gender" || fitSetupIssue === "times") && <Link href={fitSetupIssue === "gender" ? "/s/profile" : "/s/times"} className="wr-btn wr-btn--primary">{fitSetupIssue === "gender" ? "Open Profile" : "Open My Times"}</Link>}
            {filters.fitMode === "none" && academicSetupIssue && <Link href="/s/profile" className="wr-btn wr-btn--primary">Open Profile</Link>}
            {isSwimmer && ruledOutCount > 0 && !showRuledOut && <Link href={filterParams(filters, 1, true)} className="wr-btn wr-btn--primary">Show ruled-out</Link>}
            {isSwimmer && ruledOutCount > 0 && !showRuledOut && <Link href="/s/board?view=ruled-out" className="wr-btn wr-btn--neutral">Manage ruled-out</Link>}
            {!(filters.fitMode !== "none" && fitSetupIssue) && !academicSetupIssue && !(isSwimmer && ruledOutCount > 0 && !showRuledOut) && <Link href="/s/explore" className="wr-btn wr-btn--primary">Clear filters</Link>}
          </div>
        </section>
      )}
      </ProgramVisibilityProvider>
    </div>
  );
}
