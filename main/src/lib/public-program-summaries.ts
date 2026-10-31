import "server-only";

import { createClient } from "@supabase/supabase-js";
import { cacheLife, cacheTag } from "next/cache";
import { ID_FILTER_CHUNK_SIZE } from "./paginated-query";
import { getSupabasePublicConfig } from "@/lib/env";
import { collectAllPages } from "@/lib/paginated-query";

const PUBLIC_PROGRAMS_TAG = "public-programs";
const PAGE_SIZE = 1_000;
const ID_CHUNK_SIZE = ID_FILTER_CHUNK_SIZE;

type QueryError = { message: string };
type PageResult<T> = { data: T[] | null; error: QueryError | null };

type ProgramRow = {
  id: string;
  institution_id: string;
  sport_code: string;
  gender: "men" | "women" | "coed";
  division: string | null;
  display_name: string | null;
};

type InstitutionRow = {
  id: string;
  canonical_name: string;
  city: string | null;
  state_code: string | null;
};

type MembershipRow = {
  athletic_program_id: string;
  conference_id: string;
  effective_from: string;
  effective_to: string | null;
};

type ConferenceRow = {
  id: string;
  name: string;
  short_name: string | null;
};

export type PublicSwimmingProgramSummary = {
  id: string;
  programName: string;
  city: string | null;
  stateCode: string | null;
  squad: "men" | "women" | "coed";
  division: string | null;
  conference: {
    name: string;
    shortName: string | null;
  } | null;
};

export type PublicProgramSummaryLoadResult =
  | { status: "ready"; programs: PublicSwimmingProgramSummary[] }
  | { status: "empty" | "unconfigured"; programs: [] }
  | { status: "error"; programs: []; message: string };

function chunks<T>(values: T[]): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += ID_CHUNK_SIZE) {
    result.push(values.slice(index, index + ID_CHUNK_SIZE));
  }
  return result;
}

async function collectPages<T>(
  operation: string,
  loadPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
): Promise<T[]> {
  const result = await collectAllPages<T, QueryError>(loadPage, PAGE_SIZE);
  if (result.error) throw new Error(`${operation}: ${result.error.message}`);
  return result.data;
}

async function collectByIdChunks<T>(
  ids: string[],
  operation: string,
  loadPage: (ids: string[], from: number, to: number) => PromiseLike<PageResult<T>>,
): Promise<T[]> {
  if (ids.length === 0) return [];
  const pages = await Promise.all(chunks(ids).map((idChunk) =>
    collectPages(operation, (from, to) => loadPage(idChunk, from, to))));
  return pages.flat();
}

function currentMembership(rows: MembershipRow[], asOf: string): MembershipRow | null {
  let current: MembershipRow | null = null;
  for (const row of rows) {
    if (row.effective_from > asOf || (row.effective_to !== null && row.effective_to < asOf)) continue;
    if (!current || row.effective_from > current.effective_from) current = row;
  }
  return current;
}

async function loadReadyProgramSummaries(): Promise<Exclude<PublicProgramSummaryLoadResult, { status: "error" }>> {
  "use cache";
  cacheLife("days");
  cacheTag(PUBLIC_PROGRAMS_TAG);

  const config = getSupabasePublicConfig();
  if (!config) return { status: "unconfigured", programs: [] };

  const supabase = createClient(config.url, config.publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });

  let programRows: ProgramRow[];
  try {
    programRows = await collectPages<ProgramRow>("athletic program summaries", (from, to) =>
      supabase
        .from("athletic_programs")
        .select("id,institution_id,sport_code,gender,division,display_name")
        .eq("active", true)
        .eq("visibility", "public")
        .ilike("sport_code", "%swim%")
        .order("id")
        .range(from, to));
  } catch {
    const legacyRows = await collectPages<Omit<ProgramRow, "display_name">>(
      "legacy athletic program summaries",
      (from, to) => supabase
        .from("athletic_programs")
        .select("id,institution_id,sport_code,gender,division")
        .eq("active", true)
        .eq("visibility", "public")
        .ilike("sport_code", "%swim%")
        .order("id")
        .range(from, to),
    );
    programRows = legacyRows.map((row) => ({ ...row, display_name: null }));
  }

  programRows = programRows.filter((row) => row.sport_code.toLocaleLowerCase().includes("swim"));
  if (programRows.length === 0) return { status: "empty", programs: [] };

  const institutionIds = [...new Set(programRows.map((row) => row.institution_id))];
  const programIds = programRows.map((row) => row.id);
  const [institutionRows, membershipRows] = await Promise.all([
    collectByIdChunks<InstitutionRow>(institutionIds, "program-summary institutions", (ids, from, to) =>
      supabase
        .from("institutions")
        .select("id,canonical_name,city,state_code")
        .in("id", ids)
        .eq("active", true)
        .eq("visibility", "public")
        .order("id")
        .range(from, to)),
    collectByIdChunks<MembershipRow>(programIds, "program-summary memberships", (ids, from, to) =>
      supabase
        .from("athletic_conference_memberships")
        .select("athletic_program_id,conference_id,effective_from,effective_to")
        .in("athletic_program_id", ids)
        .eq("visibility", "public")
        .order("athletic_program_id")
        .order("effective_from", { ascending: false })
        .range(from, to)),
  ]);

  const conferenceIds = [...new Set(membershipRows.map((row) => row.conference_id))];
  const conferenceRows = await collectByIdChunks<ConferenceRow>(
    conferenceIds,
    "program-summary conferences",
    (ids, from, to) => supabase
      .from("athletic_conferences")
      .select("id,name,short_name")
      .in("id", ids)
      .eq("visibility", "public")
      .order("id")
      .range(from, to),
  );

  const institutions = new Map(institutionRows.map((row) => [row.id, row]));
  const conferences = new Map(conferenceRows.map((row) => [row.id, row]));
  const memberships = new Map<string, MembershipRow[]>();
  for (const row of membershipRows) {
    const values = memberships.get(row.athletic_program_id);
    if (values) values.push(row);
    else memberships.set(row.athletic_program_id, [row]);
  }
  const asOf = new Date().toISOString().slice(0, 10);

  const programs = programRows.flatMap((program): PublicSwimmingProgramSummary[] => {
    const institution = institutions.get(program.institution_id);
    if (!institution) return [];
    const membership = currentMembership(memberships.get(program.id) ?? [], asOf);
    const conference = membership ? conferences.get(membership.conference_id) ?? null : null;
    return [{
      id: program.id,
      programName: program.display_name ?? institution.canonical_name,
      city: institution.city,
      stateCode: institution.state_code,
      squad: program.gender,
      division: program.division,
      conference: conference ? { name: conference.name, shortName: conference.short_name } : null,
    }];
  }).sort((left, right) =>
    left.programName.localeCompare(right.programName) || left.squad.localeCompare(right.squad));

  return programs.length > 0
    ? { status: "ready", programs }
    : { status: "empty", programs: [] };
}

export async function loadPublicSwimmingProgramSummaries(): Promise<PublicProgramSummaryLoadResult> {
  try {
    return await loadReadyProgramSummaries();
  } catch (error) {
    console.error("Unable to load public swimming program summaries", error);
    return {
      status: "error",
      programs: [],
      message: "The published program summaries could not be loaded.",
    };
  }
}
