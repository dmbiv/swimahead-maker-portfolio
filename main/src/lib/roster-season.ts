export type RosterClassStanding = "FR" | "SO" | "JR" | "SR" | "GR";


export const SEASON_ROLLOVER_MONTH = 6;
export const SEASON_ROLLOVER_LABEL = "June 1";

export function currentSeasonEndYear(today = new Date()): number {
  return today.getUTCFullYear() + (today.getUTCMonth() + 1 >= SEASON_ROLLOVER_MONTH ? 1 : 0);
}

export function seasonLabel(seasonEndYear: number): string {
  return `${seasonEndYear - 1}-${String(seasonEndYear % 100).padStart(2, "0")}`;
}

export function standingForClassYear(
  classYear: number,
  seasonEndYear: number,
): RosterClassStanding | null {
  const remaining = classYear - seasonEndYear;
  if (remaining < 0) return "GR";
  if (remaining === 0) return "SR";
  if (remaining === 1) return "JR";
  if (remaining === 2) return "SO";
  if (remaining === 3) return "FR";
  return null;
}

export function classYearForStanding(
  standing: RosterClassStanding | null,
  seasonEndYear: number | null,
): number | null {
  if (!standing || seasonEndYear == null) return null;
  if (standing === "FR") return seasonEndYear + 3;
  if (standing === "SO") return seasonEndYear + 2;
  if (standing === "JR") return seasonEndYear + 1;
  return seasonEndYear;
}

export type RosterClassDisplay = {
  label: string;
  detail: string | null;
  stale: boolean;
};

export function rosterClassDisplay(
  swimmer: { classYear: number | null; classStanding: RosterClassStanding | null },
  today = new Date(),
): RosterClassDisplay {
  if (swimmer.classYear != null) {
    const standing = standingForClassYear(swimmer.classYear, currentSeasonEndYear(today));
    return {
      label: standing ?? "Incoming",
      detail: `Class of ${swimmer.classYear}`,
      stale: false,
    };
  }
  if (swimmer.classStanding) {
    return { label: swimmer.classStanding, detail: null, stale: true };
  }
  return { label: "Not set", detail: null, stale: false };
}
