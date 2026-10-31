import "server-only";

import { canonicalEvent } from "./events";
import type { Course, EventCode } from "./types";

export const PUBLIC_PROGRAMS_TAG = "public-programs";

const PUBLIC_FIT_EVENTS = new Set<EventCode>([
  "50FR", "100FR", "200FR", "500FR", "1000FR", "1650FR",
  "100BK", "200BK", "100BR", "200BR", "100FL", "200FL", "200IM", "400IM",
]);

function allowedFitEvent(value: string): value is EventCode {
  return PUBLIC_FIT_EVENTS.has(value as EventCode);
}

export function normalizeBenchmarkEvent(value: string, course: Course): EventCode | null {
  const normalized = value.trim().toUpperCase();
  if (allowedFitEvent(normalized)) return normalized;
  return canonicalEvent(normalized, course);
}

type AthleticProgramRow = {
  id: string;
  institution_id: string;
  sport_code: string;
  gender: "men" | "women" | "coed";
  governing_body: string;
  division: string | null;
  external_code: string;
  display_name: string | null;
};

type ChampionshipResultReleaseRow = {
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

type ChampionshipReleaseParticipantRow = {
  release_id: string;
  athletic_program_id: string;
  competed: boolean;
};

export const CHAMPIONSHIP_PARTICIPANT_PUBLIC_COLUMNS =
  "release_id,athletic_program_id,competed" as const;

export const CHAMPIONSHIP_RELEASE_PUBLIC_COLUMNS =
  "id,conference_id,source_snapshot_id,season_label,gender,course,meet_name,meet_date,state,published_at" as const;

export const CONFERENCE_FIT_BENCHMARK_PUBLIC_COLUMNS =
  "id,release_id,conference_id,season_label,event_code,gender,course,benchmark_scope,rank_cutoff,time_ms,sample_size,derivation_method,derivation_version,evidence_url,calculated_at" as const;

export type PublicProgramControl =
  | "Public"
  | "Private nonprofit"
  | "Private for-profit"
  | "Unknown";

export type PublicProgramLinkType =
  | "program"
  | "swimcloud"
  | "roster"
  | "schedule"
  | "results"
  | "staff"
  | "questionnaire"
  | "recruiting_form"
  | "news";

export type PublicProgramSource = {
  snapshotId: string;
  sourceName: string;
  publisher: string;
  dataset: string;
  releaseLabel: string;
  vintageDate: string;
  sourceUrl: string | null;
  retrievedAt: string;
  covers: string[];
};

export type PublicCipOffering = {
  code: string;
  title: string;
  credentialLevelName?: string | null;
  reportedCompletions?: number | null;
  completionsSuppressed?: boolean;
  vintageDate?: string;
  sourceSnapshotId?: string;
};

export type PublicProgramLink = {
  id: string;
  type: PublicProgramLinkType;
  url: string;
  evidenceUrl?: string;
  verifiedAt?: string;
  lastCheckedAt?: string | null;
  sourceSnapshotId?: string;
};

export type PublicProgramFitBenchmark = {
  id: string;
  event: EventCode;
  gender: "men" | "women";
  course: "SCY" | "SCM" | "LCM";
  scope: "conference_score" | "conference_place" | "program_rank";
  rankCutoff: number | null;
  seconds: number;
  seasonLabel: string;
  sampleSize: number | null;
  derivationMethod: string;
  derivationVersion: string;
  evidenceUrl: string;
  calculatedAt: string;
  sourceSnapshotId: string;
  provenance: {
    kind: "verified_championship_release" | "legacy_program_benchmark";
    label: string;
    conferenceId: string | null;
    conferenceName: string | null;
    releaseId: string | null;
    meetName: string | null;
    meetDate: string | null;
    publishedAt: string | null;
  };
};

export type PublicSwimmingProgram = {
  id: string;
  institutionId: string;
  institutionName: string;
  programName: string;
  city: string | null;
  stateCode: string | null;
  countryCode: string;
  institutionWebsiteUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  squad: "men" | "women" | "coed";
  governingBody: string;
  division: string | null;
  conference: {
    id: string;
    name: string;
    shortName: string | null;
    websiteUrl: string | null;
    evidenceUrl: string;
    verifiedAt: string;
  } | null;
  control: PublicProgramControl;
  undergraduateEnrollment: number | null;
  admissionRate: number | null;
  averageNetPrice: number | null;
  admissionScores: {
    sat: PublicAdmissionScoreRange;
    act: PublicAdmissionScoreRange;
  };
  factVintageDate: string | null;
  bachelorsOfferings: PublicCipOffering[];
  verifiedLinks: PublicProgramLink[];
  fitBenchmarks: PublicProgramFitBenchmark[];
  sources: PublicProgramSource[];
};

export type PublicProgramMapItem = Pick<PublicSwimmingProgram,
  | "id"
  | "institutionId"
  | "institutionName"
  | "programName"
  | "city"
  | "stateCode"
  | "latitude"
  | "longitude"
  | "squad"
  | "division"
  | "averageNetPrice"
> & {
  conferenceName: string | null;
};

export type PublicProgramLoadResult =
  | { status: "ready"; programs: PublicSwimmingProgram[] }
  | { status: "empty"; programs: [] }
  | { status: "unconfigured"; programs: [] }
  | { status: "error"; programs: []; message: string };

export type PublicProgramSort = "name" | "swimming-strength" | "conference" | "enrollment" | "net-price" | "admission-rate";

export type PublicProgramStrength = {
  score: number;
  eventCount: number;
};

export type PublicProgramFitMode = "none" | "conference_score" | "conference_place" | "program_rank";

export type PublicAdmissionTest = "sat" | "act";

export type PublicAdmissionScoreRange = {
  median: number | null;
  percentile25: number | null;
  percentile75: number | null;
};

export type PublicAcademicScoreMode =
  | "none"
  | "median_at_least"
  | "median_at_most"
  | "middle_50"
  | "at_or_above_25th"
  | "above_75th";

export type SwimmerAdmissionScores = Record<PublicAdmissionTest, number | null>;

export type PublicProgramFilters = {
  query: string;
  squad: "all" | "men" | "women" | "coed";
  divisions: string[];
  conferences: string[];
  states: string[];
  controls: PublicProgramControl[];
  minimumEnrollment: number | null;
  maximumEnrollment: number | null;
  maximumNetPrice: number | null;
  maximumAdmissionRate: number | null;
  academicTest: PublicAdmissionTest;
  academicMode: PublicAcademicScoreMode;
  academicValue: number | null;
  cips: string[];
  sort: PublicProgramSort;
  fitMode: PublicProgramFitMode;
  fitRank: number;
  fitEvents: EventCode[];
  fitMatch: "any" | "all";
};

export type PublicCipFilterOption = {
  value: string;
  label: string;
};

export type PublicProgramSearchParams = Record<string, string | string[] | undefined>;

export function isSwimmingSportCode(value: string): boolean {
  return value.trim().toLowerCase().includes("swim");
}

export function cipCodeMatches(code: string, prefix: string): boolean {
  const normalizedCode = code.trim();
  const normalizedPrefix = prefix.trim();
  const validCip = /^\d{2}(\.\d{1,4})?$/;
  if (!validCip.test(normalizedCode) || !validCip.test(normalizedPrefix)) return false;
  return normalizedCode.replace(".", "").startsWith(normalizedPrefix.replace(".", ""));
}

export function controlLabel(controlCode: number | null): PublicProgramControl {
  if (controlCode === 1) return "Public";
  if (controlCode === 2) return "Private nonprofit";
  if (controlCode === 3) return "Private for-profit";
  return "Unknown";
}

export function netPriceForControl(
  controlCode: number | null,
  publicNetPrice: number | null,
  privateNetPrice: number | null,
): number | null {
  if (controlCode === 1) return publicNetPrice;
  if (controlCode === 2 || controlCode === 3) return privateNetPrice;
  return publicNetPrice ?? privateNetPrice;
}

export function parsePublicProgramFilters(
  params: PublicProgramSearchParams,
): PublicProgramFilters {
  const value = (key: string, maxLength = 100) => {
    const raw = params[key];
    const first = Array.isArray(raw) ? raw[0] : raw;
    return first?.trim().slice(0, maxLength) ?? "";
  };
  const nonnegativeNumber = (key: string) => {
    const raw = value(key, 24);
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  };
  const selections = (key: string, maxLength: number, maxItems = 200) => {
    const raw = params[key];
    return [...new Set((Array.isArray(raw) ? raw : [raw])
      .map((item) => item?.trim().slice(0, maxLength) ?? "")
      .filter(Boolean))].slice(0, maxItems);
  };

  const squadValue = value("squad");
  const squad = ["men", "women", "coed"].includes(squadValue)
    ? squadValue as PublicProgramFilters["squad"]
    : "all";
  const allowedControls: PublicProgramControl[] = [
    "Public",
    "Private nonprofit",
    "Private for-profit",
    "Unknown",
  ];
  const controls = selections("control", 40, allowedControls.length)
    .filter((control): control is PublicProgramControl => allowedControls.includes(control as PublicProgramControl));
  const sortValue = value("sort");
  const sort: PublicProgramSort = ["swimming-strength", "conference", "enrollment", "net-price", "admission-rate"].includes(sortValue)
    ? sortValue as PublicProgramSort
    : "name";
  const fitModeValue = value("fitMode");
  const fitMode: PublicProgramFitMode = ["conference_score", "conference_place", "program_rank"].includes(fitModeValue)
    ? fitModeValue as PublicProgramFitMode
    : "none";
  const fitRankValue = Number.parseInt(value("fitRank", 3), 10);
  const fitRank = Number.isInteger(fitRankValue) && fitRankValue >= 1 && fitRankValue <= 100 ? fitRankValue : 3;
  const rawFitEvents = params.fitEvent;
  const fitEvents = [...new Set((Array.isArray(rawFitEvents) ? rawFitEvents : [rawFitEvents])
    .flatMap((raw) => raw?.split(",") ?? [])
    .map((event) => event.trim().toUpperCase())
    .filter(allowedFitEvent))];
  const admissionPercent = nonnegativeNumber("admissionMax");
  const academicTest: PublicAdmissionTest = value("academicTest") === "act" ? "act" : "sat";
  const academicModeValue = value("academicMode");
  const academicMode: PublicAcademicScoreMode = [
    "median_at_least",
    "median_at_most",
    "middle_50",
    "at_or_above_25th",
    "above_75th",
  ].includes(academicModeValue)
    ? academicModeValue as PublicAcademicScoreMode
    : "none";
  const rawAcademicValue = nonnegativeNumber("academicValue");
  const validAcademicValue = rawAcademicValue !== null && (
    academicTest === "sat"
      ? Number.isInteger(rawAcademicValue) && rawAcademicValue >= 400 && rawAcademicValue <= 1600
      : Number.isInteger(rawAcademicValue) && rawAcademicValue >= 1 && rawAcademicValue <= 36
  ) ? rawAcademicValue : null;
  const academicValue = academicMode === "median_at_least" || academicMode === "median_at_most"
    ? validAcademicValue
    : null;
  const rawStates = params.state;
  const states = [...new Set((Array.isArray(rawStates) ? rawStates : [rawStates])
    .flatMap((raw) => raw?.split(",") ?? [])
    .map((state) => state.trim().toUpperCase())
    .filter((state) => /^[A-Z]{2}$/.test(state)))].slice(0, 56);

  return {
    query: value("q", 200),
    squad,
    divisions: selections("division", 100),
    conferences: selections("conference", 160),
    states,
    controls,
    minimumEnrollment: nonnegativeNumber("enrollmentMin"),
    maximumEnrollment: nonnegativeNumber("enrollmentMax"),
    maximumNetPrice: nonnegativeNumber("netPriceMax"),
    maximumAdmissionRate: admissionPercent === null
      ? null
      : Math.min(admissionPercent, 100) / 100,
    academicTest,
    academicMode,
    academicValue,
    cips: selections("cip", 80),
    sort,
    fitMode,
    fitRank,
    fitEvents,
    fitMatch: value("fitMatch") === "all" ? "all" : "any",
  };
}

export function academicScoreValue(
  filters: Pick<PublicProgramFilters, "academicTest" | "academicValue">,
  swimmerScores: SwimmerAdmissionScores,
): number | null {
  return filters.academicValue ?? swimmerScores[filters.academicTest];
}

export function matchesAcademicScoreFilter(
  program: PublicSwimmingProgram,
  filters: Pick<PublicProgramFilters, "academicTest" | "academicMode" | "academicValue">,
  swimmerScores: SwimmerAdmissionScores,
): boolean {
  if (filters.academicMode === "none") return true;
  const range = program.admissionScores[filters.academicTest];
  const comparisonScore = academicScoreValue(filters, swimmerScores);

  if (filters.academicMode === "median_at_least") {
    return range.median !== null && comparisonScore !== null && range.median >= comparisonScore;
  }
  if (filters.academicMode === "median_at_most") {
    return range.median !== null && comparisonScore !== null && range.median <= comparisonScore;
  }

  const swimmerScore = swimmerScores[filters.academicTest];
  if (swimmerScore === null) return false;
  if (filters.academicMode === "middle_50") {
    return range.percentile25 !== null
      && range.percentile75 !== null
      && swimmerScore >= range.percentile25
      && swimmerScore <= range.percentile75;
  }
  if (filters.academicMode === "at_or_above_25th") {
    return range.percentile25 !== null && swimmerScore >= range.percentile25;
  }
  return range.percentile75 !== null && swimmerScore > range.percentile75;
}

function matchesCipFilter(program: PublicSwimmingProgram, filter: string): boolean {
  if (filter.startsWith("family:")) {
    const prefix = filter.slice("family:".length);
    return program.bachelorsOfferings.some((offering) => cipCodeMatches(offering.code, prefix));
  }
  if (filter.startsWith("code:")) {
    const code = filter.slice("code:".length);
    return program.bachelorsOfferings.some((offering) => offering.code === code);
  }
  return false;
}

function matchesCipFilters(program: PublicSwimmingProgram, filters: string[]): boolean {
  return filters.length === 0 || filters.some((filter) => matchesCipFilter(program, filter));
}

function nullableAscending(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}

function nullableDescending(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return b - a;
}

export function filterPublicPrograms(
  programs: PublicSwimmingProgram[],
  filters: PublicProgramFilters,
  swimmingStrength: Readonly<Record<string, PublicProgramStrength>> = {},
  swimmerScores: SwimmerAdmissionScores = { sat: null, act: null },
): PublicSwimmingProgram[] {
  const terms = filters.query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const filtered = programs.filter((program) => {
    if (terms.length > 0) {
      const searchable = [
        program.programName,
        program.institutionName,
        program.city,
        program.stateCode,
        program.governingBody,
        program.division,
        program.conference?.name,
        program.conference?.shortName,
        ...program.bachelorsOfferings.flatMap((offering) => [offering.code, offering.title]),
      ].filter(Boolean).join(" ").toLocaleLowerCase();
      if (terms.some((term) => !searchable.includes(term))) return false;
    }
    if (filters.squad !== "all" && program.squad !== filters.squad) return false;
    if (filters.divisions.length > 0 && (!program.division || !filters.divisions.includes(program.division))) return false;
    if (filters.conferences.length > 0 && !filters.conferences.some((conference) =>
      [program.conference?.name, program.conference?.shortName].includes(conference))) return false;
    if (filters.states.length > 0 && (!program.stateCode || !filters.states.includes(program.stateCode))) return false;
    if (filters.controls.length > 0 && !filters.controls.includes(program.control)) return false;
    if (
      filters.minimumEnrollment !== null &&
      (program.undergraduateEnrollment === null || program.undergraduateEnrollment < filters.minimumEnrollment)
    ) return false;
    if (
      filters.maximumEnrollment !== null &&
      (program.undergraduateEnrollment === null || program.undergraduateEnrollment > filters.maximumEnrollment)
    ) return false;
    if (
      filters.maximumNetPrice !== null &&
      (program.averageNetPrice === null || program.averageNetPrice > filters.maximumNetPrice)
    ) return false;
    if (
      filters.maximumAdmissionRate !== null &&
      (program.admissionRate === null || program.admissionRate > filters.maximumAdmissionRate)
    ) return false;
    if (!matchesAcademicScoreFilter(program, filters, swimmerScores)) return false;
    return matchesCipFilters(program, filters.cips);
  });

  return filtered.sort((a, b) => {
    if (filters.sort === "swimming-strength") {
      const aStrength = swimmingStrength[a.id];
      const bStrength = swimmingStrength[b.id];
      if (aStrength && bStrength) {
        return bStrength.score - aStrength.score
          || bStrength.eventCount - aStrength.eventCount
          || a.institutionName.localeCompare(b.institutionName);
      }
      if (aStrength) return -1;
      if (bStrength) return 1;
      return a.institutionName.localeCompare(b.institutionName);
    }
    if (filters.sort === "enrollment") {
      return nullableDescending(a.undergraduateEnrollment, b.undergraduateEnrollment) ||
        a.institutionName.localeCompare(b.institutionName);
    }
    if (filters.sort === "net-price") {
      return nullableAscending(a.averageNetPrice, b.averageNetPrice) ||
        a.institutionName.localeCompare(b.institutionName);
    }
    if (filters.sort === "admission-rate") {
      return nullableAscending(a.admissionRate, b.admissionRate) ||
        a.institutionName.localeCompare(b.institutionName);
    }
    if (filters.sort === "conference") {
      const aConference = a.conference?.shortName ?? a.conference?.name ?? "\uffff";
      const bConference = b.conference?.shortName ?? b.conference?.name ?? "\uffff";
      return aConference.localeCompare(bConference) || a.institutionName.localeCompare(b.institutionName);
    }
    return a.institutionName.localeCompare(b.institutionName) || a.squad.localeCompare(b.squad);
  });
}

export function buildCipFilterOptions(programs: PublicSwimmingProgram[]): PublicCipFilterOption[] {
  const exact = new Map<string, string>();
  for (const program of programs) {
    for (const offering of program.bachelorsOfferings) {
      if (cipCodeMatches(offering.code, "14") || cipCodeMatches(offering.code, "40.05")) continue;
      const current = exact.get(offering.code);
      if (!current || offering.title.localeCompare(current) < 0) exact.set(offering.code, offering.title);
    }
  }

  return [
    { value: "family:14", label: "Engineering (CIP 14)" },
    { value: "family:40.05", label: "Chemistry (CIP 40.05)" },
    ...[...exact.entries()]
      .sort(([codeA], [codeB]) => codeA.localeCompare(codeB, undefined, { numeric: true }))
      .map(([code, title]) => ({ value: `code:${code}`, label: `${title} (CIP ${code})` })),
  ];
}

export function selectCurrentMembership<T extends {
  effective_from: string;
  effective_to: string | null;
}>(memberships: T[], asOf: string): T | null {
  return memberships
    .filter((membership) =>
      membership.effective_from <= asOf &&
      (membership.effective_to === null || membership.effective_to >= asOf))
    .sort((a, b) => b.effective_from.localeCompare(a.effective_from))[0] ?? null;
}

export function releaseAppliesToProgram(
  release: Pick<ChampionshipResultReleaseRow, "id" | "gender">,
  participant: Pick<ChampionshipReleaseParticipantRow, "release_id" | "athletic_program_id" | "competed">,
  programId: string,
  programGender: AthleticProgramRow["gender"],
): boolean {
  if (programGender !== "coed" && programGender !== release.gender) return false;
  return participant.competed
    && participant.release_id === release.id
    && participant.athletic_program_id === programId;
}

export function completionsAreSuppressed(fields: string[] | null): boolean {
  return (fields ?? []).some((field) => {
    const normalized = field.toLowerCase();
    return normalized.includes("complet") || normalized.includes("ipedscount");
  });
}

export async function loadPublicSwimmingPrograms(): Promise<PublicProgramLoadResult> {
  const { loadExploreSwimmingPrograms } = await import("./explore-programs");
  return loadExploreSwimmingPrograms();
}
