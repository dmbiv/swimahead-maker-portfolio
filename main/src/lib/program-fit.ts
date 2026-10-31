import { canonicalEvent, EVENT_ORDER } from "./events";
import { selectPreferredBenchmarkDatasets } from "./fit-benchmark-selection";
import type {
  PublicProgramFitBenchmark,
  PublicProgramFitMode,
} from "./public-programs";
import type { Course, EventCode, Gender } from "./types";

export type ProgramFitInputTime = {
  event: string;
  course: Course;
  seconds: number;
};

export type ProgramFitFilter = {
  mode: PublicProgramFitMode;
  rank: number;
  events: EventCode[];
  match: "any" | "all";
};

export type ProgramFitComparison = {
  event: EventCode;
  course: Course;
  swimmerSeconds: number;
  benchmarkSeconds: number;
  qualifies: boolean;
  marginSeconds: number;
  marginPercent: number;
  benchmark: PublicProgramFitBenchmark;
};

export type ProgramFitEvaluation = {
  passed: boolean;
  selectedEvents: EventCode[];
  coveredEventCount: number;
  qualifyingEventCount: number;
  comparisons: ProgramFitComparison[];
  bestComparison: ProgramFitComparison | null;
  sortScore: number;
};

function benchmarkMatchesMode(benchmark: PublicProgramFitBenchmark, filter: ProgramFitFilter): boolean {
  if (filter.mode === "none" || benchmark.scope !== filter.mode) return false;
  if (filter.mode === "conference_score") return benchmark.rankCutoff === null;
  return benchmark.rankCutoff === filter.rank;
}

export function evaluateProgramFit(
  benchmarks: PublicProgramFitBenchmark[],
  times: ProgramFitInputTime[],
  gender: Gender,
  filter: ProgramFitFilter,
): ProgramFitEvaluation {
  const swimmerGender = gender === "M" ? "men" : "women";
  const bestTimes = new Map<string, number>();
  for (const time of times) {
    if (!Number.isFinite(time.seconds) || time.seconds <= 0) continue;
    const event = canonicalEvent(time.event, time.course);
    if (!event) continue;
    const key = `${event}:${time.course}`;
    const current = bestTimes.get(key);
    if (current === undefined || time.seconds < current) bestTimes.set(key, time.seconds);
  }

  const availableEvents = [...new Set([...bestTimes.keys()].map((key) => key.split(":")[0] as EventCode))]
    .sort((left, right) => EVENT_ORDER.indexOf(left) - EVENT_ORDER.indexOf(right));
  const selectedEvents = filter.events.filter((event) => availableEvents.includes(event));
  const selectedSet = new Set(selectedEvents);
  const preferredDatasets = selectPreferredBenchmarkDatasets(benchmarks.filter((benchmark) =>
    benchmark.gender === swimmerGender
    && benchmarkMatchesMode(benchmark, filter)));
  const applicable = preferredDatasets.filter((benchmark) => selectedSet.has(benchmark.event));

  const comparisonsByEvent = new Map<EventCode, ProgramFitComparison[]>();
  for (const benchmark of applicable) {
    const swimmerSeconds = bestTimes.get(`${benchmark.event}:${benchmark.course}`);
    if (swimmerSeconds === undefined) continue;
    const marginSeconds = benchmark.seconds - swimmerSeconds;
    const comparison: ProgramFitComparison = {
      event: benchmark.event,
      course: benchmark.course,
      swimmerSeconds,
      benchmarkSeconds: benchmark.seconds,
      qualifies: marginSeconds >= 0,
      marginSeconds,
      marginPercent: (marginSeconds / benchmark.seconds) * 100,
      benchmark,
    };
    comparisonsByEvent.set(benchmark.event, [...(comparisonsByEvent.get(benchmark.event) ?? []), comparison]);
  }

  const comparisons = selectedEvents.flatMap((event): ProgramFitComparison[] => {
    const candidates = comparisonsByEvent.get(event) ?? [];
    return candidates.length
      ? [candidates.sort((left, right) => right.marginPercent - left.marginPercent)[0]]
      : [];
  });
  const qualifying = comparisons.filter((comparison) => comparison.qualifies);
  const passed = filter.mode !== "none" && selectedEvents.length > 0 && (
    filter.match === "all"
      ? comparisons.length === selectedEvents.length && qualifying.length === selectedEvents.length
      : qualifying.length > 0
  );
  const bestComparison = [...qualifying].sort((left, right) => right.marginPercent - left.marginPercent)[0] ?? null;
  const weakestMargin = qualifying.length
    ? Math.min(...qualifying.map((comparison) => comparison.marginPercent))
    : -100;
  const sortMargin = filter.match === "all" ? weakestMargin : bestComparison?.marginPercent ?? weakestMargin;
  const sortScore = qualifying.length * 10_000 + sortMargin;

  return {
    passed,
    selectedEvents,
    coveredEventCount: comparisons.length,
    qualifyingEventCount: qualifying.length,
    comparisons,
    bestComparison,
    sortScore,
  };
}
