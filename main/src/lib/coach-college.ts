import "server-only";

import { cache } from "react";
import { createClient } from "./supabase/server";
import { buildSwimCloudTeamRosterUrl, swimCloudTeamIdFromUrl } from "./swimcloud-links";
import type { WorkspaceMembership } from "./auth";

export type CoachCollege = {
  id: string;
  athleticProgramId: string;
  institutionId: string;
  name: string;
  division: string | null;
  squad: "men" | "women" | "coed";
  city: string | null;
  stateCode: string | null;
  latitude: number | null;
  longitude: number | null;
};

type Row = {
  id: string;
  athletic_program_id: string;
  athletic_programs: {
    id: string;
    division: string | null;
    gender: string;
    institution_id: string;
    institutions:
      | { id: string; canonical_name: string; city: string | null; state_code: string | null; latitude: number | null; longitude: number | null }
      | { id: string; canonical_name: string; city: string | null; state_code: string | null; latitude: number | null; longitude: number | null }[]
      | null;
  } | null;
};

function toCollege(row: Row): CoachCollege | null {
  const ap = row.athletic_programs;
  if (!ap) return null;
  const inst = Array.isArray(ap.institutions) ? ap.institutions[0] : ap.institutions;
  const squad = ap.gender === "women" || ap.gender === "coed" ? ap.gender : "men";
  return {
    id: row.id,
    athleticProgramId: ap.id,
    institutionId: ap.institution_id,
    name: inst?.canonical_name ?? "My program",
    division: ap.division,
    squad,
    city: inst?.city ?? null,
    stateCode: inst?.state_code ?? null,
    latitude: inst?.latitude ?? null,
    longitude: inst?.longitude ?? null,
  };
}

const SELECT =
  "id,athletic_program_id,athletic_programs(id,division,gender,institution_id,institutions(id,canonical_name,city,state_code,latitude,longitude))";

const collegesForWorkspace = cache(async (workspaceId: string): Promise<CoachCollege[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("workspace_colleges")
    .select(SELECT)
    .eq("workspace_id", workspaceId)
    .order("created_at");
  return ((data ?? []) as unknown as Row[]).map(toCollege).filter((c): c is CoachCollege => c !== null);
});

export function listCoachColleges(
  membership: Pick<WorkspaceMembership, "workspaceId">,
): Promise<CoachCollege[]> {
  return collegesForWorkspace(membership.workspaceId);
}

export async function getCoachCollege(
  membership: Pick<WorkspaceMembership, "workspaceId">,
  collegeId?: string | null,
): Promise<CoachCollege | null> {
  const colleges = await listCoachColleges(membership);
  if (colleges.length === 0) return null;
  if (collegeId) return colleges.find((c) => c.id === collegeId) ?? null;
  return colleges[0];
}

export async function getCollegeSwimCloudRosterUrl(
  college: Pick<CoachCollege, "athleticProgramId">,
): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("verified_program_links")
    .select("url")
    .eq("athletic_program_id", college.athleticProgramId)
    .eq("link_type", "swimcloud")
    .in("verification_status", ["verified", "needs_review"])
    .limit(1);

  const url = (data as { url: string }[] | null)?.[0]?.url;
  if (!url) return null;
  const teamId = swimCloudTeamIdFromUrl(url);
  if (!teamId) return null;
  return buildSwimCloudTeamRosterUrl(teamId);
}
