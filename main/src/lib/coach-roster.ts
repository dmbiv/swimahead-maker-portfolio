"use server";

import { revalidatePath } from "next/cache";
import { AuthorizationError, requireCoachWorkspace } from "./auth";
import { getCoachCollege } from "./coach-college";
import { createClient } from "./supabase/server";
import { getBestTimes } from "./swims";
import { findSwimsIdentity } from "./swims-identity";
import { parsePastedTimes } from "./paste";
import { performanceScore } from "./performance-points";
import { EVENT_GROUPS, canonicalEvent } from "./events";
import {
  normalizeRosterName,
  normalizeSwimCloudSwimmerUrl,
  parseRosterText,
  type RosterClassStanding,
} from "./roster-text";
import { type RosterMatchCandidate } from "./roster-swims-match";
import { rosterGenderForSquad } from "./roster-program";
import {
  isMissingRosterClassStanding,
  retryWithoutRosterClassStanding,
  rosterInsertErrorMessage,
} from "./roster-storage-errors";
import type { Course, Gender } from "./types";

export type RosterTime = {
  event: string;
  course: Course;
  seconds: number;
  score: number | null;
};

export type RosterSwimmer = {
  id: string;
  fullName: string;
  gender: Gender;
  classYear: number | null;
  classStanding: RosterClassStanding | null;
  swimcloudUrl: string | null;
  swimsMemberId: string | null;
  times: RosterTime[];
  topScore: number | null;
};

type SwimmerRow = {
  id: string;
  full_name: string;
  gender: Gender;
  class_year: number | null;
  class_standing: RosterClassStanding | null;
  swimcloud_url: string | null;
  swims_member_id: string | null;
};

type LegacySwimmerRow = Omit<SwimmerRow, "class_standing">;

type TimeRow = {
  roster_swimmer_id: string;
  event: string;
  course: Course;
  seconds: number;
};

type AddRosterSwimmerInput = {
  collegeId: string;
  fullName: string;
  classYear?: number | null;
  classStanding?: RosterClassStanding | null;
  swimcloudUrl?: string | null;
  swimsMemberId?: string | null;
  source: "manual" | "paste" | "swims" | "swimcloud";
  times: { event: string; course: Course; seconds: number; date?: string | null; meet?: string | null }[];
};

type InsertRosterSwimmerInput = AddRosterSwimmerInput & { gender: Gender };

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

async function requireRosterWriter() {
  const auth = await requireCoachWorkspace();
  if (auth.membership.role === "viewer") throw new AuthorizationError();
  return auth;
}

async function insertRosterSwimmer(
  input: InsertRosterSwimmerInput,
  auth: { workspaceId: string; userId: string; supabase: ServerSupabase },
): Promise<{ ok: boolean; id: string | null; error: string | null }> {
  const name = input.fullName.trim();
  if (name.length < 1 || name.length > 120) return { ok: false, id: null, error: "Enter a swimmer name." };
  if (input.gender !== "M" && input.gender !== "F") return { ok: false, id: null, error: "Pick a gender." };
  if (input.classStanding && !["FR", "SO", "JR", "SR", "GR"].includes(input.classStanding)) {
    return { ok: false, id: null, error: "Pick a valid roster class." };
  }
  if (input.swimsMemberId && !/^[A-Za-z0-9]{6,20}$/.test(input.swimsMemberId)) {
    return { ok: false, id: null, error: "Pick a valid USA Swimming match." };
  }
  const swimcloudUrl = input.swimcloudUrl
    ? normalizeSwimCloudSwimmerUrl(input.swimcloudUrl)
    : null;
  if (input.swimcloudUrl && !swimcloudUrl) {
    return { ok: false, id: null, error: "Enter a valid SwimCloud swimmer link." };
  }

  const baseRow = {
    workspace_id: auth.workspaceId,
    college_id: input.collegeId,
    full_name: name,
    gender: input.gender,
    class_year: input.classYear ?? null,
    swimcloud_url: swimcloudUrl,
    swims_member_id: input.swimsMemberId?.trim().toUpperCase() || null,
    source: input.source,
    created_by: auth.userId,
  };
  const insertResult = await retryWithoutRosterClassStanding(
    () => auth.supabase
      .from("coach_roster_swimmers")
      .insert({
        ...baseRow,
        class_standing: input.classStanding ?? null,
      })
      .select("id")
      .single(),
    () => auth.supabase
      .from("coach_roster_swimmers")
      .insert(baseRow)
      .select("id")
      .single(),
  );

  const { data: inserted, error: insertError } = insertResult;
  if (insertError || !inserted) {
    if (insertError) {
      console.error("Roster swimmer insert failed", {
        code: insertError.code,
        message: insertError.message,
      });
    }
    return { ok: false, id: null, error: rosterInsertErrorMessage(insertError, name) };
  }

  const rows = dedupeTimes(input.times, inserted.id, auth.workspaceId);
  if (rows.length > 0) {
    const { error: timesError } = await auth.supabase.from("coach_roster_times").insert(rows);
    if (timesError) {
      return { ok: true, id: inserted.id, error: "Swimmer added, but some times could not be saved." };
    }
  }
  return { ok: true, id: inserted.id, error: null };
}

export async function listRoster(collegeId: string): Promise<RosterSwimmer[]> {
  const { membership } = await requireCoachWorkspace();
  const supabase = await createClient();

  const [swimmerResult, { data: times }] = await Promise.all([
    supabase
      .from("coach_roster_swimmers")
      .select("id,full_name,gender,class_year,class_standing,swimcloud_url,swims_member_id")
      .eq("workspace_id", membership.workspaceId)
      .eq("college_id", collegeId)
      .order("full_name"),
    supabase
      .from("coach_roster_times")
      .select("roster_swimmer_id,event,course,seconds")
      .eq("workspace_id", membership.workspaceId),
  ]);

  let swimmers = (swimmerResult.data ?? []) as SwimmerRow[];
  if (isMissingRosterClassStanding(swimmerResult.error)) {
    const { data: legacySwimmers, error: legacyError } = await supabase
      .from("coach_roster_swimmers")
      .select("id,full_name,gender,class_year,swimcloud_url,swims_member_id")
      .eq("workspace_id", membership.workspaceId)
      .eq("college_id", collegeId)
      .order("full_name");
    if (legacyError) {
      console.error("Roster swimmer read failed", { code: legacyError.code, message: legacyError.message });
      swimmers = [];
    } else {
      swimmers = ((legacySwimmers ?? []) as LegacySwimmerRow[]).map((row) => ({
        ...row,
        class_standing: null,
      }));
    }
  } else if (swimmerResult.error) {
    console.error("Roster swimmer read failed", {
      code: swimmerResult.error.code,
      message: swimmerResult.error.message,
    });
    swimmers = [];
  }

  const timesBySwimmer = new Map<string, TimeRow[]>();
  for (const t of (times ?? []) as TimeRow[]) {
    const list = timesBySwimmer.get(t.roster_swimmer_id) ?? [];
    list.push(t);
    timesBySwimmer.set(t.roster_swimmer_id, list);
  }

  return ((swimmers ?? []) as SwimmerRow[]).map((s) => {
    const scored: RosterTime[] = (timesBySwimmer.get(s.id) ?? []).map((t) => ({
      event: t.event,
      course: t.course,
      seconds: Number(t.seconds),
      score: performanceScore({ event: t.event, course: t.course, seconds: Number(t.seconds) }, s.gender)?.value ?? null,
    }));
    scored.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
    return {
      id: s.id,
      fullName: s.full_name,
      gender: s.gender,
      classYear: s.class_year,
      classStanding: s.class_standing,
      swimcloudUrl: s.swimcloud_url,
      swimsMemberId: s.swims_member_id,
      times: scored,
      topScore: scored[0]?.score ?? null,
    };
  });
}

export async function addRosterSwimmer(
  input: AddRosterSwimmerInput,
): Promise<{ ok: boolean; id: string | null; error: string | null }> {
  const { context, membership } = await requireRosterWriter();
  const college = await getCoachCollege(membership, input.collegeId);
  if (!college) {
    return { ok: false, id: null, error: "Pick one of your programs." };
  }

  const supabase = await createClient();
  const result = await insertRosterSwimmer({
    ...input,
    gender: rosterGenderForSquad(college.squad),
  }, {
    workspaceId: membership.workspaceId,
    userId: context.userId,
    supabase,
  });
  revalidatePath("/c/roster");
  return result;
}

export async function addRosterSwimmerFromSwims(input: {
  collegeId: string;
  memberId: string;
  fullName: string;
  classYear?: number | null;
}): Promise<{ ok: boolean; id: string | null; error: string | null }> {
  const { membership } = await requireRosterWriter();
  const college = await getCoachCollege(membership, input.collegeId);
  if (!college) return { ok: false, id: null, error: "Pick one of your programs." };
  let parsed;
  try {
    parsed = await getBestTimes(input.memberId);
  } catch {
    return { ok: false, id: null, error: "Could not reach USA Swimming. Try again." };
  }
  return addRosterSwimmer({
    collegeId: input.collegeId,
    fullName: input.fullName,
    classYear: input.classYear ?? null,
    swimsMemberId: input.memberId,
    source: "swims",
    times: parsed.map((p) => ({ event: p.event, course: p.course, seconds: p.seconds, date: p.date, meet: p.meet })),
  });
}

export async function parseRosterPaste(text: string): Promise<{ event: string; course: Course; seconds: number }[]> {
  await requireCoachWorkspace();
  return parsePastedTimes(text)
    .map((s) => {
      const event = canonicalEvent(s.event, s.course) ?? s.event;
      return { event, course: s.course, seconds: s.seconds };
    })
    .filter((s) => EVENT_GROUPS[s.event as keyof typeof EVENT_GROUPS] !== undefined || /^\d/.test(s.event));
}

export type RosterSwimmerDraft = {
  fullName: string;
  classYear: number | null;
  classStanding: RosterClassStanding | null;
  hometown: string | null;
  swimcloudUrl: string | null;
  times: { event: string; course: Course; seconds: number }[];
  swimsMemberId: string | null;
};

export type ParsedRosterSwimmer = RosterSwimmerDraft & {
  isDiver: boolean;
  candidates: RosterMatchCandidate[];
};

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await fn(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

const ROSTER_MATCH_BUDGET_MS = 20_000;

export async function parseRosterBulk(text: string): Promise<ParsedRosterSwimmer[]> {
  await requireRosterWriter();
  const parsed = parseRosterText(text).slice(0, 100);
  const deadline = Date.now() + ROSTER_MATCH_BUDGET_MS;
  return mapWithConcurrency(parsed, 5, async (swimmer) => {
    if (swimmer.times.length > 0 || Date.now() > deadline) {
      return { ...swimmer, swimsMemberId: null, candidates: [] };
    }

    const resolution = await findSwimsIdentity(swimmer).catch(() => null);
    return {
      ...swimmer,
      swimsMemberId: resolution?.automaticMemberId ?? null,
      candidates: resolution?.candidates ?? [],
    };
  });
}

export async function addRosterBulk(input: {
  collegeId: string;
  swimmers: RosterSwimmerDraft[];
}): Promise<{ ok: boolean; added: number; enriched: number; nameOnly: number; skipped: number; error: string | null }> {
  const { context, membership } = await requireRosterWriter();
  const college = await getCoachCollege(membership, input.collegeId);
  if (!college) {
    return { ok: false, added: 0, enriched: 0, nameOnly: 0, skipped: 0, error: "Pick one of your programs." };
  }
  const gender = rosterGenderForSquad(college.squad);

  const supabase = await createClient();
  const { data: existingRows, error: existingError } = await supabase
    .from("coach_roster_swimmers")
    .select("full_name,swims_member_id")
    .eq("workspace_id", membership.workspaceId)
    .eq("college_id", input.collegeId);
  if (existingError) {
    console.error("Existing roster read failed", { code: existingError.code, message: existingError.message });
    return {
      ok: false,
      added: 0,
      enriched: 0,
      nameOnly: 0,
      skipped: 0,
      error: "Could not load the selected program's roster. Refresh the page and try again.",
    };
  }
  const existingNames = new Set(
    ((existingRows ?? []) as { full_name: string; swims_member_id: string | null }[])
      .map((row) => normalizeRosterName(row.full_name)),
  );
  const existingMembers = new Set(
    ((existingRows ?? []) as { full_name: string; swims_member_id: string | null }[])
      .map((row) => row.swims_member_id)
      .filter((value): value is string => Boolean(value)),
  );

  const timesDeadline = Date.now() + ROSTER_MATCH_BUDGET_MS;
  const prepared = await mapWithConcurrency(input.swimmers.slice(0, 100), 5, async (swimmer) => {
    if (!swimmer.swimsMemberId) {
      return {
        swimmer,
        times: swimmer.times,
        source: swimmer.swimcloudUrl ? "swimcloud" as const : "paste" as const,
      };
    }
    if (Date.now() > timesDeadline) {
      return { swimmer, times: swimmer.times, source: "swims" as const };
    }
    try {
      const times = await getBestTimes(swimmer.swimsMemberId);
      return { swimmer, times, source: "swims" as const };
    } catch {
      return { swimmer, times: [], source: "swims" as const };
    }
  });

  let added = 0;
  let enriched = 0;
  let nameOnly = 0;
  let skipped = 0;
  let duplicateCount = 0;
  let firstFailure: string | null = null;

  const insertable: typeof prepared = [];
  for (const entry of prepared) {
    const normalizedName = normalizeRosterName(entry.swimmer.fullName);
    if (!normalizedName) {
      skipped += 1;
      continue;
    }
    if (existingNames.has(normalizedName)
      || (entry.swimmer.swimsMemberId && existingMembers.has(entry.swimmer.swimsMemberId))) {
      skipped += 1;
      duplicateCount += 1;
      continue;
    }
    existingNames.add(normalizedName);
    if (entry.swimmer.swimsMemberId) existingMembers.add(entry.swimmer.swimsMemberId);
    insertable.push(entry);
  }

  const results = await mapWithConcurrency(insertable, 5, ({ swimmer, times, source }) =>
    insertRosterSwimmer({
      collegeId: input.collegeId,
      fullName: swimmer.fullName,
      gender,
      classYear: swimmer.classYear,
      classStanding: swimmer.classStanding,
      swimcloudUrl: swimmer.swimcloudUrl,
      swimsMemberId: swimmer.swimsMemberId,
      source,
      times,
    }, {
      workspaceId: membership.workspaceId,
      userId: context.userId,
      supabase,
    }));

  results.forEach((res, index) => {
    if (res.ok) {
      added += 1;
      if (insertable[index].times.length > 0) enriched += 1;
      else nameOnly += 1;
    } else {
      skipped += 1;
      firstFailure ??= res.error;
    }
  });
  revalidatePath("/c/roster");
  return {
    ok: added > 0,
    added,
    enriched,
    nameOnly,
    skipped,
    error: added === 0
      ? firstFailure
        ?? (duplicateCount > 0
          ? "Every swimmer in this paste is already on the selected program's roster."
          : "No valid swimmers were available to import.")
      : null,
  };
}

export async function clearRoster(collegeId: string): Promise<{ ok: boolean; removed: number; error: string | null }> {
  const { membership } = await requireRosterWriter();
  const college = await getCoachCollege(membership, collegeId);
  if (!college) return { ok: false, removed: 0, error: "Pick one of your programs." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("coach_roster_swimmers")
    .delete()
    .eq("workspace_id", membership.workspaceId)
    .eq("college_id", collegeId)
    .select("id");
  if (error) {
    console.error("Roster clear failed", { code: error.code, message: error.message });
    return { ok: false, removed: 0, error: "Could not clear the roster. Try again." };
  }
  revalidatePath("/c/roster");
  return { ok: true, removed: (data ?? []).length, error: null };
}

export async function removeRosterSwimmer(id: string): Promise<{ ok: boolean; error: string | null }> {
  const { membership } = await requireRosterWriter();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("coach_roster_swimmers")
    .delete()
    .eq("id", id)
    .eq("workspace_id", membership.workspaceId)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    return { ok: false, error: "Couldn’t remove that swimmer. The roster was restored." };
  }
  revalidatePath("/c/roster");
  return { ok: true, error: null };
}

function dedupeTimes(
  times: { event: string; course: Course; seconds: number; date?: string | null; meet?: string | null }[],
  swimmerId: string,
  workspaceId: string,
) {
  const best = new Map<string, { event: string; course: Course; seconds: number; date: string | null; meet: string }>();
  for (const t of times) {
    if (!Number.isFinite(t.seconds) || t.seconds <= 0) continue;
    const event = canonicalEvent(t.event, t.course) ?? t.event.toUpperCase();
    const key = `${event}|${t.course}`;
    const existing = best.get(key);
    if (!existing || t.seconds < existing.seconds) {
      best.set(key, { event, course: t.course, seconds: t.seconds, date: t.date ?? null, meet: (t.meet ?? "").slice(0, 200) });
    }
  }
  return [...best.values()].map((t) => ({
    roster_swimmer_id: swimmerId,
    workspace_id: workspaceId,
    event: t.event,
    course: t.course,
    seconds: t.seconds,
    swum_on: t.date,
    meet: t.meet,
  }));
}
