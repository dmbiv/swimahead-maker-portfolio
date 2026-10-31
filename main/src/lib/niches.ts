import type { EventCode } from "./types";

export type Niche = {
  key: string;
  label: string;
  events: EventCode[];
};

export const NICHES: Niche[] = [
  { key: "sprint_free", label: "Sprint free (50/100)", events: ["50FR", "100FR"] },
  { key: "mid_free", label: "Mid free (200/500)", events: ["200FR", "500FR"] },
  { key: "distance_free", label: "Distance free (500/1000/1650)", events: ["500FR", "1000FR", "1650FR"] },
  { key: "back", label: "Backstroke", events: ["100BK", "200BK"] },
  { key: "breast", label: "Breaststroke", events: ["100BR", "200BR"] },
  { key: "fly", label: "Butterfly", events: ["100FL", "200FL"] },
  { key: "im", label: "IM", events: ["200IM", "400IM"] },
  { key: "versatile", label: "Versatile (IM + a stroke)", events: ["200IM", "400IM", "100FL", "100BK"] },
];

export function nicheByKey(key: string): Niche | null {
  return NICHES.find((n) => n.key === key) ?? null;
}
