import "server-only";

import type { Course, SwimsMember } from "./types";
import { parseClock } from "./time";
import type { ParsedSwim } from "./paste";
import { prospectPoolSlices } from "./swims-pool";
import { requestSwims, type RequestSwimsOptions } from "./swims-gateway";
import { SwimsError } from "./swims-gateway-core";
export { SwimsError, SwimsPendingError, SwimsRateLimitError } from "./swims-gateway-core";



interface RawMember {
  memberId: string;
  fullName: string;
  shortName: string;
  clubName: string | null;
  lscCode: string | null;
  swimmerAge: number | null;
  profilePicUrl: string | null;
  isNcaa: number;
}

export async function searchMembers(
  name: string,
  opts: { lscCode?: string | null; orgCode?: string | null; currentOnly?: boolean } = {},
): Promise<SwimsMember[]> {
  const clean = name.trim().replace(/\s+/g, " ").slice(0, 80);
  if (clean.length < 2) return [];
  const rows = await requestSwims<RawMember[]>({
    kind: "member_search",
    name: clean,
    orgCode: opts.orgCode?.trim().toUpperCase() || null,
    lscCode: opts.lscCode?.trim().toUpperCase() || null,
    currentOnly: opts.currentOnly === true,
  });
  if (!Array.isArray(rows)) return [];
  return rows.map((r) => ({
    memberId: r.memberId,
    fullName: r.fullName,
    shortName: r.shortName || r.fullName,
    club: r.clubName ?? "",
    lsc: r.lscCode ?? "",
    age: r.swimmerAge ?? null,
    isNcaa: r.isNcaa === 1,
  }));
}

export async function getMember(
  memberId: string,
  options: RequestSwimsOptions = {},
): Promise<SwimsMember | null> {
  const id = memberId.trim().toUpperCase();
  if (!/^[A-Za-z0-9]{6,20}$/.test(id)) return null;
  try {
    const r = await requestSwims<RawMember | null>({ kind: "member", memberId: id }, options);
    if (!r || typeof r !== "object" || !("memberId" in r)) return null;
    return {
      memberId: r.memberId,
      fullName: r.fullName,
      shortName: r.shortName || r.fullName,
      club: r.clubName ?? "",
      lsc: r.lscCode ?? "",
      age: r.swimmerAge ?? null,
      isNcaa: r.isNcaa === 1,
    };
  } catch {
    return null;
  }
}

export const SWIMS_RESOLUTION_SEASONS = [155, 154, 153] as const;


interface RawBestTime {
  strokeAbbreviation: string;  
  distance: number;
  courseCode: string;  
  swimTime: string;  
  swimTimeRecognitionId?: number;
}

function toEventCode(distance: number, stroke: string): string | null {
  const s = stroke.toUpperCase();
  const map: Record<string, string> = { FR: "FR", BK: "BK", BR: "BR", FL: "FL", IM: "IM" };
  const code = map[s];
  if (!code) return null;
  return `${distance}${code}`;
}

function toCourse(courseCode: string): Course | null {
  const c = courseCode.toUpperCase();
  return c === "SCY" || c === "SCM" || c === "LCM" ? c : null;
}

export async function getBestTimes(
  memberId: string,
  options: RequestSwimsOptions = {},
): Promise<ParsedSwim[]> {
  const id = memberId.trim().toUpperCase();
  if (!/^[A-Z0-9]{6,20}$/i.test(id)) return [];
  const rows = await requestSwims<RawBestTime[]>({ kind: "best_times", memberId: id }, options);
  if (!Array.isArray(rows)) return [];
  const out: ParsedSwim[] = [];
  for (const r of rows) {
    const course = toCourse(r.courseCode);
    const event = toEventCode(r.distance, r.strokeAbbreviation);
    if (!course || !event) continue;
    const isRelayLead = /r\s*$/i.test(r.swimTime);
    const seconds = parseClock(r.swimTime.replace(/[a-z]\s*$/i, ""));
    if (seconds == null) continue;
    out.push({
      event,
      course,
      seconds,
      clock: r.swimTime,
      date: null,  
      meet: isRelayLead ? "USA Swimming (relay lead-off)" : "USA Swimming",
    });
  }
  return out;
}


interface RawTopTime {
  eventRank: number;
  memberId: string;
  fullName: string;
  lscCode: string | null;
  clubName: string | null;
  clubCode: string | null;
  powerPoints: number | null;
  swimTime: string;
  swimmerAge: number | null;
  meetId: number | string | null;
  meetName: string | null;
  swimDate: string | null;
}

export interface SwimsProspect {
  rank: number;
  memberId: string;
  fullName: string;
  lsc: string;
  club: string;
  clubCode: string | null;
  age: number | null;
  powerPoints: number | null;
  time: string;
  seconds: number | null;
  meetId: string | null;
  meet: string | null;
  swimDate: string | null;
}

export interface TopTimesQuery {
  eventId: number;
  gender: "M" | "F";
  course?: Course;
  seasonKey?: number;  
  minAge?: number | null;
  maxAge?: number | null;
  lscCode?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}

export async function topTimes(
  q: TopTimesQuery,
  options: RequestSwimsOptions = {},
): Promise<SwimsProspect[]> {
  const request = {
    kind: "top_times" as const,
    course: q.course ?? "SCY",
    eventId: q.eventId,
    gender: q.gender,
    seasonKey: q.seasonKey ?? 155,
    minAge: q.minAge ?? null,
    maxAge: q.maxAge ?? null,
    lscCode: q.lscCode?.trim().toUpperCase() || null,
    startDate: q.startDate ?? null,
    endDate: q.endDate ?? null,
  };
  const rows = await requestSwims<RawTopTime[]>(request, options);
  if (!Array.isArray(rows)) return [];
  return rows.map((r) => ({
    rank: r.eventRank,
    memberId: r.memberId,
    fullName: r.fullName,
    lsc: r.lscCode ?? "",
    club: r.clubName ?? "",
    clubCode: r.clubCode?.trim().toUpperCase() || null,
    age: r.swimmerAge ?? null,
    powerPoints: r.powerPoints ?? null,
    time: r.swimTime,
    seconds: parseClock(r.swimTime.replace(/[a-z]\s*$/i, "")),
    meetId: r.meetId == null ? null : String(r.meetId),
    meet: r.meetName,
    swimDate: r.swimDate ? r.swimDate.slice(0, 10) : null,
  }));
}

async function mapWithConcurrency<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let index = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = index++;
      results[current] = await fn(items[current]);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function topTimesDeep(q: {
  eventId: number;
  gender: "M" | "F";
  age: number;
  seasonKey?: number;
  lscCodes?: readonly string[];
  nearLscCodes?: readonly string[];
}): Promise<SwimsProspect[]> {
  const base: Omit<TopTimesQuery, "lscCode"> = {
    eventId: q.eventId,
    gender: q.gender,
    seasonKey: q.seasonKey ?? 155,
    minAge: q.age,
    maxAge: q.age,
  };
  const slices = prospectPoolSlices(q.lscCodes, q.nearLscCodes);
  const batches = await mapWithConcurrency(slices, 6, async (lscCode) => {
    try {
      const prospects = await cachedTopTimesSlice(
        base.eventId,
        base.gender,
        base.seasonKey ?? 155,
        q.age,
        lscCode ?? "",
      );
      return { ok: true, prospects };
    } catch {
      return { ok: false, prospects: [] as SwimsProspect[] };
    }
  });

  if (!batches.some((batch) => batch.ok)) {
    throw new SwimsError("Every SWIMS leaderboard slice failed", 503);
  }

  const best = new Map<string, SwimsProspect>();
  for (const batch of batches) {
    for (const p of batch.prospects) {
      const prior = best.get(p.memberId);
      if (!prior || (p.seconds ?? Infinity) < (prior.seconds ?? Infinity)) best.set(p.memberId, p);
    }
  }
  return [...best.values()].sort((left, right) => (left.seconds ?? Infinity) - (right.seconds ?? Infinity));
}

async function cachedTopTimesSlice(
  eventId: number,
  gender: "M" | "F",
  seasonKey: number,
  age: number,
  lscCode: string,
): Promise<SwimsProspect[]> {
  return topTimes({
    eventId,
    gender,
    seasonKey,
    minAge: age,
    maxAge: age,
    lscCode: lscCode || null,
  });
}

export const SWIMS_EVENT_IDS: Record<string, number> = {
  "50FR": 1, "100FR": 2, "200FR": 3, "500FR": 4, "1000FR": 5, "1650FR": 6,
  "100BK": 12, "200BK": 13, "100BR": 15, "200BR": 16, "100FL": 18, "200FL": 19,
  "200IM": 21, "400IM": 22,
};

export interface SwimsLookup {
  member: SwimsMember;
  times: ParsedSwim[];
}

export async function lookupMember(memberId: string): Promise<ParsedSwim[]> {
  return getBestTimes(memberId);
}
