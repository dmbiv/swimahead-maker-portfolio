import "server-only";

import { searchMembers } from "./swims";
import { swimsSearchQueries } from "./roster-names";
import {
  resolveRosterSwimsMatches,
  type RosterIdentity,
  type RosterMatchResolution,
} from "./roster-swims-match";
import type { SwimsMember } from "./types";


const GOOD_ENOUGH_QUALITY = 60;

const MAX_MEMBERS_CONSIDERED = 4_000;

export type SwimsIdentityLookup = RosterMatchResolution & {
  members: SwimsMember[];
  queriesTried: string[];
};

export async function findSwimsIdentity(
  identity: RosterIdentity,
  options: { currentYear?: number; maxQueries?: number } = {},
): Promise<SwimsIdentityLookup> {
  const queries = swimsSearchQueries(identity.fullName, options.maxQueries ?? 5);
  const byMemberId = new Map<string, SwimsMember>();
  const queriesTried: string[] = [];
  let resolution = resolveRosterSwimsMatches(identity, [], options.currentYear);

  for (const { query } of queries) {
    let found: SwimsMember[] = [];
    try {
      found = await searchMembers(query, { currentOnly: false });
    } catch {
      continue;
    }
    queriesTried.push(query);
    for (const member of found) {
      if (byMemberId.size >= MAX_MEMBERS_CONSIDERED) break;
      byMemberId.set(member.memberId, member);
    }

    resolution = resolveRosterSwimsMatches(identity, [...byMemberId.values()], options.currentYear);
    if (resolution.bestQuality >= GOOD_ENOUGH_QUALITY) break;
  }

  return { ...resolution, members: [...byMemberId.values()], queriesTried };
}
