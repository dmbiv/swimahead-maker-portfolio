import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig } from "./env";
import { selectPreferredBenchmarkDatasets } from "./fit-benchmark-selection";
import {
  CHAMPIONSHIP_PARTICIPANT_PUBLIC_COLUMNS,
  CHAMPIONSHIP_RELEASE_PUBLIC_COLUMNS,
  CONFERENCE_FIT_BENCHMARK_PUBLIC_COLUMNS,
  PUBLIC_PROGRAMS_TAG,
  buildCipFilterOptions,
  controlLabel,
  isSwimmingSportCode,
  netPriceForControl,
  normalizeBenchmarkEvent,
  selectCurrentMembership,
  type PublicCipFilterOption,
  type PublicProgramFitBenchmark,
  type PublicProgramFitMode,
  type PublicProgramLoadResult,
  type PublicProgramStrength,
  type PublicSwimmingProgram,
} from "./public-programs";
import { ID_FILTER_CHUNK_SIZE } from "./paginated-query";
import { EVENT_ORDER } from "./events";
import type { EventCode } from "./types";

const PAGE_SIZE = 1_000;
const MAX_PAGES = 200;
const ID_CHUNK_SIZE = ID_FILTER_CHUNK_SIZE;
const QUERY_CONCURRENCY = 4;
const BACHELORS_CREDENTIAL_LEVEL = 3;

type QueryError = { message: string };
type PageResult<T> = { data: T[] | null; error: QueryError | null };

type ProgramRow = {
  id: string;
  institution_id: string;
  sport_code: string;
  gender: "men" | "women" | "coed";
  governing_body: string;
  division: string | null;
  external_code: string;
  display_name: string | null;
};

type InstitutionRow = {
  id: string;
  canonical_name: string;
  city: string | null;
  state_code: string | null;
  country_code: string;
  website_url: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
};

type LegacyFactRow = {
  institution_id: string;
  control_code: number | null;
  undergraduate_enrollment: number | null;
  admission_rate: number | string | null;
  public_net_price: number | null;
  private_net_price: number | null;
};

type FactRow = LegacyFactRow & {
  sat_median: number | null;
  sat_percentile_25: number | null;
  sat_percentile_75: number | null;
  act_median: number | null;
  act_percentile_25: number | null;
  act_percentile_75: number | null;
};

type CipRow = {
  institution_id: string;
  cip_code: string;
  cip_title: string;
};

type MembershipRow = {
  athletic_program_id: string;
  conference_id: string;
  effective_from: string;
  effective_to: string | null;
  evidence_url: string;
  verified_at: string;
};

type ConferenceRow = {
  id: string;
  name: string;
  short_name: string | null;
  website_url: string | null;
};

type LinkRow = {
  id: string;
  athletic_program_id: string;
  link_type: PublicSwimmingProgram["verifiedLinks"][number]["type"];
  url: string;
};

type LegacyFitRow = {
  id: string;
  athletic_program_id: string;
  source_snapshot_id: string;
  event_code: string;
  gender: "men" | "women";
  course: "SCY" | "SCM" | "LCM";
  benchmark_scope: "conference_score" | "conference_place" | "program_rank";
  rank_cutoff: number | null;
  time_ms: number;
  season_label: string;
  sample_size: number | null;
  derivation_method: string;
  derivation_version: string;
  evidence_url: string;
  calculated_at: string;
};

type ReleaseRow = {
  id: string;
  conference_id: string;
  source_snapshot_id: string;
  season_label: string;
  gender: "men" | "women";
  course: "SCY" | "SCM" | "LCM";
  meet_name: string;
  meet_date: string;
  state: "published";
  published_at: string;
};

type ConferenceFitRow = {
  id: string;
  release_id: string;
  conference_id: string;
  season_label: string;
  event_code: string;
  gender: "men" | "women";
  course: "SCY" | "SCM" | "LCM";
  benchmark_scope: "conference_score" | "conference_place";
  rank_cutoff: number | null;
  time_ms: number;
  sample_size: number | null;
  derivation_method: string;
  derivation_version: string;
  evidence_url: string;
  calculated_at: string;
};

type ParticipantRow = {
  release_id: string;
  athletic_program_id: string;
  competed: boolean;
};

type ProgramGenderRow = Pick<ProgramRow, "id" | "gender">;

type DirectoryCoreResult =
  | {
      status: "ready";
      programs: ProgramRow[];
      institutions: InstitutionRow[];
      facts: FactRow[];
      memberships: MembershipRow[];
      conferences: ConferenceRow[];
      links: LinkRow[];
      asOf: string;
    }
  | { status: "empty" | "unconfigured" };

export type PublicFitSummary = {
  datasetReady: boolean;
  coveredConferenceCount: number;
};

export type PublicProgramFitResult =
  | { status: "ready"; benchmarksByProgram: Record<string, PublicProgramFitBenchmark[]> }
  | { status: "unconfigured" | "error"; benchmarksByProgram: Record<string, never[]> };

export type PublicSwimmingStrengthResult = {
  scores: Record<string, PublicProgramStrength>;
  coveredProgramCount: number;
};

function publicClient() {
  const config = getSupabasePublicConfig();
  if (!config) return null;
  return createClient(config.url, config.publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}

async function collectPages<T>(
  operation: string,
  loadPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const from = page * PAGE_SIZE;
    const result = await loadPage(from, from + PAGE_SIZE - 1);
    if (result.error) throw new Error(`${operation}: ${result.error.message}`);
    const pageRows = result.data ?? [];
    rows.push(...pageRows);
    if (pageRows.length < PAGE_SIZE) return rows;
  }
  throw new Error(`${operation}: exceeded pagination safety limit`);
}

async function collectPagesInBatches<T>(
  operation: string,
  loadPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let firstPage = 0; firstPage < MAX_PAGES; firstPage += QUERY_CONCURRENCY) {
    const pages = Array.from({ length: QUERY_CONCURRENCY }, (_, index) => firstPage + index)
      .filter((page) => page < MAX_PAGES);
    const results = await Promise.all(pages.map(async (page) => {
      const from = page * PAGE_SIZE;
      const result = await loadPage(from, from + PAGE_SIZE - 1);
      if (result.error) throw new Error(`${operation}: ${result.error.message}`);
      return result.data ?? [];
    }));
    for (const pageRows of results) {
      rows.push(...pageRows);
      if (pageRows.length < PAGE_SIZE) return rows;
    }
  }
  throw new Error(`${operation}: exceeded pagination safety limit`);
}

function chunks<T>(items: T[]): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += ID_CHUNK_SIZE) {
    result.push(items.slice(index, index + ID_CHUNK_SIZE));
  }
  return result;
}

async function collectByIdChunks<T>(
  ids: string[],
  operation: string,
  loadPage: (ids: string[], from: number, to: number) => PromiseLike<PageResult<T>>,
): Promise<T[]> {
  if (ids.length === 0) return [];
  const rows: T[] = [];
  const idChunks = chunks(ids);
  for (let index = 0; index < idChunks.length; index += QUERY_CONCURRENCY) {
    const batch = idChunks.slice(index, index + QUERY_CONCURRENCY);
    const loaded = await Promise.all(batch.map((idsForQuery) =>
      collectPages(operation, (from, to) => loadPage(idsForQuery, from, to))));
    for (const chunkRows of loaded) rows.push(...chunkRows);
  }
  return rows;
}

function groupedBy<T>(rows: T[], keyFor: (row: T) => string): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const key = keyFor(row);
    const group = grouped.get(key);
    if (group) group.push(row);
    else grouped.set(key, [row]);
  }
  return grouped;
}

function nullableNumber(value: number | string | null): number | null {
  if (value === null) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function isMissingRelation(error: unknown, relation: string): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLocaleLowerCase();
  return message.includes(relation.toLocaleLowerCase()) && (
    message.includes("does not exist")
    || message.includes("could not find the table")
    || message.includes("schema cache")
  );
}

async function loadDirectoryCore(): Promise<DirectoryCoreResult> {
  "use cache";
  cacheLife("days");
  cacheTag(PUBLIC_PROGRAMS_TAG);

  const supabase = publicClient();
  if (!supabase) return { status: "unconfigured" };

  let loadedPrograms: ProgramRow[];
  try {
    loadedPrograms = await collectPagesInBatches<ProgramRow>("athletic programs", (from, to) =>
      supabase
        .from("athletic_programs")
        .select("id,institution_id,sport_code,gender,governing_body,division,external_code,display_name")
        .eq("active", true)
        .eq("visibility", "public")
        .ilike("sport_code", "%swim%")
        .order("id")
        .range(from, to));
  } catch {
    const legacy = await collectPagesInBatches<Omit<ProgramRow, "external_code" | "display_name">>(
      "athletic programs",
      (from, to) => supabase
        .from("athletic_programs")
        .select("id,institution_id,sport_code,gender,governing_body,division")
        .eq("active", true)
        .eq("visibility", "public")
        .ilike("sport_code", "%swim%")
        .order("id")
        .range(from, to),
    );
    loadedPrograms = legacy.map((program) => ({
      ...program,
      external_code: "institution",
      display_name: null,
    }));
  }

  const programs = loadedPrograms.filter((program) => isSwimmingSportCode(program.sport_code));
  if (programs.length === 0) return { status: "empty" };

  const institutionIds = [...new Set(programs.map((program) => program.institution_id))];
  const programIds = programs.map((program) => program.id);
  const [institutions, facts, memberships, links] = await Promise.all([
    collectByIdChunks<InstitutionRow>(institutionIds, "institutions", (ids, from, to) =>
      supabase
        .from("institutions")
        .select("id,canonical_name,city,state_code,country_code,website_url,latitude,longitude")
        .in("id", ids)
        .eq("active", true)
        .eq("visibility", "public")
        .order("id")
        .range(from, to)),
    (async (): Promise<FactRow[]> => {
      try {
        return await collectByIdChunks<FactRow>(institutionIds, "institution facts", (ids, from, to) =>
          supabase
            .from("institution_latest_facts")
            .select("institution_id,control_code,undergraduate_enrollment,admission_rate,sat_median,sat_percentile_25,sat_percentile_75,act_median,act_percentile_25,act_percentile_75,public_net_price,private_net_price")
            .in("institution_id", ids)
            .eq("visibility", "public")
            .order("institution_id")
            .range(from, to));
      } catch (error) {
        if (!isMissingRelation(error, "sat_median")) throw error;
        const legacy = await collectByIdChunks<LegacyFactRow>(institutionIds, "institution facts", (ids, from, to) =>
          supabase
            .from("institution_latest_facts")
            .select("institution_id,control_code,undergraduate_enrollment,admission_rate,public_net_price,private_net_price")
            .in("institution_id", ids)
            .eq("visibility", "public")
            .order("institution_id")
            .range(from, to));
        return legacy.map((fact) => ({
          ...fact,
          sat_median: null,
          sat_percentile_25: null,
          sat_percentile_75: null,
          act_median: null,
          act_percentile_25: null,
          act_percentile_75: null,
        }));
      }
    })(),
    collectByIdChunks<MembershipRow>(programIds, "conference memberships", (ids, from, to) =>
      supabase
        .from("athletic_conference_memberships")
        .select("athletic_program_id,conference_id,effective_from,effective_to,evidence_url,verified_at")
        .in("athletic_program_id", ids)
        .eq("visibility", "public")
        .order("athletic_program_id")
        .range(from, to)),
    collectByIdChunks<LinkRow>(programIds, "verified program links", (ids, from, to) =>
      supabase
        .from("verified_program_links")
        .select("id,athletic_program_id,link_type,url")
        .in("athletic_program_id", ids)
        .eq("visibility", "public")
        .eq("verification_status", "verified")
        .order("athletic_program_id")
        .range(from, to)),
  ]);
  const conferenceIds = [...new Set(memberships.map((membership) => membership.conference_id))];
  const conferences = await collectByIdChunks<ConferenceRow>(
    conferenceIds,
    "athletic conferences",
    (ids, from, to) => supabase
      .from("athletic_conferences")
      .select("id,name,short_name,website_url")
      .in("id", ids)
      .eq("visibility", "public")
      .order("id")
      .range(from, to),
  );

  return {
    status: "ready",
    programs,
    institutions,
    facts,
    memberships,
    conferences,
    links,
    asOf: new Date().toISOString().slice(0, 10),
  };
}

async function loadDirectoryMajors(): Promise<CipRow[]> {
  "use cache";
  cacheLife("days");
  cacheTag(PUBLIC_PROGRAMS_TAG);

  const supabase = publicClient();
  if (!supabase) return [];
  return collectPagesInBatches<CipRow>("bachelor's CIP programs", (from, to) =>
    supabase
      .from("cip_program_latest")
      .select("institution_id,cip_code,cip_title")
      .eq("credential_level_code", BACHELORS_CREDENTIAL_LEVEL)
      .eq("visibility", "public")
      .order("id")
      .range(from, to));
}

async function buildExploreDirectory(): Promise<ExploreDirectory> {
  "use cache";
  cacheLife("days");
  cacheTag(PUBLIC_PROGRAMS_TAG);

  const [core, allMajors] = await Promise.all([loadDirectoryCore(), loadDirectoryMajors()]);
  if (core.status !== "ready") return { result: { status: core.status, programs: [] }, facets: EMPTY_FACETS };

  const institutionIds = new Set(core.programs.map((program) => program.institution_id));
  const institutions = new Map(core.institutions.map((row) => [row.id, row]));
  const facts = new Map(core.facts.map((row) => [row.institution_id, row]));
  const memberships = groupedBy(core.memberships, (row) => row.athletic_program_id);
  const links = groupedBy(core.links, (row) => row.athletic_program_id);
  const conferences = new Map(core.conferences.map((row) => [row.id, row]));
  const majorRows = groupedBy(
    allMajors.filter((row) => institutionIds.has(row.institution_id)),
    (row) => row.institution_id,
  );
  const majors = new Map([...majorRows].map(([institutionId, rows]) => [
    institutionId,
    rows
      .map((row) => ({ code: row.cip_code, title: row.cip_title }))
      .sort((left, right) => left.code.localeCompare(right.code, undefined, { numeric: true })),
  ]));
  const programs = core.programs.flatMap<PublicSwimmingProgram>((program) => {
    const institution = institutions.get(program.institution_id);
    if (!institution) return [];
    const fact = facts.get(program.institution_id) ?? null;
    const membership = selectCurrentMembership(memberships.get(program.id) ?? [], core.asOf);
    const conference = membership ? conferences.get(membership.conference_id) ?? null : null;
    const controlCode = fact?.control_code ?? null;
    return [{
      id: program.id,
      institutionId: institution.id,
      institutionName: institution.canonical_name,
      programName: program.display_name ?? institution.canonical_name,
      city: institution.city,
      stateCode: institution.state_code,
      countryCode: institution.country_code,
      institutionWebsiteUrl: institution.website_url,
      latitude: nullableNumber(institution.latitude),
      longitude: nullableNumber(institution.longitude),
      squad: program.gender,
      governingBody: program.governing_body,
      division: program.division,
      conference: membership && conference ? {
        id: conference.id,
        name: conference.name,
        shortName: conference.short_name,
        websiteUrl: conference.website_url,
        evidenceUrl: membership.evidence_url,
        verifiedAt: membership.verified_at,
      } : null,
      control: controlLabel(controlCode),
      undergraduateEnrollment: fact?.undergraduate_enrollment ?? null,
      admissionRate: nullableNumber(fact?.admission_rate ?? null),
      averageNetPrice: netPriceForControl(
        controlCode,
        fact?.public_net_price ?? null,
        fact?.private_net_price ?? null,
      ),
      admissionScores: {
        sat: {
          median: fact?.sat_median ?? null,
          percentile25: fact?.sat_percentile_25 ?? null,
          percentile75: fact?.sat_percentile_75 ?? null,
        },
        act: {
          median: fact?.act_median ?? null,
          percentile25: fact?.act_percentile_25 ?? null,
          percentile75: fact?.act_percentile_75 ?? null,
        },
      },
      factVintageDate: null,
      bachelorsOfferings: majors.get(program.institution_id) ?? [],
      verifiedLinks: (links.get(program.id) ?? [])
        .map((link) => ({ id: link.id, type: link.link_type, url: link.url }))
        .sort((left, right) => left.type.localeCompare(right.type) || left.url.localeCompare(right.url)),
      fitBenchmarks: [],
      sources: [],
    }];
  }).sort((left, right) =>
    left.institutionName.localeCompare(right.institutionName)
    || left.squad.localeCompare(right.squad));

  return {
    result: programs.length > 0
      ? { status: "ready", programs }
      : { status: "empty", programs: [] },
    facets: facetsFor(programs),
  };
}

export type ExploreFacets = {
  divisions: string[];
  conferences: Array<{ value: string; label: string }>;
  states: string[];
  cipOptions: PublicCipFilterOption[];
  testScoreCoveragePrograms: number;
};

export type ExploreDirectory = {
  result: PublicProgramLoadResult;
  facets: ExploreFacets;
};

const EMPTY_FACETS: ExploreFacets = {
  divisions: [],
  conferences: [],
  states: [],
  cipOptions: [],
  testScoreCoveragePrograms: 0,
};

function facetsFor(programs: PublicSwimmingProgram[]): ExploreFacets {
  return {
    divisions: [...new Set(programs.flatMap((program) => program.division ? [program.division] : []))].sort(),
    conferences: [...new Map(programs.flatMap((program) => {
      const conference = program.conference;
      return conference
        ? [[conference.name, conference.shortName ? `${conference.shortName} · ${conference.name}` : conference.name] as const]
        : [];
    })).entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((left, right) => left.label.localeCompare(right.label)),
    states: [...new Set(programs.flatMap((program) => program.stateCode ? [program.stateCode] : []))].sort(),
    cipOptions: buildCipFilterOptions(programs),
    testScoreCoveragePrograms: programs.filter((program) =>
      (["sat", "act"] as const).some((test) => {
        const range = program.admissionScores[test];
        return range.median !== null || range.percentile25 !== null || range.percentile75 !== null;
      })).length,
  };
}

export async function loadExploreDirectory(): Promise<ExploreDirectory> {
  try {
    return await buildExploreDirectory();
  } catch (error) {
    console.error("Unable to load the Explore program directory", error);
    return {
      result: {
        status: "error",
        programs: [],
        message: "The published program directory could not be loaded.",
      },
      facets: EMPTY_FACETS,
    };
  }
}

export async function loadExploreSwimmingPrograms(): Promise<PublicProgramLoadResult> {
  return (await loadExploreDirectory()).result;
}

async function loadFitSummaryCached(): Promise<PublicFitSummary> {
  "use cache";
  cacheLife("days");
  cacheTag(PUBLIC_PROGRAMS_TAG);

  const supabase = publicClient();
  if (!supabase) return { datasetReady: false, coveredConferenceCount: 0 };

  const legacyPromise = supabase
    .from("program_fit_benchmarks")
    .select("id")
    .eq("visibility", "public")
    .eq("is_suppressed", false)
    .limit(1);
  const verifiedPromise = supabase
    .from("conference_fit_benchmarks")
    .select("id")
    .eq("visibility", "public")
    .eq("is_suppressed", false)
    .limit(1);
  const releasesPromise = supabase
    .from("championship_result_releases")
    .select("conference_id")
    .eq("state", "published")
    .limit(PAGE_SIZE);

  const [legacyResult, verifiedResult, releasesResult] = await Promise.all([
    Promise.resolve(legacyPromise).catch(() => ({ data: null })),
    Promise.resolve(verifiedPromise).catch(() => ({ data: null })),
    Promise.resolve(releasesPromise).catch(() => ({ data: null })),
  ]);
  const releases = (releasesResult.data ?? []) as Array<{ conference_id: string }>;
  return {
    datasetReady: Boolean(legacyResult.data?.length || verifiedResult.data?.length),
    coveredConferenceCount: new Set(releases.map((release) => release.conference_id)).size,
  };
}

export async function loadPublicFitSummary(): Promise<PublicFitSummary> {
  try {
    return await loadFitSummaryCached();
  } catch (error) {
    console.error("Unable to load public fit coverage summary", error);
    return { datasetReady: false, coveredConferenceCount: 0 };
  }
}

function rawEventCandidates(events: EventCode[]): string[] {
  const meterDistance: Partial<Record<EventCode, string>> = {
    "500FR": "400FR",
    "1000FR": "800FR",
    "1650FR": "1500FR",
  };
  return [...new Set(events.flatMap((event) => [event, meterDistance[event]].filter(Boolean) as string[]))];
}

async function loadFilteredFitRows(
  gender: "men" | "women",
  mode: Exclude<PublicProgramFitMode, "none">,
  rank: number,
  eventKey: string,
): Promise<Record<string, PublicProgramFitBenchmark[]>> {
  "use cache";
  cacheLife("days");
  cacheTag(PUBLIC_PROGRAMS_TAG);

  const supabase = publicClient();
  if (!supabase) return {};
  const selectedEvents = eventKey.split(",").filter(Boolean) as EventCode[];
  if (selectedEvents.length === 0) return {};
  const selectedSet = new Set(selectedEvents);
  const rawEvents = rawEventCandidates(selectedEvents);

  const loadLegacy = async () => {
    try {
      return await collectPagesInBatches<LegacyFitRow>("filtered program fit benchmarks", (from, to) => {
        const base = supabase
          .from("program_fit_benchmarks")
          .select("id,athletic_program_id,source_snapshot_id,event_code,gender,course,benchmark_scope,rank_cutoff,time_ms,season_label,sample_size,derivation_method,derivation_version,evidence_url,calculated_at")
          .eq("visibility", "public")
          .eq("is_suppressed", false)
          .eq("gender", gender)
          .eq("benchmark_scope", mode)
          .in("event_code", rawEvents);
        const ranked = mode === "conference_score"
          ? base.is("rank_cutoff", null)
          : base.eq("rank_cutoff", rank);
        return ranked.order("id").range(from, to);
      });
    } catch (error) {
      if (isMissingRelation(error, "program_fit_benchmarks")) return [];
      throw error;
    }
  };

  const loadVerified = async () => {
    if (mode === "program_rank") return [];
    try {
      return await collectPagesInBatches<ConferenceFitRow>("filtered conference fit benchmarks", (from, to) => {
        const base = supabase
          .from("conference_fit_benchmarks")
          .select(CONFERENCE_FIT_BENCHMARK_PUBLIC_COLUMNS)
          .eq("visibility", "public")
          .eq("is_suppressed", false)
          .eq("gender", gender)
          .eq("benchmark_scope", mode)
          .in("event_code", rawEvents);
        const ranked = mode === "conference_score"
          ? base.is("rank_cutoff", null)
          : base.eq("rank_cutoff", rank);
        return ranked.order("id").range(from, to);
      });
    } catch (error) {
      if (isMissingRelation(error, "conference_fit_benchmarks")) return [];
      throw error;
    }
  };

  const [legacyRows, verifiedRows] = await Promise.all([loadLegacy(), loadVerified()]);
  const releaseIds = [...new Set(verifiedRows.map((benchmark) => benchmark.release_id))];
  let releases: ReleaseRow[] = [];
  let participants: ParticipantRow[] = [];
  let programGenders: ProgramGenderRow[] = [];
  if (releaseIds.length > 0) {
    try {
      [releases, participants] = await Promise.all([
        collectByIdChunks<ReleaseRow>(releaseIds, "published championship releases", (ids, from, to) =>
          supabase
            .from("championship_result_releases")
            .select(CHAMPIONSHIP_RELEASE_PUBLIC_COLUMNS)
            .in("id", ids)
            .eq("state", "published")
            .order("id")
            .range(from, to)),
        collectByIdChunks<ParticipantRow>(releaseIds, "championship participants", (ids, from, to) =>
          supabase
            .from("championship_release_participants")
            .select(CHAMPIONSHIP_PARTICIPANT_PUBLIC_COLUMNS)
            .in("release_id", ids)
            .eq("competed", true)
            .order("release_id")
            .order("athletic_program_id")
            .range(from, to)),
      ]);
      const programIds = [...new Set(participants.map((participant) => participant.athletic_program_id))];
      programGenders = await collectByIdChunks<ProgramGenderRow>(
        programIds,
        "championship participant programs",
        (ids, from, to) => supabase
          .from("athletic_programs")
          .select("id,gender")
          .in("id", ids)
          .eq("visibility", "public")
          .order("id")
          .range(from, to),
      );
    } catch (error) {
      if (!isMissingRelation(error, "championship_result_releases")
        && !isMissingRelation(error, "championship_release_participants")) throw error;
      releases = [];
      participants = [];
      programGenders = [];
    }
  }

  const benchmarksByProgram = new Map<string, PublicProgramFitBenchmark[]>();
  const add = (programId: string, benchmark: PublicProgramFitBenchmark) => {
    const rows = benchmarksByProgram.get(programId);
    if (rows) rows.push(benchmark);
    else benchmarksByProgram.set(programId, [benchmark]);
  };

  for (const row of legacyRows) {
    const event = normalizeBenchmarkEvent(row.event_code, row.course);
    if (!event || !selectedSet.has(event)) continue;
    add(row.athletic_program_id, {
      id: row.id,
      event,
      gender: row.gender,
      course: row.course,
      scope: row.benchmark_scope,
      rankCutoff: row.rank_cutoff,
      seconds: row.time_ms / 1_000,
      seasonLabel: row.season_label,
      sampleSize: row.sample_size,
      derivationMethod: row.derivation_method,
      derivationVersion: row.derivation_version,
      evidenceUrl: row.evidence_url,
      calculatedAt: row.calculated_at,
      sourceSnapshotId: row.source_snapshot_id,
      provenance: {
        kind: "legacy_program_benchmark",
        label: `Legacy program-level fallback · ${row.season_label}`,
        conferenceId: null,
        conferenceName: null,
        releaseId: null,
        meetName: null,
        meetDate: null,
        publishedAt: null,
      },
    });
  }

  const releaseById = new Map(releases.map((release) => [release.id, release]));
  const participantsByRelease = groupedBy(participants, (participant) => participant.release_id);
  const genderByProgram = new Map(programGenders.map((program) => [program.id, program.gender]));
  for (const row of verifiedRows) {
    const release = releaseById.get(row.release_id);
    const event = normalizeBenchmarkEvent(row.event_code, row.course);
    if (!release || !event || !selectedSet.has(event)) continue;
    if (row.conference_id !== release.conference_id
      || row.season_label !== release.season_label
      || row.gender !== release.gender
      || row.course !== release.course) continue;
    for (const participant of participantsByRelease.get(release.id) ?? []) {
      const programGender = genderByProgram.get(participant.athletic_program_id);
      if (!participant.competed || (programGender !== "coed" && programGender !== release.gender)) continue;
      add(participant.athletic_program_id, {
        id: row.id,
        event,
        gender: row.gender,
        course: row.course,
        scope: row.benchmark_scope,
        rankCutoff: row.rank_cutoff,
        seconds: row.time_ms / 1_000,
        seasonLabel: release.season_label,
        sampleSize: row.sample_size,
        derivationMethod: row.derivation_method,
        derivationVersion: row.derivation_version,
        evidenceUrl: row.evidence_url,
        calculatedAt: row.calculated_at,
        sourceSnapshotId: release.source_snapshot_id,
        provenance: {
          kind: "verified_championship_release",
          label: `${release.meet_name} · ${release.season_label} published championship release`,
          conferenceId: release.conference_id,
          conferenceName: null,
          releaseId: release.id,
          meetName: release.meet_name,
          meetDate: release.meet_date,
          publishedAt: release.published_at,
        },
      });
    }
  }

  return Object.fromEntries([...benchmarksByProgram].map(([programId, benchmarks]) => [
    programId,
    selectPreferredBenchmarkDatasets(benchmarks),
  ]));
}

export async function loadPublicProgramFit(
  gender: "men" | "women",
  mode: Exclude<PublicProgramFitMode, "none">,
  rank: number,
  events: EventCode[],
): Promise<PublicProgramFitResult> {
  if (!publicClient()) return { status: "unconfigured", benchmarksByProgram: {} };
  const boundedRank = Number.isInteger(rank) && rank >= 1 && rank <= 100 ? rank : 3;
  const eventKey = [...new Set(events)].sort().join(",");
  try {
    return {
      status: "ready",
      benchmarksByProgram: await loadFilteredFitRows(gender, mode, boundedRank, eventKey),
    };
  } catch (error) {
    console.error("Unable to load filtered public performance benchmarks", error);
    return { status: "error", benchmarksByProgram: {} };
  }
}

const STRENGTH_RANK_CUTOFF = 3;
const MIN_STRENGTH_PEERS = 4;
const MIN_STRENGTH_EVENTS = 4;

async function loadSwimmingStrengthCached(): Promise<PublicSwimmingStrengthResult> {
  "use cache";
  cacheLife("days");
  cacheTag(PUBLIC_PROGRAMS_TAG);

  const eventKey = EVENT_ORDER.join(",");
  const [men, women] = await Promise.all([
    loadFilteredFitRows("men", "program_rank", STRENGTH_RANK_CUTOFF, eventKey),
    loadFilteredFitRows("women", "program_rank", STRENGTH_RANK_CUTOFF, eventKey),
  ]);

  const peerGroups = new Map<string, Map<string, number>>();
  for (const benchmarksByProgram of [men, women]) {
    for (const [programId, benchmarks] of Object.entries(benchmarksByProgram)) {
      for (const benchmark of benchmarks) {
        if (benchmark.scope !== "program_rank"
          || benchmark.rankCutoff !== STRENGTH_RANK_CUTOFF
          || !Number.isFinite(benchmark.seconds)
          || benchmark.seconds <= 0) continue;
        const groupKey = `${benchmark.gender}:${benchmark.course}:${benchmark.event}`;
        const peers = peerGroups.get(groupKey) ?? new Map<string, number>();
        const current = peers.get(programId);
        if (current === undefined || benchmark.seconds < current) peers.set(programId, benchmark.seconds);
        peerGroups.set(groupKey, peers);
      }
    }
  }

  const percentiles = new Map<string, number[]>();
  for (const peers of peerGroups.values()) {
    if (peers.size < MIN_STRENGTH_PEERS) continue;
    const ordered = [...peers.entries()].sort((left, right) => left[1] - right[1]);
    for (let start = 0; start < ordered.length;) {
      let end = start + 1;
      while (end < ordered.length && ordered[end][1] === ordered[start][1]) end += 1;
      const midpointRank = start + (end - start - 1) / 2;
      const percentile = 100 * (1 - midpointRank / (ordered.length - 1));
      for (let index = start; index < end; index += 1) {
        const programId = ordered[index][0];
        percentiles.set(programId, [...(percentiles.get(programId) ?? []), percentile]);
      }
      start = end;
    }
  }

  const scores: Record<string, PublicProgramStrength> = {};
  for (const [programId, values] of percentiles) {
    if (values.length < MIN_STRENGTH_EVENTS) continue;
    scores[programId] = {
      score: Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10,
      eventCount: values.length,
    };
  }
  return { scores, coveredProgramCount: Object.keys(scores).length };
}

export async function loadPublicSwimmingStrength(): Promise<PublicSwimmingStrengthResult> {
  try {
    return await loadSwimmingStrengthCached();
  } catch (error) {
    console.error("Unable to load the public swimming-strength index", error);
    return { scores: {}, coveredProgramCount: 0 };
  }
}
