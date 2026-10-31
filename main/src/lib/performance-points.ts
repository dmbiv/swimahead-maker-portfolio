import type { Course, Gender } from "./types";

export type PerformanceScoreMethod = "world_aquatics" | "college_index";

export interface PerformanceScore {
  value: number;
  method: PerformanceScoreMethod;
  shortLabel: "WA" | "College";
  methodLabel: string;
  baseSeconds: number;
  basisLabel: string;
  version: string;
  sourceName: string;
  sourceUrl: string;
}

type BaseTimes = Readonly<Record<Gender, Readonly<Record<string, number>>>>;

const WORLD_AQUATICS_BASE_TIMES: Readonly<Record<"SCM" | "LCM", BaseTimes>> = {
  SCM: {
    M: {
      "50FR": 19.90, "100FR": 44.84, "200FR": 98.61, "400FR": 212.25, "800FR": 440.46, "1500FR": 846.88,
      "50BK": 22.11, "100BK": 48.33, "200BK": 105.63,
      "50BR": 24.95, "100BR": 55.28, "200BR": 120.16,
      "50FL": 21.32, "100FL": 47.71, "200FL": 106.85,
      "100IM": 49.28, "200IM": 108.88, "400IM": 234.81,
    },
    F: {
      "50FR": 22.83, "100FR": 50.25, "200FR": 110.31, "400FR": 230.25, "800FR": 477.42, "1500FR": 908.24,
      "50BK": 25.23, "100BK": 54.02, "200BK": 118.04,
      "50BR": 28.37, "100BR": 62.36, "200BR": 132.50,
      "50FL": 23.94, "100FL": 52.71, "200FL": 119.32,
      "100IM": 55.11, "200IM": 121.63, "400IM": 255.48,
    },
  },
  LCM: {
    M: {
      "50FR": 20.91, "100FR": 46.40, "200FR": 102.00, "400FR": 219.96, "800FR": 452.12, "1500FR": 870.67,
      "50BK": 23.55, "100BK": 51.60, "200BK": 111.92,
      "50BR": 25.95, "100BR": 56.88, "200BR": 125.48,
      "50FL": 22.27, "100FL": 49.45, "200FL": 110.34,
      "200IM": 112.69, "400IM": 242.50,
    },
    F: {
      "50FR": 23.61, "100FR": 51.71, "200FR": 112.23, "400FR": 234.18, "800FR": 484.12, "1500FR": 920.48,
      "50BK": 26.86, "100BK": 57.13, "200BK": 123.14,
      "50BR": 29.16, "100BR": 64.13, "200BR": 137.55,
      "50FL": 24.43, "100FL": 54.60, "200FL": 121.81,
      "200IM": 125.70, "400IM": 263.65,
    },
  },
};

const NCAA_DIVISION_I_SCY_QUALIFYING_TIMES: BaseTimes = {
  M: {
    "50FR": 19.43, "100FR": 42.55, "200FR": 93.93, "500FR": 258.07, "1000FR": 547.08, "1650FR": 906.60,
    "100BK": 46.29, "200BK": 102.14,
    "100BR": 52.58, "200BR": 114.95,
    "100FL": 46.11, "200FL": 103.79,
    "200IM": 104.13, "400IM": 226.19,
  },
  F: {
    "50FR": 22.28, "100FR": 48.60, "200FR": 105.53, "500FR": 283.70, "1000FR": 593.66, "1650FR": 985.29,
    "100BK": 52.65, "200BK": 114.80,
    "100BR": 60.30, "200BR": 131.27,
    "100FL": 52.52, "200FL": 117.11,
    "200IM": 117.88, "400IM": 253.20,
  },
};

const WORLD_AQUATICS_SOURCE_URL = "https://www.worldaquatics.com/swimming/points";
const NCAA_QUALIFYING_STANDARDS_SOURCE_URL = "https://ncaaorg.s3.amazonaws.com/championships/sports/swimdive/d1/2025-26D1XSW_QUALSTANDARDS.pdf";

function normalizedEvent(event: string): string {
  return event.trim().toUpperCase().replace(/\s+/g, "");
}

export function baseSecondsFor(event: string, course: Course, gender: Gender | null | undefined): number | null {
  if (gender !== "M" && gender !== "F") return null;
  const normalized = normalizedEvent(event);
  const base = course === "SCY"
    ? NCAA_DIVISION_I_SCY_QUALIFYING_TIMES[gender][normalized]
    : WORLD_AQUATICS_BASE_TIMES[course][gender][normalized];
  return base ?? null;
}

export function performanceScoreToSeconds(
  target: { event: string; course: Course; points: number },
  gender: Gender | null | undefined,
): number | null {
  if (!Number.isFinite(target.points) || target.points <= 0) return null;
  const baseSeconds = baseSecondsFor(target.event, target.course, gender);
  if (baseSeconds == null) return null;
  return baseSeconds * Math.cbrt(1000 / target.points);
}

export function performanceScore(
  result: { event: string; course: Course; seconds: number },
  gender: Gender | null | undefined,
): PerformanceScore | null {
  if ((gender !== "M" && gender !== "F") || !Number.isFinite(result.seconds) || result.seconds <= 0) return null;
  const event = normalizedEvent(result.event);

  if (result.course === "SCY") {
    const baseSeconds = NCAA_DIVISION_I_SCY_QUALIFYING_TIMES[gender][event];
    if (!baseSeconds) return null;
    const sexLabel = gender === "M" ? "men’s" : "women’s";
    const isDerived1000 = event === "1000FR";
    return {
      value: Math.trunc(1000 * Math.pow(baseSeconds / result.seconds, 3)),
      method: "college_index",
      shortLabel: "College",
      methodLabel: "SwimAhead College Index",
      baseSeconds,
      basisLabel: isDerived1000
        ? `derived NCAA Division I ${sexLabel} 1000 SCY equivalent`
        : `2025–26 NCAA Division I ${sexLabel} SCY qualifying standard`,
      version: isDerived1000
        ? "derived from the 2025–26 NCAA 500/1650 standards and official 1000 record"
        : "2025–26 NCAA Division I qualifying standards",
      sourceName: "2025–26 NCAA Division I swimming qualifying standards",
      sourceUrl: NCAA_QUALIFYING_STANDARDS_SOURCE_URL,
    };
  }

  const baseSeconds = WORLD_AQUATICS_BASE_TIMES[result.course][gender][event];
  if (!baseSeconds) return null;
  const version = result.course === "SCM"
    ? "World Aquatics 2025 SCM base times (valid September 1, 2025–August 31, 2026)"
    : "World Aquatics 2026 LCM base times (valid January 1–December 31, 2026)";
  return {
    value: Math.trunc(1000 * Math.pow(baseSeconds / result.seconds, 3)),
    method: "world_aquatics",
    shortLabel: "WA",
    methodLabel: "World Aquatics Points",
    baseSeconds,
    basisLabel: `World Aquatics ${result.course} ${gender === "M" ? "men’s" : "women’s"} base time`,
    version,
    sourceName: "World Aquatics Points",
    sourceUrl: WORLD_AQUATICS_SOURCE_URL,
  };
}

export function performanceScoreTitle(score: PerformanceScore): string {
  const comparison = score.method === "world_aquatics"
    ? "Official World Aquatics points"
    : "SwimAhead’s NCAA event-depth-calibrated SCY index; not an official NCAA or SwimCloud score";
  return `${score.value}: ${comparison}. Based on ${score.basisLabel.toLocaleLowerCase()} (${score.version}).`;
}
