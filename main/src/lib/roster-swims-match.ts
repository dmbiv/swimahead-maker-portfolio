import { normalizeRosterName, type RosterClassStanding } from "./roster-text";
import { givenNamesMatch, nameParts, surnamesMatch } from "./roster-names";
import type { SwimsMember } from "./types";

export type RosterMatchCandidate = SwimsMember & {
  matchScore: number;
  matchSignals: string[];
  matchStrength: "strong" | "review" | "weak";
};

export type RosterMatchResolution = {
  candidates: RosterMatchCandidate[];
  automaticMemberId: string | null;
  bestQuality: number;
};

export type RosterIdentity = {
  fullName: string;
  classYear: number | null;
  classStanding: RosterClassStanding | null;
  hometown: string | null;
};

const STATE_LSCS: Record<string, readonly string[]> = {
  AL: ["SE"], AK: ["AK"], AZ: ["AZ"], AR: ["AR"],
  CA: ["CA", "CC", "PC", "SI", "SN"], CO: ["CO"], CT: ["CT"], DC: ["PV"],
  DE: ["MA"], FL: ["FL", "FG"], GA: ["GA"], HI: ["HI"],
  ID: ["SR", "IE"], IL: ["IL"], IN: ["IN"], IA: ["IA"], KS: ["MW", "MV"],
  KY: ["KY"], LA: ["LA"], ME: ["ME"], MD: ["MD", "PV"], MA: ["NE"],
  MI: ["MI"], MN: ["MN"], MS: ["MS"], MO: ["OZ", "MV"], MT: ["MT"],
  NE: ["MW"], NV: ["SN", "CA", "PC"], NH: ["NE"], NJ: ["NJ"], NM: ["NM"],
  NY: ["AD", "MR", "NI"], NC: ["NC"], ND: ["ND"],
  OH: ["OH", "OHO", "LE"], OK: ["OK"], OR: ["OR"], PA: ["AM", "MA"],
  RI: ["NE"], SC: ["SC"], SD: ["SD"], TN: ["SE"],
  TX: ["BD", "GU", "NT", "ST", "WT"], UT: ["UT"], VT: ["NE", "AD"],
  VA: ["VA", "PV"], WA: ["PN", "IE"], WV: ["WV"], WI: ["WI"], WY: ["WY"],
};

function nameQuality(rosterName: string, member: SwimsMember): number {
  const roster = normalizeRosterName(rosterName);
  const aliases = [member.shortName, member.fullName]
    .map(normalizeRosterName)
    .filter(Boolean);
  if (aliases.includes(roster)) return 100;

  const parts = nameParts(rosterName);
  if (!parts) return 0;

  let best = 0;
  for (const alias of aliases) {
    const aliasParts = nameParts(alias);
    if (!aliasParts) continue;
    if (!surnamesMatch(parts.last, aliasParts.last)) continue;

    const candidates = [aliasParts.first, ...aliasParts.middle];
    if (candidates.includes(parts.first)) best = Math.max(best, 85);
    else if (candidates.some((candidate) => givenNamesMatch(parts.first, candidate))) best = Math.max(best, 70);
    else best = Math.max(best, 40);
  }
  return best;
}

function stateFromHometown(hometown: string | null): string | null {
  return hometown?.match(/,\s*([A-Z]{2})\s*$/)?.[1] ?? null;
}

function expectedAgeRange(identity: RosterIdentity, currentYear: number): [number, number] | null {
  if (identity.classYear != null) {
    return [currentYear - identity.classYear + 21, currentYear - identity.classYear + 22];
  }
  if (identity.classStanding === "FR") return [17, 20];
  if (identity.classStanding === "SO") return [18, 21];
  if (identity.classStanding === "JR") return [19, 22];
  if (identity.classStanding === "SR") return [20, 24];
  if (identity.classStanding === "GR") return [21, 26];
  return null;
}

export function resolveRosterSwimsMatches(
  identity: RosterIdentity,
  members: readonly SwimsMember[],
  currentYear = new Date().getUTCFullYear(),
): RosterMatchResolution {
  const expectedAges = expectedAgeRange(identity, currentYear);
  const homeState = stateFromHometown(identity.hometown);
  const likelyLscs = new Set(homeState ? STATE_LSCS[homeState] ?? [homeState] : []);

  const scored = members.map((member) => {
    const quality = nameQuality(identity.fullName, member);
    let score = quality;
    const signals: string[] = [];
    if (quality >= 100) signals.push("name matches");
    else if (quality >= 80) signals.push("first and last name match");
    else if (quality >= 60) signals.push("legal name matches this nickname");
    else if (quality >= 40) signals.push("last name only");

    if (member.age != null && expectedAges) {
      const [minAge, maxAge] = expectedAges;
      if (member.age >= minAge && member.age <= maxAge) {
        score += 35;
        signals.push(`age ${member.age} fits ${identity.classStanding ?? `class of ${identity.classYear}`}`);
      } else {
        const distance = member.age < minAge ? minAge - member.age : member.age - maxAge;
        if (distance === 1) score += 8;
        else if (distance >= 3) score -= 30;
      }
    }

    if (homeState && member.lsc && likelyLscs.has(member.lsc.toUpperCase())) {
      score += 35;
      signals.push(`${member.lsc.toUpperCase()} matches ${identity.hometown}`);
    }
    if (member.isNcaa) score += 5;

    return { member, quality, score, signals };
  });

  const compatible = scored.filter((candidate) => candidate.quality >= 60);
  const pool = compatible.length > 0 ? compatible : scored.filter((candidate) => candidate.quality >= 40);
  pool.sort((left, right) => right.score - left.score || right.quality - left.quality || left.member.fullName.localeCompare(right.member.fullName));

  const top = pool[0];
  const runnerUp = pool[1];
  const margin = top ? top.score - (runnerUp?.score ?? 0) : 0;
  const automatic = top && (
    (pool.length === 1 && (top.quality === 100 || (top.quality >= 60 && top.score >= 120)))
    || (top.quality >= 85 && top.score >= 135 && margin >= 25)
    || (top.quality >= 70 && top.score >= 135 && margin >= 60)
  ) ? top.member.memberId : null;

  return {
    automaticMemberId: automatic,
    bestQuality: scored.reduce((best, candidate) => Math.max(best, candidate.quality), 0),
    candidates: pool.slice(0, 8).map(({ member, score, signals }, index) => ({
      ...member,
      matchScore: score,
      matchSignals: signals,
      matchStrength: automatic === member.memberId
        ? "strong"
        : index === 0 && score >= 100
          ? "review"
          : "weak",
    })),
  };
}
