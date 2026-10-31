import type { Gender } from "./types";

export type RosterProgramSquad = "men" | "women" | "coed";

export function rosterGenderForSquad(squad: RosterProgramSquad): Gender {
  return squad === "women" ? "F" : "M";
}
