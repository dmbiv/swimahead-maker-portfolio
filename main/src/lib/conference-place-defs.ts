import type { EventCode } from "./types";


export const CONFERENCE_PLACE_MAX = 24;
export const CONFERENCE_PLACE_MIN = 1;
export const DEFAULT_CONFERENCE_PLACE = 3;

export function clampConferencePlace(value: unknown): number {
  const place = Math.round(Number(value));
  if (!Number.isFinite(place)) return DEFAULT_CONFERENCE_PLACE;
  return Math.max(CONFERENCE_PLACE_MIN, Math.min(CONFERENCE_PLACE_MAX, place));
}

export type ConferencePlaceTarget = {
  event: EventCode;
  place: number;
  seconds: number;
  time: string;
  targetScore: number | null;
  fieldSize: number;
  seasonLabel: string;
  meetDate: string | null;
  evidenceUrl: string | null;
  conferenceName: string | null;
};

export type ConferenceMeetCoverage = {
  conferenceName: string | null;
  seasonLabel: string | null;
  meetDate: string | null;
  events: { event: EventCode; fieldSize: number }[];
};
