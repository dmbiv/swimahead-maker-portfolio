import type { PublicProgramLink } from "./public-programs";
import { normalizeSwimCloudSwimmerUrl } from "./roster-text";
import type { Course } from "./types";

type SwimCloudProgramGender = "men" | "women" | "coed";

type SwimCloudSeason = {
  id: number;
  endingYear: number;
};

export type SwimCloudVerificationLink = {
  href: string;
  kind: "direct" | "lookup";
  seasonLabel: string;
};

const COLLEGE_SEASONS: Record<string, SwimCloudSeason> = {
  "2015-16": { id: 19, endingYear: 2016 },
  "2016-17": { id: 20, endingYear: 2017 },
  "2017-18": { id: 21, endingYear: 2018 },
  "2018-19": { id: 22, endingYear: 2019 },
  "2019-20": { id: 23, endingYear: 2020 },
  "2020-21": { id: 24, endingYear: 2021 },
  "2021-22": { id: 25, endingYear: 2022 },
  "2022-23": { id: 26, endingYear: 2023 },
  "2023-24": { id: 27, endingYear: 2024 },
  "2024-25": { id: 28, endingYear: 2025 },
  "2025-26": { id: 29, endingYear: 2026 },
};

function isSwimCloudHost(hostname: string): boolean {
  return hostname.toLowerCase().replace(/^www\./, "") === "swimcloud.com";
}

const SWIMCLOUD_STROKE_IDS = {
  FR: 1,
  BK: 2,
  BR: 3,
  FL: 4,
  IM: 5,
} as const;

function swimCloudEventFilter(event: string, course: Course): string | null {
  const match = /^(\d+)(FR|BK|BR|FL|IM)$/.exec(event.toUpperCase().replace(/\s+/g, ""));
  if (!match) return null;

  const canonicalDistance = Number(match[1]);
  const distance = course === "SCY"
    ? canonicalDistance
    : ({ 500: 400, 1000: 800, 1650: 1500 } as Record<number, number>)[canonicalDistance]
      ?? canonicalDistance;
  return `${SWIMCLOUD_STROKE_IDS[match[2] as keyof typeof SWIMCLOUD_STROKE_IDS]}|${distance}|1`;
}

export function swimCloudTeamIdFromUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !isSwimCloudHost(url.hostname)) return null;
    return url.pathname.match(/^\/team\/(\d+)(?:\/|$)/)?.[1] ?? null;
  } catch {
    return null;
  }
}

export function swimCloudTeamIdFromLinks(links: PublicProgramLink[]): string | null {
  const ordered = [...links].sort((left, right) =>
    Number(right.type === "swimcloud") - Number(left.type === "swimcloud"));
  for (const link of ordered) {
    const teamId = swimCloudTeamIdFromUrl(link.url);
    if (teamId) return teamId;
  }
  return null;
}

export function buildSwimCloudTeamRosterUrl(teamId: string): string | null {
  if (!/^\d+$/.test(teamId)) return null;
  return `https://www.swimcloud.com/team/${teamId}/roster/`;
}

export function buildSwimCloudTeamTimesUrl({
  teamId,
  gender,
  seasonLabel,
  event,
  course,
}: {
  teamId: string;
  gender: SwimCloudProgramGender;
  seasonLabel: string;
  event: string;
  course: Course;
}): string | null {
  if (!/^\d+$/.test(teamId)) return null;
  const season = COLLEGE_SEASONS[seasonLabel];
  if (!season) return null;

  const url = new URL(`https://www.swimcloud.com/team/${teamId}/times/`);
  url.searchParams.set("dont_group", "false");
  if (gender !== "coed") url.searchParams.set("gender", gender === "men" ? "M" : "F");
  url.searchParams.set("page", "1");
  url.searchParams.set("season_id", String(season.id));
  url.searchParams.set("team_id", teamId);
  url.searchParams.set("year", String(season.endingYear));
  const eventFilter = swimCloudEventFilter(event, course);
  if (eventFilter) url.searchParams.set("event", eventFilter);
  return url.toString();
}

export function buildSwimCloudTeamLookupUrl({
  institutionName,
  stateCode,
}: {
  institutionName: string;
  stateCode: string | null;
}): string {
  const cleanName = institutionName.replaceAll('"', "").trim();
  const terms = [
    "site:swimcloud.com/team/",
    cleanName,
    stateCode ?? "",
    "swimming",
  ].filter(Boolean);
  const url = new URL("https://www.google.com/search");
  url.searchParams.set("q", terms.join(" "));
  return url.toString();
}

export type SwimCloudSwimmerLookup = {
  fullName: string;
  classYears?: readonly number[];
  lscCode?: string | null;
};

export function buildSwimCloudSwimmerQuery({ fullName, classYears, lscCode }: SwimCloudSwimmerLookup): string {
  const name = fullName.replace(/["]/g, "").replace(/[^\p{L}\p{N}\s'.-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  const years = [...new Set(classYears ?? [])]
    .filter((year) => Number.isInteger(year) && year >= 2000 && year <= 2100)
    .sort((left, right) => left - right);
  const alternates = [
    ...years.map((year) => `"Class of ${year}"`),
    ...years.map(String),
    "Senior",
    "Junior",
  ];
  const terms = [
    "site:swimcloud.com/swimmer",
    `"${name}"`,
    `(${alternates.join(" OR ")})`,
  ];
  if (lscCode && /^[A-Za-z]{2,4}$/.test(lscCode)) terms.push(lscCode.toUpperCase());
  return terms.join(" ");
}

export function buildSwimCloudSwimmerSearchUrl(lookup: SwimCloudSwimmerLookup): string {
  const url = new URL("https://www.google.com/search");
  url.searchParams.set("q", buildSwimCloudSwimmerQuery(lookup));
  return url.toString();
}

export function buildSwimCloudSwimmerLuckyUrl(lookup: SwimCloudSwimmerLookup): string {
  const url = new URL(buildSwimCloudSwimmerSearchUrl(lookup));
  url.searchParams.set("btnI", "1");
  return url.toString();
}

export function profileUrlFromLuckyRedirect(location: string): string | null {
  const hop = URL.parse(location, "https://www.google.com");
  if (!hop) return null;
  const wrapped = hop.searchParams.get("q");
  return normalizeSwimCloudSwimmerUrl(wrapped ?? location);
}

export function buildSwimCloudResolverPath(lookup: SwimCloudSwimmerLookup): string {
  const params = new URLSearchParams({ name: lookup.fullName.slice(0, 80) });
  const years = [...new Set(lookup.classYears ?? [])].filter((year) => Number.isInteger(year));
  if (years.length > 0) params.set("classes", years.join(","));
  if (lookup.lscCode) params.set("lsc", lookup.lscCode);
  return `/api/c/swimcloud?${params.toString()}`;
}

export function buildSwimCloudVerificationLink({
  links,
  institutionName,
  stateCode,
  gender,
  seasonLabel,
  event,
  course,
}: {
  links: PublicProgramLink[];
  institutionName: string;
  stateCode: string | null;
  gender: SwimCloudProgramGender;
  seasonLabel: string;
  event: string;
  course: Course;
}): SwimCloudVerificationLink {
  const teamId = swimCloudTeamIdFromLinks(links);
  const direct = teamId
    ? buildSwimCloudTeamTimesUrl({ teamId, gender, seasonLabel, event, course })
    : null;
  return {
    href: direct ?? buildSwimCloudTeamLookupUrl({ institutionName, stateCode }),
    kind: direct ? "direct" : "lookup",
    seasonLabel,
  };
}
