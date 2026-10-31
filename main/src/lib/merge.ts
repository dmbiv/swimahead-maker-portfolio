import type { CoachSettings, Program, Recruit, SwimTime } from "./types";
import { bestTimes } from "./fit";
import { fmtClock } from "./time";
import { EVENT_LABELS } from "./events";
import type { EventCode } from "./types";

export const MERGE_FIELDS = [
  "first_name", "last_name", "full_name", "club", "state", "grad_year",
  "best_events", "best_times_line", "gpa",
  "program_name", "program_short", "coach_name", "coach_email",
] as const;

export type MergeField = (typeof MERGE_FIELDS)[number];

export interface MergeContext {
  recruit: Recruit;
  times: SwimTime[];
  program: Program;
  settings: CoachSettings;
}

export function mergeValues(ctx: MergeContext): Record<MergeField, string> {
  const best = bestTimes(ctx.times);
  const top = [...best.values()].sort((a, b) => a.seconds / baseline(a.event) - b.seconds / baseline(b.event)).slice(0, 3);
  const line = top.map((b) => `${EVENT_LABELS[b.event]} ${fmtClock(b.seconds)}${b.converted ? "c" : ""}`).join(", ");
  return {
    first_name: ctx.recruit.firstName,
    last_name: ctx.recruit.lastName,
    full_name: `${ctx.recruit.firstName} ${ctx.recruit.lastName}`,
    club: ctx.recruit.club || "your club",
    state: ctx.recruit.state,
    grad_year: String(ctx.recruit.gradYear),
    best_events: top.map((b) => EVENT_LABELS[b.event]).join(" / ") || "your events",
    best_times_line: line || "your best times",
    gpa: ctx.recruit.gpa != null ? ctx.recruit.gpa.toFixed(2) : "",
    program_name: ctx.program.name,
    program_short: ctx.program.shortName,
    coach_name: ctx.settings.coachName,
    coach_email: ctx.settings.coachEmail,
  };
}

function baseline(e: EventCode): number {
  const b: Partial<Record<EventCode, number>> = {
    "50FR": 20, "100FR": 44, "200FR": 97, "500FR": 262, "1000FR": 545, "1650FR": 905,
    "100BK": 48, "200BK": 105, "100BR": 54, "200BR": 118, "100FL": 48, "200FL": 107,
    "200IM": 108, "400IM": 232,
  };
  return b[e] ?? 100;
}

export function renderWithValues(text: string, v: Record<string, string>): string {
  return text.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (m, key: string) => (key in v ? v[key] : m));
}

export function renderTemplate(text: string, ctx: MergeContext): string {
  return renderWithValues(text, mergeValues(ctx));
}

export function missingFields(text: string, v: Record<string, string>): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/g)) {
    if (!(m[1] in v)) out.push(`unknown: ${m[1]}`);
    else if (!v[m[1]]) out.push(m[1]);
  }
  return [...new Set(out)];
}
