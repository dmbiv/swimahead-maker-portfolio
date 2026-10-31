import "server-only";

import { performanceScore } from "./performance-points";
import { milesFromCollegeToLsc } from "./lsc-geo";
import { rosterEventStats } from "./coach-roster-analysis";
import { NICHES, nicheByKey, type Niche } from "./niches";
import type { EventCode, Gender } from "./types";
import type { SwimsProspect } from "./swims";
import type { RosterAnalysis } from "./coach-roster-analysis";
import {
  clampPreferredRadius,
  clampRecruitScore,
  clampTolerance,
  proximityWeightFor,
  DEFAULT_FASTER_TOLERANCE,
  DEFAULT_SLOWER_TOLERANCE,
} from "./recruit-controls";

export { NICHES, nicheByKey, type Niche };


export type EventTarget = {
  event: EventCode;
  targetScore: number;
};

export type ProspectProfile = Partial<Record<EventCode, number>>;

export type BandDirection = "in_band" | "above_band" | "below_band";

export type FitInputs = {
  event: EventCode;
  gender: Gender;
  targetScore: number;
  targets?: readonly EventTarget[];
  bestOf?: number;
  slowerTolerance?: number;
  fasterTolerance?: number;
  preferredRadiusMiles: number | null;
  college: { latitude: number | null; longitude: number | null };
  roster: RosterAnalysis | null;
};

export type EventMatch = {
  event: EventCode;
  targetScore: number;
  abilityScore: number | null;
  delta: number | null;
  band: number;  
  direction: BandDirection;
  counted: boolean;  
};

export type FitResult = {
  prospect: SwimsProspect;
  abilityScore: number | null;  
  targetScore: number;
  aboveThreshold: boolean;
  abilityDelta: number | null;
  rosterMedian: number | null;
  bandScore: number;
  direction: BandDirection;
  matches: EventMatch[];
  needBonus: number;  
  proximityMiles: number | null;
  proximityBonus: number;  
  fit: number;  
  fitLabel: "strong" | "solid" | "reach" | "stretch";
};

function rosterNeed(roster: RosterAnalysis | null, event: EventCode): number {
  const es = rosterEventStats(roster, event);
  if (!es) return 0.5;  
  let need = es.topScore == null ? 1 : es.depth === 0 ? 0.75 : es.depth === 1 ? 0.5 : 0.3;
  if (es.isRelayLeg) need = Math.min(1, need + 0.15);
  return need;
}

function proximityFrom(miles: number | null, preferredRadiusMiles: number | null): number {
  if (preferredRadiusMiles == null) return 0.5;
  if (miles == null) return 0.35;
  if (miles <= preferredRadiusMiles) return 1 - 0.2 * (miles / preferredRadiusMiles);
  const beyond = (miles - preferredRadiusMiles) / (preferredRadiusMiles * 1.5);
  return Math.max(0, 0.8 * (1 - beyond));
}

const IN_BAND_THRESHOLD = 0.5;

function bandMatch(
  ability: number | null,
  targetScore: number,
  slowerTolerance: number,
  fasterTolerance: number,
): { band: number; direction: BandDirection; delta: number | null } {
  if (ability == null) return { band: 0, direction: "below_band", delta: null };
  const delta = ability - targetScore;
  const band = delta >= 0
    ? Math.max(0, 1 - delta / fasterTolerance)
    : Math.max(0, 1 - -delta / slowerTolerance);
  if (band >= IN_BAND_THRESHOLD) return { band, direction: "in_band", delta };
  return { band, direction: delta >= 0 ? "above_band" : "below_band", delta };
}

function abilityFor(
  prospect: SwimsProspect,
  profile: ProspectProfile | undefined,
  event: EventCode,
  searchedEvent: EventCode,
  gender: Gender,
): number | null {
  const seconds = event === searchedEvent ? prospect.seconds ?? profile?.[event] : profile?.[event];
  if (seconds == null || !Number.isFinite(seconds)) return null;
  return performanceScore({ event, course: "SCY", seconds }, gender)?.value ?? null;
}

function defaultBestOf(count: number): number {
  return count >= 3 ? count - 1 : count;
}

export function scoreProspect(
  prospect: SwimsProspect,
  inputs: FitInputs,
  profile?: ProspectProfile,
): FitResult {
  const slowerTolerance = clampTolerance(inputs.slowerTolerance, DEFAULT_SLOWER_TOLERANCE);
  const fasterTolerance = clampTolerance(inputs.fasterTolerance, DEFAULT_FASTER_TOLERANCE);

  const targets: EventTarget[] = inputs.targets?.length
    ? inputs.targets.map((t) => ({ event: t.event, targetScore: clampRecruitScore(t.targetScore) }))
    : [{ event: inputs.event, targetScore: clampRecruitScore(inputs.targetScore) }];

  const evaluated = targets.map((target) => {
    const ability = abilityFor(prospect, profile, target.event, inputs.event, inputs.gender);
    const { band, direction, delta } = bandMatch(ability, target.targetScore, slowerTolerance, fasterTolerance);
    return { event: target.event, targetScore: target.targetScore, abilityScore: ability, delta, band, direction };
  });

  const bestOf = Math.max(1, Math.min(targets.length, inputs.bestOf ?? defaultBestOf(targets.length)));
  const ranked = [...evaluated].sort((a, b) => b.band - a.band);
  const counted = new Set(ranked.slice(0, bestOf).map((m) => m.event));
  const bandScore = ranked.slice(0, bestOf).reduce((sum, m) => sum + m.band, 0) / bestOf;

  const matches: EventMatch[] = evaluated.map((m) => ({ ...m, counted: counted.has(m.event) }));
  const leader = ranked[0];

  const searched = evaluated.find((m) => m.event === inputs.event) ?? evaluated[0];
  const primaryTarget = clampRecruitScore(inputs.targetScore);
  const rosterMedian = rosterEventStats(inputs.roster, inputs.event)?.medianScore ?? null;

  const need = rosterNeed(inputs.roster, inputs.event);
  const miles = milesFromCollegeToLsc(inputs.college, prospect.lsc || null);
  const radius = clampPreferredRadius(inputs.preferredRadiusMiles);
  const proximity = proximityFrom(miles, radius);

  const hasRoster = Boolean(inputs.roster && inputs.roster.scoredCount > 0);
  const proximityWeight = proximityWeightFor(radius);
  const remaining = 1 - proximityWeight;
  const needWeight = hasRoster ? remaining * 0.22 : 0;
  const bandWeight = remaining - needWeight;
  const base = bandScore * bandWeight + need * needWeight + proximity * proximityWeight;
  const fit = Math.round(Math.max(0, Math.min(1, base)) * 100);

  const fitLabel: FitResult["fitLabel"] =
    fit >= 70 ? "strong" : fit >= 50 ? "solid" : fit >= 32 ? "reach" : "stretch";

  return {
    prospect,
    abilityScore: searched.abilityScore,
    targetScore: primaryTarget,
    aboveThreshold: searched.abilityScore != null && searched.abilityScore >= primaryTarget,
    abilityDelta: searched.delta,
    rosterMedian,
    bandScore,
    direction: leader.direction,
    matches,
    needBonus: need,
    proximityMiles: miles,
    proximityBonus: proximity,
    fit,
    fitLabel,
  };
}

export function rankProspects(
  prospects: SwimsProspect[],
  inputs: FitInputs,
  profiles?: ReadonlyMap<string, ProspectProfile>,
): FitResult[] {
  return prospects
    .map((p) => scoreProspect(p, inputs, profiles?.get(p.memberId)))
    .sort((a, b) => b.fit - a.fit);
}
