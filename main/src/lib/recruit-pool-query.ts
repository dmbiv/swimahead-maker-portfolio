import "server-only";

import { createClient } from "./supabase/server";
import type { RecruitTimeDirection } from "./recruit-controls";
import type { SwimsProspect } from "./swims";
import type { Gender } from "./types";

export const CURRENT_SEASON_KEY = 155;

type ProspectRow = {
  member_id: string;
  full_name: string;
  seconds: number;
  swim_time: string;
  power_points: number | null;
  swim_age: number | null;
  swim_date: string | null;
  lsc_code: string | null;
  club_name: string | null;
  club_code: string | null;
  meet_name: string | null;
};

export async function queryProspectPool(input: {
  gender: Gender;
  event: string;
  seasonKey: number;
  minAge: number;
  maxAge: number;
  lscCode: string | null;
  targetSeconds: number | null;
  timeDirection: RecruitTimeDirection;
  limit?: number;
  excludeMemberIds?: readonly string[];
}): Promise<SwimsProspect[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_recruit_prospects_ranked", {
    p_gender: input.gender,
    p_event: input.event,
    p_season_key: input.seasonKey,
    p_min_age: input.minAge,
    p_max_age: input.maxAge,
    p_lsc_code: input.lscCode,
    p_target_seconds: input.targetSeconds,
    p_time_direction: input.timeDirection,
    p_limit: input.limit ?? 400,
    ...(input.excludeMemberIds?.length ? { p_exclude_member_ids: [...input.excludeMemberIds] } : {}),
  });
  if (error) throw new Error(`Could not search the recruit pool: ${error.message}`);

  return ((data ?? []) as ProspectRow[]).map((row, index) => ({
    rank: index + 1,
    memberId: row.member_id,
    fullName: row.full_name,
    lsc: row.lsc_code ?? "",
    club: row.club_name ?? "",
    clubCode: row.club_code?.trim().toUpperCase() || null,
    age: row.swim_age,
    powerPoints: row.power_points,
    time: row.swim_time,
    seconds: Number(row.seconds),
    meetId: null,  
    meet: row.meet_name,
    swimDate: row.swim_date,
  }));
}
