import "server-only";

import { randomUUID } from "node:crypto";
import { createAdminClient } from "./supabase/admin";
import { topTimes, SwimsPendingError, SwimsRateLimitError, SWIMS_EVENT_IDS } from "./swims";
import { performanceScoreToSeconds } from "./performance-points";
import { LSC_CODES } from "./swims-pool";
import type { EventCode, Gender } from "./types";
import type { SwimsProspect } from "./swims";


export const BOARD_ROW_CAP = 25;

export const DEFAULT_FLOOR_POINTS = 600;

const SWEEP_AGES = [14, 15, 16, 17, 18];
const GENDERS: Gender[] = ["M", "F"];
const SWEEP_EVENTS = Object.keys(SWIMS_EVENT_IDS) as EventCode[];

const configuredSeasonKey = Number(process.env.SWIMS_SEASON_KEY ?? "155");
export const SWEEP_SEASON_KEY = Number.isInteger(configuredSeasonKey) && configuredSeasonKey > 0
  ? configuredSeasonKey
  : 155;

const CALL_HEADROOM_MS = 15_000;

export type CoverageCell = {
  id: string;
  event: string;
  gender: Gender;
  season_key: number;
  swim_age: number;
  lsc_code: string;
  floor_points: number;
  lease_token: string;
};

export type MeetWindow = {
  meet_id: string;
  meet_name: string;
  first_date: string;
  last_date: string;
  density: number;
};

function admin() {
  return createAdminClient();
}

export function seasonWindows(seasonStart: string, seasonEnd: string, count = 6): [string, string][] {
  const start = Date.parse(`${seasonStart}T00:00:00Z`);
  const end = Date.parse(`${seasonEnd}T00:00:00Z`);
  const span = Math.max(1, Math.round((end - start) / 86_400_000));
  const step = Math.max(1, Math.ceil(span / count));
  const windows: [string, string][] = [];
  for (let offset = 0; offset < span; offset += step) {
    const from = new Date(start + offset * 86_400_000).toISOString().slice(0, 10);
    const toMs = Math.min(end, start + (offset + step - 1) * 86_400_000);
    windows.push([from, new Date(toMs).toISOString().slice(0, 10)]);
  }
  return windows;
}

export const CALENDAR_PROBE_EVENTS: EventCode[] = ["50FR", "100BR", "200IM"];
export const CALENDAR_PROBE_AGES = [16, 17];

export async function harvestMeetCalendar(input: {
  lscCode: string;
  seasonKey?: number;
  seasonStart: string;
  seasonEnd: string;
  deadlineMs?: number;
}): Promise<number> {
  const seasonKey = input.seasonKey ?? SWEEP_SEASON_KEY;
  const deadline = Date.now() + Math.max(1_000, input.deadlineMs ?? 120_000);
  const windows = seasonWindows(input.seasonStart, input.seasonEnd);
  const meets = new Map<string, { meet_id: string; meet_name: string; first_date: string; last_date: string; density: number }>();

  for (const event of CALENDAR_PROBE_EVENTS) {
    const eventId = SWIMS_EVENT_IDS[event];
    if (!eventId) continue;
    for (const age of CALENDAR_PROBE_AGES) {
      for (const [startDate, endDate] of windows) {
        if (Date.now() + CALL_HEADROOM_MS > deadline) break;
        let board: SwimsProspect[];
        try {
          board = await topTimes({
            eventId, gender: "M", seasonKey, minAge: age, maxAge: age,
            lscCode: input.lscCode, startDate, endDate,
          }, { forceRefresh: false, allowStale: true, waitMs: 10_000, priority: 20 });
        } catch (error) {
          if (error instanceof SwimsRateLimitError) return persistCalendar(input.lscCode, seasonKey, meets);
          continue;
        }
        for (const row of board) {
          if (!row.meetId || !row.meet || !row.swimDate) continue;
          const prior = meets.get(row.meetId);
          if (!prior) {
            meets.set(row.meetId, {
              meet_id: row.meetId, meet_name: row.meet,
              first_date: row.swimDate, last_date: row.swimDate, density: 1,
            });
          } else {
            prior.density += 1;
            if (row.swimDate < prior.first_date) prior.first_date = row.swimDate;
            if (row.swimDate > prior.last_date) prior.last_date = row.swimDate;
          }
        }
      }
    }
  }
  return persistCalendar(input.lscCode, seasonKey, meets);
}

async function persistCalendar(
  lscCode: string,
  seasonKey: number,
  meets: Map<string, { meet_id: string; meet_name: string; first_date: string; last_date: string; density: number }>,
): Promise<number> {
  if (meets.size === 0) return 0;
  const { error } = await admin().rpc("record_swims_meet_calendar", {
    p_lsc_code: lscCode,
    p_season_key: seasonKey,
    p_rows: [...meets.values()],
  });
  if (error) throw new Error(`Could not record meet calendar: ${error.message}`);
  return meets.size;
}

export async function meetWindowsFor(lscCode: string, seasonKey = SWEEP_SEASON_KEY): Promise<MeetWindow[]> {
  const { data, error } = await admin().rpc("swims_meet_windows", {
    p_lsc_code: lscCode, p_season_key: seasonKey, p_limit: 200,
  });
  if (error) throw new Error(`Could not read meet calendar: ${error.message}`);
  return (data ?? []) as MeetWindow[];
}

export async function ensureCoverageCells(floorPoints = DEFAULT_FLOOR_POINTS): Promise<number> {
  const rows: {
    event: string; gender: Gender; season_key: number; swim_age: number;
    lsc_code: string; floor_points: number; priority: number;
  }[] = [];
  for (const event of SWEEP_EVENTS) {
    for (const gender of GENDERS) {
      for (const age of SWEEP_AGES) {
        for (const lsc of LSC_CODES) {
          rows.push({
            event, gender, season_key: SWEEP_SEASON_KEY, swim_age: age,
            lsc_code: lsc, floor_points: floorPoints,
            priority: age >= 17 ? 10 : age === 16 ? 50 : 100,
          });
        }
      }
    }
  }

  let inserted = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const { error, count } = await admin()
      .from("recruit_coverage_cells")
      .upsert(rows.slice(i, i + 500), {
        onConflict: "event,gender,season_key,swim_age,lsc_code",
        ignoreDuplicates: true,
        count: "exact",
      });
    if (error) throw new Error(`Could not seed coverage cells: ${error.message}`);
    if (count) inserted += count;
  }
  return inserted;
}

async function claimCells(limit: number, workerId: string): Promise<CoverageCell[]> {
  const { data, error } = await admin().rpc("claim_recruit_coverage_cells", {
    p_worker_id: workerId, p_limit: limit, p_lease_seconds: 600,
  });
  if (error) throw new Error(`Could not claim coverage cells: ${error.message}`);
  return (data ?? []) as CoverageCell[];
}

export type CellSweepResult = {
  coveredToSeconds: number | null;
  saturated: boolean;
  saturatedWindows: number;
  discovered: number;
  requests: number;
};

export async function sweepCell(
  cell: CoverageCell,
  windows: readonly MeetWindow[],
  deadline: number,
): Promise<CellSweepResult> {
  const eventId = SWIMS_EVENT_IDS[cell.event];
  if (!eventId) throw new Error(`Unknown SWIMS event id for ${cell.event}`);

  const floorSeconds = performanceScoreToSeconds(
    { event: cell.event, course: "SCY", points: cell.floor_points },
    cell.gender,
  );

  let coveredToSeconds: number | null = null;
  let saturatedWindows = 0;
  let discovered = 0;
  let requests = 0;

  for (const window of windows) {
    if (Date.now() + CALL_HEADROOM_MS > deadline) break;

    const board = await topTimes({
      eventId,
      gender: cell.gender,
      seasonKey: cell.season_key,
      minAge: cell.swim_age,
      maxAge: cell.swim_age,
      lscCode: cell.lsc_code,
      startDate: window.first_date,
      endDate: window.last_date,
    }, { forceRefresh: true, allowStale: false, waitMs: 10_000, priority: cell.swim_age >= 17 ? 10 : 50 });
    requests += 1;

    if (board.length > 0) {
      discovered += await recordDiscovery(cell, window, board);
    }

    const slowest = board.length > 0 ? board[board.length - 1].seconds : null;
    const exhausted = board.length < BOARD_ROW_CAP;
    const pastFloor = slowest != null && floorSeconds != null && slowest > floorSeconds;

    if (exhausted) {
      if (slowest != null) coveredToSeconds = Math.max(coveredToSeconds ?? 0, slowest);
    } else if (pastFloor) {
      if (slowest != null) coveredToSeconds = Math.max(coveredToSeconds ?? 0, slowest);
    } else {
      saturatedWindows += 1;
      if (slowest != null) coveredToSeconds = Math.max(coveredToSeconds ?? 0, slowest);
    }
  }

  return { coveredToSeconds, saturated: saturatedWindows > 0, saturatedWindows, discovered, requests };
}

async function recordDiscovery(
  cell: CoverageCell,
  window: MeetWindow,
  board: readonly SwimsProspect[],
): Promise<number> {
  const valid = board.filter((row) => /^[A-Za-z0-9]{6,20}$/.test(row.memberId));
  if (valid.length === 0) return 0;
  const client = admin();

  const { data, error } = await client.rpc("record_recruit_discovery", {
    p_season_key: cell.season_key,
    p_event: cell.event,
    p_gender: cell.gender,
    p_swim_age: cell.swim_age,
    p_lsc_code: cell.lsc_code,
    p_window_start: window.first_date,
    p_window_end: window.last_date,
    p_rows: valid.map((row) => ({
      member_id: row.memberId,
      full_name: row.fullName,
      club_name: row.club,
      club_code: row.clubCode,
    })),
  });
  if (error) throw new Error(`Could not record discovery: ${error.message}`);

  const prospectRows = valid
    .filter((row) => row.seconds != null)
    .map((row) => ({
      memberId: row.memberId,
      fullName: row.fullName,
      gender: cell.gender,
      event: cell.event,
      seasonKey: cell.season_key,
      seconds: row.seconds,
      swimTime: row.time,
      powerPoints: row.powerPoints,
      age: row.age,
      date: row.swimDate,
      lsc: row.lsc,
      club: row.club,
      clubCode: row.clubCode,
      meet: row.meet,
    }));
  if (prospectRows.length > 0) {
    const { error: poolError } = await client.rpc("upsert_recruit_prospects", { p_rows: prospectRows });
    if (poolError) throw new Error(`Could not store recruit prospects: ${poolError.message}`);
  }

  const sightingRows = valid
    .filter((row) => row.age != null && row.swimDate)
    .map((row) => ({
      memberId: row.memberId,
      fullName: row.fullName,
      gender: cell.gender,
      age: row.age,
      date: row.swimDate,
      lsc: row.lsc,
      club: row.club,
      clubCode: row.clubCode,
      meet: row.meet,
    }));
  if (sightingRows.length > 0) {
    await client.rpc("record_swims_sightings", { p_rows: sightingRows });
  }

  return typeof data === "number" ? data : 0;
}

async function finishCell(
  cell: CoverageCell,
  result: CellSweepResult | null,
  retryAfterSeconds: number,
  errorMessage: string | null,
): Promise<void> {
  const { error } = await admin().rpc("finish_recruit_coverage_cell", {
    p_cell_id: cell.id,
    p_lease_token: cell.lease_token,
    p_covered_to_seconds: result?.coveredToSeconds ?? null,
    p_saturated: result?.saturated ?? false,
    p_saturated_windows: result?.saturatedWindows ?? 0,
    p_retry_after_seconds: retryAfterSeconds,
    p_error_message: errorMessage?.slice(0, 500) ?? null,
  });
  if (error) throw new Error(`Could not finish coverage cell: ${error.message}`);
}

async function releaseCell(cell: CoverageCell, retryAfterSeconds: number): Promise<void> {
  const { error } = await admin().rpc("release_recruit_coverage_cell", {
    p_cell_id: cell.id, p_lease_token: cell.lease_token, p_retry_after_seconds: retryAfterSeconds,
  });
  if (error) throw new Error(`Could not release coverage cell: ${error.message}`);
}

export type DiscoveryTickResult = {
  cellsSwept: number;
  discovered: number;
  requests: number;
  saturatedCells: number;
  rateLimited: boolean;
  budgetExhausted: boolean;
};

export async function discoveryTick(input: {
  cellLimit?: number;
  deadlineMs?: number;
  seasonStart: string;
  seasonEnd: string;
}): Promise<DiscoveryTickResult> {
  const workerId = `coverage-${randomUUID()}`;
  const deadline = Date.now() + Math.max(1_000, input.deadlineMs ?? 240_000);
  const cellLimit = Math.max(1, Math.min(40, input.cellLimit ?? 8));

  const calendars = new Map<string, MeetWindow[]>();
  let cellsSwept = 0;
  let discovered = 0;
  let requests = 0;
  let saturatedCells = 0;
  let rateLimited = false;

  while (cellsSwept < cellLimit && Date.now() + CALL_HEADROOM_MS <= deadline) {
    const cells = await claimCells(Math.min(4, cellLimit - cellsSwept), workerId);
    if (cells.length === 0) break;  

    for (const cell of cells) {
      if (Date.now() + CALL_HEADROOM_MS > deadline) {
        await releaseCell(cell, 0).catch(() => undefined);
        continue;
      }
      try {
        let windows = calendars.get(cell.lsc_code);
        if (!windows) {
          windows = await meetWindowsFor(cell.lsc_code, cell.season_key);
          if (windows.length === 0) {
            await harvestMeetCalendar({
              lscCode: cell.lsc_code,
              seasonKey: cell.season_key,
              seasonStart: input.seasonStart,
              seasonEnd: input.seasonEnd,
              deadlineMs: Math.max(1_000, deadline - Date.now()),
            });
            windows = await meetWindowsFor(cell.lsc_code, cell.season_key);
          }
          calendars.set(cell.lsc_code, windows);
        }

        if (windows.length === 0) {
          await finishCell(cell, null, 6 * 60 * 60, "No meet calendar available");
          cellsSwept += 1;
          continue;
        }

        const result = await sweepCell(cell, windows, deadline);
        requests += result.requests;
        discovered += result.discovered;
        if (result.saturated) saturatedCells += 1;
        await finishCell(cell, result, result.saturated ? 24 * 60 * 60 : 7 * 24 * 60 * 60, null);
        cellsSwept += 1;
      } catch (error) {
        if (error instanceof SwimsRateLimitError) {
          rateLimited = true;
          const retry = Math.max(60, Math.ceil((error.retryAfterMs ?? 60_000) / 1_000));
          await releaseCell(cell, retry).catch(() => undefined);
          return {
            cellsSwept, discovered, requests, saturatedCells, rateLimited,
            budgetExhausted: false,
          };
        }
        if (error instanceof SwimsPendingError) {
          await releaseCell(cell, Math.max(5, Math.ceil(error.retryAfterMs / 1_000))).catch(() => undefined);
          continue;
        }
        const message = error instanceof Error ? error.message : "Unknown sweep failure";
        await finishCell(cell, null, 15 * 60, message).catch(() => undefined);
        cellsSwept += 1;
      }
    }
  }

  return {
    cellsSwept, discovered, requests, saturatedCells, rateLimited,
    budgetExhausted: cellsSwept < cellLimit && Date.now() + CALL_HEADROOM_MS > deadline,
  };
}

export type CoverageRow = {
  lsc_code: string;
  covered_to_seconds: number | null;
  saturated: boolean;
  swept_at: string | null;
};

export async function coverageFor(input: {
  event: string;
  gender: Gender;
  seasonKey: number;
  minAge: number;
  maxAge: number;
  lscCode?: string | null;
}): Promise<CoverageRow[]> {
  const { data, error } = await admin().rpc("recruit_coverage_for", {
    p_event: input.event,
    p_gender: input.gender,
    p_season_key: input.seasonKey,
    p_min_age: input.minAge,
    p_max_age: input.maxAge,
    p_lsc_code: input.lscCode ?? null,
  });
  if (error) return [];
  return (data ?? []) as CoverageRow[];
}
