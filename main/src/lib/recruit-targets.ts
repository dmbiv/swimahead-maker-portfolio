import "server-only";

import { performanceScoreToSeconds } from "./performance-points";
import { rosterEventStats, RELAY_EVENTS } from "./coach-roster-analysis";
import { clampRecruitScore, DEFAULT_RECRUIT_SCORE } from "./recruit-controls";
import { fmtClock } from "./time";
import type { RosterAnalysis } from "./coach-roster-analysis";
import type { EventCode, Gender } from "./types";


export type TargetBasis = "roster_median" | "roster_overall" | "default";

export type RecommendedTarget = {
  event: EventCode;
  targetScore: number;
  targetSeconds: number | null;
  targetTime: string | null;
  basis: TargetBasis;
  rosterMedian: number | null;
  depth: number;
  isRelayLeg: boolean;
  isGap: boolean;
};

function overallMedian(roster: RosterAnalysis | null): number | null {
  if (!roster) return null;
  const medians = roster.events
    .map((e) => e.medianScore)
    .filter((value): value is number => value != null);
  if (medians.length === 0) return null;
  const sorted = [...medians].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
}

export function recommendTarget(
  roster: RosterAnalysis | null,
  event: EventCode,
  gender: Gender,
  fallbackScore = DEFAULT_RECRUIT_SCORE,
): RecommendedTarget {
  const stats = rosterEventStats(roster, event);
  const rosterMedian = stats?.medianScore ?? null;
  const overall = overallMedian(roster);

  const basis: TargetBasis = rosterMedian != null
    ? "roster_median"
    : overall != null
      ? "roster_overall"
      : "default";
  const targetScore = clampRecruitScore(rosterMedian ?? overall ?? fallbackScore);
  const targetSeconds = performanceScoreToSeconds({ event, course: "SCY", points: targetScore }, gender);

  return {
    event,
    targetScore,
    targetSeconds,
    targetTime: targetSeconds == null ? null : fmtClock(targetSeconds),
    basis,
    rosterMedian,
    depth: stats?.depth ?? 0,
    isRelayLeg: RELAY_EVENTS.includes(event),
    isGap: stats != null && stats.scoredCount === 0,
  };
}

export function recommendTargets(
  roster: RosterAnalysis | null,
  events: readonly EventCode[],
  gender: Gender,
  fallbackScore = DEFAULT_RECRUIT_SCORE,
): RecommendedTarget[] {
  return events
    .map((event) => recommendTarget(roster, event, gender, fallbackScore))
    .sort((a, b) => {
      if (a.isGap !== b.isGap) return a.isGap ? -1 : 1;
      if (a.depth !== b.depth) return a.depth - b.depth;
      if (a.isRelayLeg !== b.isRelayLeg) return a.isRelayLeg ? -1 : 1;
      return events.indexOf(a.event) - events.indexOf(b.event);
    });
}
