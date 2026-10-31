export const RECRUIT_SCORE_MIN = 300;
export const RECRUIT_SCORE_MAX = 1100;
export const RECRUIT_SCORE_STEP = 1;
export const DEFAULT_RECRUIT_SCORE = 700;

export type RecruitTimeDirection = "around" | "faster" | "slower";

export function normalizeRecruitTimeDirection(value: unknown): RecruitTimeDirection {
  return value === "faster" || value === "slower" ? value : "around";
}

export const TOLERANCE_MIN = 40;
export const TOLERANCE_MAX = 500;
export const TOLERANCE_STEP = 10;
export const DEFAULT_SLOWER_TOLERANCE = 150;
export const DEFAULT_FASTER_TOLERANCE = 120;

export const CONFERENCE_PLACE_TOLERANCE = 60;

export function clampTolerance(value: number | null | undefined, fallback: number): number {
  if (value == null || !Number.isFinite(value)) return fallback;
  return Math.round(Math.max(TOLERANCE_MIN, Math.min(TOLERANCE_MAX, value)) / TOLERANCE_STEP) * TOLERANCE_STEP;
}

export const RADIUS_MIN_MILES = 25;
export const RADIUS_MAX_MILES = 3000;
export const RADIUS_STEP_MILES = 25;
export const DEFAULT_RADIUS_MILES = 1000;

export function clampRecruitScore(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_RECRUIT_SCORE;
  return Math.round(Math.max(RECRUIT_SCORE_MIN, Math.min(RECRUIT_SCORE_MAX, value)) / RECRUIT_SCORE_STEP)
    * RECRUIT_SCORE_STEP;
}

export function clampPreferredRadius(value: number | null): number | null {
  if (value == null) return null;
  if (!Number.isFinite(value)) return DEFAULT_RADIUS_MILES;
  return Math.round(Math.max(RADIUS_MIN_MILES, Math.min(RADIUS_MAX_MILES, value)) / RADIUS_STEP_MILES)
    * RADIUS_STEP_MILES;
}

export const PROXIMITY_WEIGHT_MAX = 0.5;
export const PROXIMITY_WEIGHT_MIN = 0.06;

export function proximityWeightFor(radiusMiles: number | null): number {
  const radius = clampPreferredRadius(radiusMiles);
  if (radius == null || radius >= RADIUS_MAX_MILES) return 0;
  const tightness = (RADIUS_MAX_MILES - radius) / (RADIUS_MAX_MILES - RADIUS_MIN_MILES);
  return PROXIMITY_WEIGHT_MIN + (PROXIMITY_WEIGHT_MAX - PROXIMITY_WEIGHT_MIN) * tightness * tightness;
}

export function agesForGraduatingClass(classYear: number, today = new Date()): number[] {
  const birthYear = classYear - 18;
  const ageThisYear = today.getFullYear() - birthYear;
  return [ageThisYear - 1, ageThisYear].filter((age) => age >= 12 && age <= 19);
}
