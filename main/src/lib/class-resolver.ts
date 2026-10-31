import "server-only";

import { createClient } from "./supabase/server";
import { createAdminClient } from "./supabase/admin";
import { collectAllChunkedPages } from "./paginated-query";
import { getMember } from "./swims";
import {
  inferClass,
  isResolved,
  todaySighting,
  type ClassInference,
  type Sighting,
} from "./class-inference";


export type MemberSightingSeed = {
  memberId: string;
  fullName: string;
  gender: "M" | "F" | null;
  age: number | null;
  date: string | null;  
  lsc?: string | null;
  club?: string | null;
  meet?: string | null;
};

type CachedRow = { member_id: string; swim_age: number; swim_date: string; meet_name: string | null };

function isIso(d: string | null | undefined): d is string {
  return typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);
}

export async function recordSightings(seeds: MemberSightingSeed[]): Promise<void> {
  const rows = seeds
    .filter((s) => s.age != null && isIso(s.date))
    .map((s) => ({
      memberId: s.memberId,
      fullName: s.fullName,
      gender: s.gender ?? "",
      age: s.age,
      date: s.date,
      lsc: s.lsc ?? "",
      club: s.club ?? "",
      meet: s.meet ?? "",
    }));
  if (rows.length === 0) return;
  try {
    const admin = createAdminClient();
    await admin.rpc("record_swims_sightings", { p_rows: rows });
  } catch {
  }
}

function collectSightings(rows: CachedRow[]): Map<string, Sighting[]> {
  const out = new Map<string, Sighting[]>();
  for (const r of rows) {
    const list = out.get(r.member_id) ?? [];
    list.push({ age: r.swim_age, date: r.swim_date, meet: r.meet_name });
    out.set(r.member_id, list);
  }
  return out;
}

async function readCached(memberIds: string[]): Promise<Map<string, Sighting[]>> {
  if (memberIds.length === 0) return new Map();
  try {
    const supabase = await createClient();
    const result = await collectAllChunkedPages<string, CachedRow, unknown>(
      memberIds,
      (chunk, from, to) => supabase
        .rpc("get_swims_sightings_page", {
          p_member_ids: [...chunk],
          p_offset: from,
          p_limit: to - from + 1,
        }) as unknown as PromiseLike<{
          data: CachedRow[] | null;
          error: unknown | null;
        }>,
    );
    return result.error == null ? collectSightings(result.data) : new Map();
  } catch {
    return new Map();
  }
}

async function readCachedAsAdmin(memberIds: string[]): Promise<Map<string, Sighting[]>> {
  if (memberIds.length === 0) return new Map();
  try {
    const admin = createAdminClient();
    const result = await collectAllChunkedPages<string, CachedRow, unknown>(
      memberIds,
      (chunk, from, to) => admin
        .from("swims_member_sightings")
        .select("member_id, swim_age, swim_date, meet_name")
        .in("member_id", [...chunk])
        .order("member_id")
        .order("swim_date")
        .order("swim_age")
        .range(from, to) as unknown as PromiseLike<{
          data: CachedRow[] | null;
          error: unknown | null;
        }>,
    );
    return result.error == null ? collectSightings(result.data) : new Map();
  } catch {
    return new Map();
  }
}

export async function resolveClassesFromCache(memberIds: string[]): Promise<Map<string, ClassInference>> {
  const ids = [...new Set(memberIds)];
  const cached = await readCached(ids);
  const result = new Map<string, ClassInference>();
  for (const id of ids) {
    const inference = inferClass(cached.get(id) ?? []);
    if (inference) result.set(id, inference);
  }
  return result;
}

const FRESH_SIGHTING_DAYS = 21;

export type TodayAgeResult = {
  alreadyResolved: number;
  lookedUp: number;
  newlyResolved: number;
  failures: number;
};

export async function resolveTodayAges(
  memberIds: readonly string[],
  opts: { limit?: number; deadline?: number; today?: Date } = {},
): Promise<TodayAgeResult> {
  const ids = [...new Set(memberIds)].filter((id) => /^[A-Za-z0-9]{6,20}$/.test(id));
  const result: TodayAgeResult = { alreadyResolved: 0, lookedUp: 0, newlyResolved: 0, failures: 0 };
  if (ids.length === 0) return result;

  const today = opts.today ?? new Date();
  const freshFrom = new Date(today.getTime() - FRESH_SIGHTING_DAYS * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const cached = await readCachedAsAdmin(ids);

  const pending: string[] = [];
  for (const id of ids) {
    const sightings = cached.get(id) ?? [];
    if (isResolved(inferClass(sightings))) {
      result.alreadyResolved += 1;
      continue;
    }
    if (sightings.some((sighting) => sighting.date >= freshFrom)) continue;
    pending.push(id);
  }

  const limit = Math.max(0, opts.limit ?? 40);
  const seeds: MemberSightingSeed[] = [];
  for (const id of pending.slice(0, limit)) {
    if (opts.deadline != null && Date.now() > opts.deadline) break;
    result.lookedUp += 1;
    const member = await getMember(id, { allowStale: false, waitMs: 8_000, priority: 30 });
    if (!member || member.age == null) {
      result.failures += 1;
      continue;
    }
    const sighting = todaySighting(member.age, today);
    seeds.push({
      memberId: id,
      fullName: member.fullName,
      gender: null,
      age: member.age,
      date: sighting.date,
      lsc: member.lsc,
      club: member.club,
    });
    const improved = inferClass([...(cached.get(id) ?? []), sighting]);
    if (isResolved(improved)) result.newlyResolved += 1;
  }

  await recordSightings(seeds);
  return result;
}

export async function resolveClasses(
  seeds: MemberSightingSeed[],
  opts: { deepResolveLimit?: number } = {},
): Promise<Map<string, ClassInference>> {
  const memberIds = [...new Set(seeds.map((s) => s.memberId))];
  await recordSightings(seeds);

  const cached = await readCached(memberIds);

  const perMember = new Map<string, Sighting[]>();
  for (const id of memberIds) perMember.set(id, [...(cached.get(id) ?? [])]);
  for (const s of seeds) {
    if (s.age == null || !isIso(s.date)) continue;
    perMember.get(s.memberId)!.push({ age: s.age, date: s.date, meet: s.meet ?? null });
  }

  const result = new Map<string, ClassInference>();
  const needsDeep: string[] = [];
  for (const id of memberIds) {
    const inference = inferClass(perMember.get(id) ?? []);
    if (inference) result.set(id, inference);
    if (!inference || inference.confidence !== "exact") needsDeep.push(id);
  }

  const limit = opts.deepResolveLimit ?? 20;
  const toDeepen = needsDeep.slice(0, limit);
  const freshSeeds: MemberSightingSeed[] = [];
  await Promise.all(
    toDeepen.map(async (id) => {
      const member = await getMember(id);
      if (!member || member.age == null) return;
      const sighting = todaySighting(member.age);
      perMember.get(id)!.push({ age: sighting.age, date: sighting.date });
      freshSeeds.push({
        memberId: id,
        fullName: member.fullName,
        gender: null,
        age: member.age,
        date: sighting.date,
        lsc: member.lsc,
        club: member.club,
      });
      const improved = inferClass(perMember.get(id) ?? []);
      if (improved) result.set(id, improved);
    }),
  );
  await recordSightings(freshSeeds);

  return result;
}
