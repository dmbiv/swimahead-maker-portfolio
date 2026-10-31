"use server";

import { createClient } from "./supabase/server";
import { requireAccountType } from "./auth";
import { getBestTimes, searchMembers } from "./swims";
import { KNOWN_EVENTS } from "./events";
import { persistSwimmerProgramStatus, removeSwimmerProgramStatus } from "./swimmer-program-status-mutations";
import { revalidateSwimmerViews } from "./swimmer-view-revalidation";
import type { Course, SwimsMember } from "./types";
import type { ParsedSwim } from "./paste";

async function swimmerUserContext() {
  const [auth, supabase] = await Promise.all([
    requireAccountType("swimmer", "/s"),
    createClient(),
  ]);
  return { userId: auth.userId, supabase };
}

async function swimmerContext() {
  const { userId, supabase } = await swimmerUserContext();
  const { data } = await supabase
    .from("swimmers")
    .select("id")
    .eq("owner_user_id", userId)
    .maybeSingle();
  return { userId, supabase, swimmerId: data?.id as string | undefined };
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizedProgramIds(programIds: unknown): string[] {
  if (!Array.isArray(programIds)) return [];
  return [...new Set(programIds
    .filter((id): id is string => typeof id === "string")
    .map((id) => id.trim())
    .filter((id) => UUID_PATTERN.test(id)))].slice(0, 2_000);
}

function batches<T>(values: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

async function mapConcurrent<T, Result>(
  values: T[],
  concurrency: number,
  operation: (value: T) => PromiseLike<Result>,
): Promise<Result[]> {
  const results = new Array<Result>(values.length);
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await operation(values[index]);
    }
  };
  await Promise.all(Array.from(
    { length: Math.min(concurrency, values.length) },
    worker,
  ));
  return results;
}


export async function setCollegeStatus(athleticProgramId: string, status: "saved" | "ruled_out", reason = "") {
  const result = await persistSwimmerProgramStatus(athleticProgramId, status, reason);
  if (result.ok) revalidateSwimmerViews();
  return result;
}

export async function clearCollegeStatus(athleticProgramId: string) {
  const result = await removeSwimmerProgramStatus(athleticProgramId);
  if (result.ok) revalidateSwimmerViews();
  return result;
}

export async function clearCollegeStatuses(status: "saved" | "ruled_out") {
  const { userId, supabase } = await swimmerUserContext();
  const { error, count } = await supabase
    .from("swimmer_college_status")
    .delete({ count: "exact" })
    .eq("swimmer_user_id", userId)
    .eq("status", status);
  revalidateSwimmerViews();
  return { ok: !error, count: count ?? 0, error: error?.message ?? null };
}

export async function ruleOutMany(athleticProgramIds: string[], reason: string) {
  const { userId, supabase } = await swimmerUserContext();
  const requestedIds = normalizedProgramIds(athleticProgramIds);
  if (requestedIds.length === 0) return { ok: true, count: 0, error: null };
  const safeReason = typeof reason === "string" ? reason.slice(0, 300) : "";

  const requestedBatches = batches(requestedIds, 100);
  const [validationResults, savedResults] = await Promise.all([
    mapConcurrent(requestedBatches, 6, (ids) =>
      supabase
        .from("athletic_programs")
        .select("id,sport_code")
        .in("id", ids)
        .eq("active", true)
        .eq("visibility", "public")),
    mapConcurrent(requestedBatches, 6, (ids) =>
      supabase
        .from("swimmer_college_status")
        .select("athletic_program_id")
        .eq("swimmer_user_id", userId)
        .eq("status", "saved")
        .in("athletic_program_id", ids)),
  ]);

  const validatedIds: string[] = [];
  for (const { data, error } of validationResults) {
    if (error) return { ok: false, count: 0, error: error.message };
    validatedIds.push(...(data ?? [])
      .filter((program) => program.sport_code.toLocaleLowerCase().includes("swim"))
      .map((program) => program.id));
  }

  const savedIds = new Set<string>();
  for (const { data, error } of savedResults) {
    if (error) return { ok: false, count: 0, error: error.message };
    for (const row of data ?? []) savedIds.add(row.athletic_program_id);
  }

  const rows = validatedIds.filter((programId) => !savedIds.has(programId)).map((athletic_program_id) => ({
    swimmer_user_id: userId,
    athletic_program_id,
    status: "ruled_out" as const,
    reason: safeReason,
  }));
  if (rows.length === 0) return { ok: true, count: 0 };
  const { error } = await supabase
    .from("swimmer_college_status")
    .upsert(rows, { onConflict: "swimmer_user_id,athletic_program_id" });
  if (!error) revalidateSwimmerViews();
  return { ok: !error, count: rows.length, error: error?.message ?? null };
}


export async function saveExclusionRule(kind: string, config: Record<string, unknown>) {
  const { userId, supabase } = await swimmerUserContext();
  const { error } = await supabase
    .from("swimmer_exclusion_rules")
    .insert({ swimmer_user_id: userId, kind, config });
  revalidateSwimmerViews();
  return { ok: !error, error: error?.message ?? null };
}

export async function deleteExclusionRule(id: string) {
  const { userId, supabase } = await swimmerUserContext();
  await supabase.from("swimmer_exclusion_rules").delete().eq("id", id).eq("swimmer_user_id", userId);
  revalidateSwimmerViews();
  return { ok: true };
}


export async function findSwimmerByName(name: string, lscCode?: string): Promise<{ ok: boolean; members: SwimsMember[]; error: string | null }> {
  await requireAccountType("swimmer", "/s/times");
  try {
    const members = await searchMembers(name, { lscCode: lscCode || null });
    return { ok: true, members: members.slice(0, 40), error: null };
  } catch {
    return { ok: false, members: [], error: "USA Swimming search is unavailable. Try again." };
  }
}

export async function previewOfficialTimes(memberId: string): Promise<{ ok: boolean; swims: ParsedSwim[]; error: string | null }> {
  await requireAccountType("swimmer", "/s/times");
  try {
    const swims = await getBestTimes(memberId);
    if (swims.length === 0) return { ok: false, swims: [], error: "No official times found." };
    return { ok: true, swims, error: null };
  } catch {
    return { ok: false, swims: [], error: "Couldn't reach USA Swimming." };
  }
}

export async function updateMyProfile(patch: {
  firstName?: string; lastName?: string; gradYear?: number; club?: string; city?: string;
  state?: string; email?: string; phone?: string; gpa?: number; sat?: number | null; act?: number | null;
  maxAnnualCost?: number | null; majors?: string[]; bio?: string; videoUrl?: string;
}) {
  const { supabase, swimmerId } = await swimmerContext();
  if (!swimmerId) return { ok: false };
  const row: Record<string, unknown> = {};
  if (patch.firstName != null) row.first_name = patch.firstName.slice(0, 120);
  if (patch.lastName != null) row.last_name = patch.lastName.slice(0, 120);
  if (patch.gradYear != null && Number.isFinite(patch.gradYear)) row.grad_year = patch.gradYear;
  if (patch.club != null) row.club = patch.club.slice(0, 160);
  if (patch.city != null) row.city = patch.city.slice(0, 120);
  if (patch.state != null) row.state = patch.state.slice(0, 2).toUpperCase();
  if (patch.email != null) row.email = patch.email.slice(0, 320);
  if (patch.phone != null) row.phone = patch.phone.slice(0, 40);
  if (patch.gpa != null && Number.isFinite(patch.gpa)) row.gpa = Math.max(0, Math.min(4.5, patch.gpa));
  if (patch.sat !== undefined) row.sat = patch.sat == null || !Number.isFinite(patch.sat) ? null : Math.round(patch.sat);
  if (patch.act !== undefined) row.act = patch.act == null || !Number.isFinite(patch.act) ? null : Math.round(patch.act);
  if (patch.maxAnnualCost !== undefined) row.max_annual_cost = patch.maxAnnualCost == null || !Number.isFinite(patch.maxAnnualCost) ? null : Math.round(patch.maxAnnualCost);
  if (Array.isArray(patch.majors)) row.majors = patch.majors.map((m) => m.slice(0, 80)).filter(Boolean).slice(0, 6);
  if (patch.bio != null) row.bio = patch.bio.slice(0, 2000);
  if (patch.videoUrl != null) row.video_url = patch.videoUrl.slice(0, 500);
  const { error } = await supabase.from("swimmers").update(row).eq("id", swimmerId);
  revalidateSwimmerViews(["/s/profile", "/s/plan"]);
  return { ok: !error };
}

export async function deleteSwimTime(id: string) {
  const { supabase, swimmerId } = await swimmerContext();
  if (!swimmerId) return { ok: false, error: "Finish account setup first." };
  const { error } = await supabase.from("swim_times").delete().eq("id", id).eq("swimmer_id", swimmerId);
  revalidateSwimmerViews(["/s/times", "/s/outreach"]);
  return { ok: !error, error: error?.message ?? null };
}

export async function addSwimTime(input: {
  event: string;
  course: Course;
  seconds: number;
  date: string;
  meet: string;
}) {
  const { supabase, swimmerId } = await swimmerContext();
  if (!swimmerId) return { ok: false, error: "Finish account setup first." };

  const event = input.event.trim().toUpperCase();
  const course = input.course;
  const seconds = Number(input.seconds);
  const meet = input.meet.trim();
  if (!KNOWN_EVENTS.includes(event) || !(["SCY", "SCM", "LCM"] as string[]).includes(course)) {
    return { ok: false, error: "Choose a supported event and course." };
  }
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds >= 3600) {
    return { ok: false, error: "Enter a valid swim time." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || Number.isNaN(Date.parse(`${input.date}T12:00:00Z`))) {
    return { ok: false, error: "Choose a valid meet date." };
  }

  const { error } = await supabase.from("swim_times").insert({
    id: crypto.randomUUID(),
    swimmer_id: swimmerId,
    event,
    course,
    seconds: Math.round(seconds * 100) / 100,
    date: input.date,
    meet: meet.slice(0, 180) || "Meet not specified",
    source: "manual",
    proof_url: null,
  });
  revalidateSwimmerViews(["/s/times", "/s/outreach"]);
  return { ok: !error, error: error?.message ?? null };
}

export async function importOfficialTimes(memberId: string) {
  const { supabase, swimmerId } = await swimmerContext();
  if (!swimmerId) return { ok: false, count: 0, error: "Finish account setup first." };
  let swims: ParsedSwim[];
  try {
    swims = await getBestTimes(memberId, {
      forceRefresh: true,
      allowStale: true,
      waitMs: 5_000,
      priority: 25,
    });
  } catch {
    return { ok: false, count: 0, error: "Couldn't reach USA Swimming." };
  }
  if (swims.length === 0) return { ok: false, count: 0, error: "No official times found." };

  const byEvent = new Map<string, ParsedSwim>();
  for (const s of swims) {
    const key = `${s.event}|${s.course}`;
    const prev = byEvent.get(key);
    if (!prev || s.seconds < prev.seconds) byEvent.set(key, s);
  }
  const candidates = [...byEvent.values()].map((s) => ({
    id: crypto.randomUUID(),
    swimmer_id: swimmerId,
    event: s.event,
    course: s.course,
    seconds: s.seconds,
    date: s.date ?? new Date().toISOString().slice(0, 10),
    meet: s.meet ?? "USA Swimming",
    source: "swims",
    proof_url: null,
  }));
  const { data: existing, error: existingError } = await supabase
    .from("swim_times")
    .select("event,course,seconds,date,meet,source")
    .eq("swimmer_id", swimmerId)
    .eq("source", "swims");
  if (existingError) return { ok: false, count: 0, error: existingError.message };
  const historyKey = (row: { event: string; course: string; seconds: number | string; date: string; meet: string; source: string }) =>
    [row.event.trim().toUpperCase(), row.course, Number(row.seconds).toFixed(2), row.date, row.meet.trim(), row.source].join("|");
  const existingKeys = new Set((existing ?? []).map(historyKey));
  const rows = candidates.filter((row) => !existingKeys.has(historyKey(row)));

  if (rows.length > 0) {
    const { error } = await supabase.from("swim_times").insert(rows);
    if (error) return { ok: false, count: 0, error: error.message };
  }

  await supabase.from("swimmers").update({ swims_member_id: memberId.trim().toUpperCase() }).eq("id", swimmerId);
  revalidateSwimmerViews(["/s/times", "/s/outreach"]);
  return { ok: true, count: rows.length, error: null };
}
