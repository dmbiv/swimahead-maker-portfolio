import "server-only";

import { EVENT_ORDER, EVENT_LABELS, EVENT_GROUPS, GROUP_LABELS, GROUPS } from "./events";
import { performanceScore } from "./performance-points";
import type { EventCode, EventGroup, Gender } from "./types";
import type { RosterSwimmer } from "./coach-roster";


export const RELAY_EVENTS: EventCode[] = ["50FR", "100FR", "200FR", "100BK", "100BR", "100FL"];

const DEPTH_FLOOR = 500;  

export type EventStrength = {
  event: EventCode;
  label: string;
  group: EventGroup;
  isRelayLeg: boolean;
  topScore: number | null;
  topSwimmer: string | null;
  medianScore: number | null;  
  scoredCount: number;  
  depth: number;  
};

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
}

export type GroupStrength = {
  group: EventGroup;
  label: string;
  bestScore: number | null;
  depth: number;  
  events: EventStrength[];
};

export type RosterAnalysis = {
  course: "SCY";
  swimmerCount: number;
  scoredCount: number;
  events: EventStrength[];  
  groups: GroupStrength[];
  strengths: EventStrength[];  
  gaps: EventStrength[];  
};

export function rosterEventStats(analysis: RosterAnalysis | null, event: EventCode): EventStrength | null {
  return analysis?.events.find((e) => e.event === event) ?? null;
}

function bestScyScore(swimmer: RosterSwimmer, event: EventCode, gender: Gender): number | null {
  const t = swimmer.times.find((x) => x.event === event && x.course === "SCY");
  if (!t) return null;
  return performanceScore({ event, course: "SCY", seconds: t.seconds }, gender)?.value ?? null;
}

export function analyzeRoster(swimmers: RosterSwimmer[]): RosterAnalysis {
  const events: EventStrength[] = EVENT_ORDER.map((event) => {
    const group = EVENT_GROUPS[event];
    let topScore: number | null = null;
    let topSwimmer: string | null = null;
    let depth = 0;
    const scores: number[] = [];
    for (const s of swimmers) {
      const score = bestScyScore(s, event, s.gender);
      if (score == null) continue;
      scores.push(score);
      if (score >= DEPTH_FLOOR) depth += 1;
      if (topScore == null || score > topScore) {
        topScore = score;
        topSwimmer = s.fullName;
      }
    }
    return {
      event,
      label: EVENT_LABELS[event],
      group,
      isRelayLeg: RELAY_EVENTS.includes(event),
      topScore,
      topSwimmer,
      medianScore: median(scores),
      scoredCount: scores.length,
      depth,
    };
  });

  const groups: GroupStrength[] = GROUPS.map((group) => {
    const groupEvents = events.filter((e) => e.group === group);
    const scores = groupEvents.map((e) => e.topScore).filter((v): v is number => v != null);
    const bestScore = scores.length ? Math.max(...scores) : null;
    const depth = Math.max(0, ...groupEvents.map((e) => e.depth));
    return { group, label: GROUP_LABELS[group], bestScore, depth, events: groupEvents };
  });

  const scoredCount = swimmers.filter((s) => s.times.some((t) => t.course === "SCY")).length;

  const strengths = [...events]
    .filter((e) => e.topScore != null)
    .sort((a, b) => (b.topScore ?? 0) - (a.topScore ?? 0))
    .slice(0, 5);

  const gaps = [...events]
    .filter((e) => e.topScore == null || e.depth === 0)
    .sort((a, b) => {
      if (a.isRelayLeg !== b.isRelayLeg) return a.isRelayLeg ? -1 : 1;
      return (a.topScore ?? 0) - (b.topScore ?? 0);
    })
    .slice(0, 6);

  return {
    course: "SCY",
    swimmerCount: swimmers.length,
    scoredCount,
    events,
    groups,
    strengths,
    gaps,
  };
}
