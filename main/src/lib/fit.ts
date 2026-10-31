import type { DB, EventCode, EventProfile, Gender, Program, SwimTime } from "./types";
import { canonicalEvent, EVENT_GROUPS, toSCYSeconds } from "./events";

export interface BestTime {
  event: EventCode;
  seconds: number;  
  converted: boolean;
  raw: SwimTime;
}

export function bestTimes(times: SwimTime[]): Map<EventCode, BestTime> {
  const best = new Map<EventCode, BestTime>();
  for (const t of times) {
    const scy = toSCYSeconds(t.event, t.course, t.seconds);
    const code = canonicalEvent(t.event, t.course);
    if (scy == null || !code) continue;
    const cur = best.get(code);
    if (!cur || scy < cur.seconds) {
      best.set(code, { event: code, seconds: scy, converted: t.course !== "SCY", raw: t });
    }
  }
  return best;
}

export interface EventFit {
  event: EventCode;
  mine: number;
  invite: number;
  score: number;
  aFinal: number;
  value: number;
  verdict: "A-final" | "Scorer" | "Invite" | "Close" | "Project";
}

export interface FitResult {
  programId: string;
  total: number;  
  swim: number;  
  academic: number;  
  need: number;  
  financial: number;  
  events: EventFit[];
  reasons: string[];
}

const ACT_TO_SAT_CONCORDANCE: Record<number, number> = {
  9: 590, 10: 630, 11: 670, 12: 710, 13: 760, 14: 800, 15: 850,
  16: 890, 17: 930, 18: 970, 19: 1010, 20: 1040, 21: 1080,
  22: 1110, 23: 1140, 24: 1180, 25: 1210, 26: 1240, 27: 1280,
  28: 1310, 29: 1340, 30: 1370, 31: 1400, 32: 1430, 33: 1460,
  34: 1500, 35: 1550, 36: 1590,
};

export function eventFit(mine: number, p: EventProfile): EventFit {
  let value: number;
  let verdict: EventFit["verdict"];
  if (mine <= p.aFinalTime) { value = 1; verdict = "A-final"; }
  else if (mine <= p.scoreTime) { value = 0.8 + 0.2 * (p.scoreTime - mine) / Math.max(0.01, p.scoreTime - p.aFinalTime); verdict = "Scorer"; }
  else if (mine <= p.inviteTime) { value = 0.5 + 0.3 * (p.inviteTime - mine) / Math.max(0.01, p.inviteTime - p.scoreTime); verdict = "Invite"; }
  else if (mine <= p.inviteTime * 1.03) { value = 0.25; verdict = "Close"; }
  else { value = Math.max(0, 0.15 - (mine / p.inviteTime - 1.03)); verdict = "Project"; }
  return { event: p.event, mine, invite: p.inviteTime, score: p.scoreTime, aFinal: p.aFinalTime, value: Math.min(1, value), verdict };
}

export function computeFit(
  db: Pick<DB, "eventProfiles" | "roster">,
  program: Program,
  gender: Gender,
  best: Map<EventCode, BestTime>,
  opts: {
    gpa?: number | null;
    sat?: number | null;
    act?: number | null;
    majors?: string[];
    gradYear?: number;
    maxAnnualCost?: number | null;
    includeFinancial?: boolean;
  },
): FitResult {
  const profiles = db.eventProfiles.filter((p) => p.programId === program.id && p.gender === gender);
  const fits: EventFit[] = [];
  for (const p of profiles) {
    const mine = best.get(p.event);
    if (mine) fits.push(eventFit(mine.seconds, p));
  }
  fits.sort((a, b) => b.value - a.value);
  const top = fits.slice(0, 3);
  const swim = top.length
    ? Math.round(100 * (top.reduce((s, f) => s + f.value, 0) / Math.max(2, top.length)))
    : 0;

  let academic = 50;
  const reasons: string[] = [];
  if (opts.gpa != null) {
    const demand = 2.6 + (1 - program.admitRate) * 1.6;  
    const diff = opts.gpa - demand;
    academic = Math.round(Math.max(0, Math.min(100, 60 + diff * 45)));
    const standardizedScores: number[] = [];
    if (opts.sat != null && program.satMid) {
      standardizedScores.push(Math.max(0, Math.min(100, 60 + ((opts.sat - program.satMid) / 60) * 10)));
    }
    if (opts.act != null && program.actMid) {
      standardizedScores.push(Math.max(0, Math.min(100, 60 + ((opts.act - program.actMid) / 1.5) * 10)));
    } else if (opts.act != null && program.satMid) {
      const equivalentSat = ACT_TO_SAT_CONCORDANCE[Math.round(opts.act)];
      if (equivalentSat) {
        standardizedScores.push(Math.max(0, Math.min(100, 60 + ((equivalentSat - program.satMid) / 60) * 10)));
      }
    }
    if (standardizedScores.length > 0) {
      academic = Math.round(academic * 0.6 + Math.max(...standardizedScores) * 0.4);
    }
    if (academic >= 75) reasons.push("Academics: comfortably in range");
    else if (academic >= 45) reasons.push("Academics: in reach");
    else reasons.push("Academics: a stretch - athletic support may matter");
  }

  let need = 40;
  if (top.length && opts.gradYear) {
    const myGroups = new Set(top.map((f) => EVENT_GROUPS[f.event]));
    const departing = db.roster.filter(
      (r) => r.programId === program.id && r.gender === gender &&
        r.gradYear <= opts.gradYear! && myGroups.has(r.group),
    ).length;
    const total = db.roster.filter((r) => r.programId === program.id && r.gender === gender).length;
    need = Math.round(Math.min(100, 30 + departing * 22));
    if (departing >= 2) reasons.push(`Roster need: ${departing} in your event group graduating before you arrive`);
    else if (departing === 1) reasons.push("Roster need: 1 spot opening in your group");
    else if (total > 0) reasons.push("Roster need: group is currently stocked");
  }

  let financial = 50;
  let financialReason = "Cost estimate: add an annual cost ceiling for a personalized score";
  if (opts.maxAnnualCost != null && Number.isFinite(opts.maxAnnualCost)) {
    const ceiling = Math.max(0, Math.round(opts.maxAnnualCost));
    const estimatedCost = Math.max(0, program.netPrice);
    const overage = Math.max(0, estimatedCost - ceiling);
    financial = overage === 0
      ? 100
      : Math.round(Math.max(0, 100 - (overage / Math.max(1, ceiling)) * 100));
    if (overage === 0) {
      financialReason = `Cost estimate: average net-price estimate ($${estimatedCost.toLocaleString("en-US")}) is within the saved $${ceiling.toLocaleString("en-US")} ceiling`;
    } else {
      financialReason = `Cost estimate: average net-price estimate is $${overage.toLocaleString("en-US")} above the saved annual ceiling`;
    }
  }
  const includeFinancial = opts.includeFinancial !== false;
  if (includeFinancial) reasons.push(financialReason);

  for (const f of top) {
    if (f.verdict === "A-final") reasons.unshift(`${f.event}: A-final caliber for their conference meet`);
    else if (f.verdict === "Scorer") reasons.unshift(`${f.event}: would score at their conference meet`);
    else if (f.verdict === "Invite") reasons.unshift(`${f.event}: travel-squad range`);
  }

  const total = includeFinancial
    ? Math.round(swim * 0.5 + academic * 0.2 + need * 0.15 + financial * 0.15)
    : Math.round((swim * 0.5 + academic * 0.2 + need * 0.15) / 0.85);
  const visibleReasons = reasons.filter((reason) => reason !== financialReason).slice(0, 3);
  if (includeFinancial) visibleReasons.push(financialReason);
  return { programId: program.id, total, swim, academic, need, financial, events: fits, reasons: visibleReasons };
}

export function fitTier(total: number): { label: string; tone: "great" | "good" | "ok" | "low" } {
  if (total >= 75) return { label: "Strong match", tone: "great" };
  if (total >= 55) return { label: "Good match", tone: "good" };
  if (total >= 35) return { label: "Reach", tone: "ok" };
  return { label: "Long shot", tone: "low" };
}
