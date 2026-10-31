
export type ClassConfidence = "exact" | "high" | "estimated";

export type ClassInference = {
  gradClass: number;
  confidence: ClassConfidence;
  range: [number, number];
  basis: string;
  birthYear: number | null;
  birthWindow: { after: string; onOrBefore: string } | null;
  sightingCount: number;
};

export type Sighting = {
  age: number;
  date: string;
  meet?: string | null;
};

const DAY_MS = 86_400_000;

const MEET_AGE_SLACK_DAYS = 7;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function toEpoch(iso: string): number {
  const [year, month, day] = iso.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function toIso(epoch: number): string {
  return new Date(epoch).toISOString().slice(0, 10);
}

function shiftDays(iso: string, days: number): string {
  return toIso(toEpoch(iso) + days * DAY_MS);
}

function shiftYears(iso: string, years: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  return toIso(Date.UTC(year - years, month - 1, day));
}

export function classFromBirthDate(iso: string): number {
  const year = Number(iso.slice(0, 4));
  const month = Number(iso.slice(5, 7));
  return year + 18 + (month >= 9 ? 1 : 0);
}

function cutoffWithin(earliest: string, latest: string): string | null {
  for (let year = Number(earliest.slice(0, 4)); year <= Number(latest.slice(0, 4)); year += 1) {
    const cutoff = `${year}-09-01`;
    if (cutoff >= earliest && cutoff <= latest) return cutoff;
  }
  return null;
}

const HS_MEET_RE =
  /\b(high school|hs\b|fhsaa|\bcif\b|wiaa|uil|mhsaa|nchsaa|ohsaa|section(al)? championships?|state (swimming )?championships?|class \d+a\b)\b/i;

function hasHsSignal(sightings: readonly Sighting[]): boolean {
  return sightings.some((s) => s.meet && HS_MEET_RE.test(s.meet));
}

type BirthWindow = { after: string; onOrBefore: string };

function windowFor(sighting: Sighting, slackDays: number): BirthWindow {
  return {
    after: shiftYears(shiftDays(sighting.date, -slackDays), sighting.age + 1),
    onOrBefore: shiftYears(sighting.date, sighting.age),
  };
}

function intersect(sightings: readonly Sighting[], slackDays: number): BirthWindow | null {
  let after = "0000-01-01";
  let onOrBefore = "9999-12-31";
  for (const sighting of sightings) {
    const window = windowFor(sighting, slackDays);
    if (window.after > after) after = window.after;
    if (window.onOrBefore < onOrBefore) onOrBefore = window.onOrBefore;
  }
  return after < onOrBefore ? { after, onOrBefore } : null;
}

export function inferClass(sightings: readonly Sighting[]): ClassInference | null {
  const usable = sightings.filter((s) => s.age > 0 && s.age < 100 && ISO_DATE.test(s.date));
  if (usable.length === 0) return null;

  const byDate = [...usable].sort((left, right) => (left.date < right.date ? -1 : 1));

  let used = byDate;
  let window = intersect(byDate, 0);
  let slackUsed = 0;
  if (!window) {
    window = intersect(byDate, MEET_AGE_SLACK_DAYS);
    slackUsed = MEET_AGE_SLACK_DAYS;
  }
  if (!window) {
    used = [byDate[byDate.length - 1]];
    window = windowFor(used[0], 0);
    slackUsed = 0;
  }

  const earliest = shiftDays(window.after, 1);
  const latest = window.onOrBefore;
  const low = classFromBirthDate(earliest);
  const high = classFromBirthDate(latest);
  const range: [number, number] = [Math.min(low, high), Math.max(low, high)];

  const birthYear = earliest.slice(0, 4) === latest.slice(0, 4) ? Number(earliest.slice(0, 4)) : null;
  const spanDays = Math.round((toEpoch(latest) - toEpoch(earliest)) / DAY_MS) + 1;

  if (range[0] === range[1]) {
    return {
      gradClass: range[0],
      confidence: slackUsed > 0 ? "high" : "exact",
      range,
      basis: slackUsed > 0
        ? `birthdate ${earliest}..${latest} after reconciling conflicting meet ages`
        : `birthdate narrowed to ${earliest}..${latest} from ${used.length} ${used.length === 1 ? "sighting" : "sightings"}`,
      birthYear,
      birthWindow: window,
      sightingCount: used.length,
    };
  }

  const cutoff = cutoffWithin(earliest, latest);
  const daysBeforeCutoff = cutoff == null
    ? spanDays
    : Math.round((toEpoch(cutoff) - toEpoch(earliest)) / DAY_MS);
  const pointClass = daysBeforeCutoff >= spanDays - daysBeforeCutoff ? range[0] : range[1];

  if (hasHsSignal(used)) {
    return {
      gradClass: pointClass,
      confidence: "high",
      range,
      basis: `high-school championship appearance, birthdate in ${earliest}..${latest}`,
      birthYear,
      birthWindow: window,
      sightingCount: used.length,
    };
  }

  return {
    gradClass: pointClass,
    confidence: "estimated",
    range,
    basis: `birthdate in ${earliest}..${latest} from ${used.length} ${used.length === 1 ? "sighting" : "sightings"}`,
    birthYear,
    birthWindow: window,
    sightingCount: used.length,
  };
}

export function matchesClass(inference: ClassInference, targetClass: number): boolean {
  if (inference.confidence === "exact") return inference.gradClass === targetClass;
  return targetClass >= inference.range[0] && targetClass <= inference.range[1];
}

export function classInferenceDisplay(inference: ClassInference): string {
  if (inference.confidence === "exact" || inference.range[0] === inference.range[1]) {
    return String(inference.gradClass);
  }
  return `${inference.range[0]} or ${inference.range[1]}`;
}

export const CLASS_CONFIDENCE_LABEL: Record<ClassConfidence, string> = {
  exact: "Confirmed",
  high: "Likely",
  estimated: "Estimated",
};

export function todaySighting(currentAge: number, today = new Date()): Sighting {
  return { age: currentAge, date: today.toISOString().slice(0, 10) };
}

export function isResolved(inference: ClassInference | null): boolean {
  return inference != null && inference.confidence === "exact";
}
