import "server-only";

import { createClient } from "./supabase/server";
import { EVENT_ORDER } from "./events";
import { performanceScore } from "./performance-points";
import { fmtClock } from "./time";
import {
  clampConferencePlace,
  type ConferenceMeetCoverage,
  type ConferencePlaceTarget,
} from "./conference-place-defs";
import type { EventCode, Gender } from "./types";


type PlaceRow = {
  event_code: string;
  course: string;
  place: number;
  time_ms: number;
  field_size: number;
  season_label: string;
  meet_date: string | null;
  evidence_url: string | null;
  conference_name: string | null;
};

const EVENT_CODES = new Set<string>(EVENT_ORDER);

function genderKey(gender: Gender): "men" | "women" {
  return gender === "F" ? "women" : "men";
}

export async function conferencePlaceTargets(input: {
  athleticProgramId: string;
  gender: Gender;
  place: number;
  events?: readonly EventCode[];
}): Promise<ConferencePlaceTarget[]> {
  const place = clampConferencePlace(input.place);
  const events = input.events?.length ? [...new Set(input.events)] : null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("conference_place_times", {
    p_athletic_program_id: input.athleticProgramId,
    p_gender: genderKey(input.gender),
    p_place: place,
    p_course: "SCY",
    p_events: events,
  });
  if (error) throw new Error(`Could not read conference place times: ${error.message}`);

  return ((data ?? []) as PlaceRow[]).flatMap((row) => {
    if (!EVENT_CODES.has(row.event_code)) return [];
    const seconds = Number(row.time_ms) / 1_000;
    if (!Number.isFinite(seconds) || seconds <= 0) return [];
    const event = row.event_code as EventCode;
    return [{
      event,
      place: Number(row.place),
      seconds,
      time: fmtClock(seconds),
      targetScore: performanceScore({ event, course: "SCY", seconds }, input.gender)?.value ?? null,
      fieldSize: Number(row.field_size),
      seasonLabel: row.season_label,
      meetDate: row.meet_date,
      evidenceUrl: row.evidence_url,
      conferenceName: row.conference_name,
    }];
  });
}

export async function conferenceMeetCoverage(input: {
  athleticProgramId: string;
  gender: Gender;
}): Promise<ConferenceMeetCoverage> {
  const winners = await conferencePlaceTargets({ ...input, place: 1 });
  const events = EVENT_ORDER.flatMap((event) => {
    const winner = winners.find((row) => row.event === event);
    return winner ? [{ event, fieldSize: winner.fieldSize }] : [];
  });
  return {
    conferenceName: winners[0]?.conferenceName ?? null,
    seasonLabel: winners[0]?.seasonLabel ?? null,
    meetDate: winners[0]?.meetDate ?? null,
    events,
  };
}
