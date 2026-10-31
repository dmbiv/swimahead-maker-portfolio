import type { Course, EventCode, EventGroup } from "./types";

export const EVENT_ORDER: EventCode[] = [
  "50FR", "100FR", "200FR", "500FR", "1000FR", "1650FR",
  "100BK", "200BK", "100BR", "200BR", "100FL", "200FL", "200IM", "400IM",
];

export const EVENT_LABELS: Record<EventCode, string> = {
  "50FR": "50 Free", "100FR": "100 Free", "200FR": "200 Free",
  "500FR": "500 Free", "1000FR": "1000 Free", "1650FR": "1650 Free",
  "100BK": "100 Back", "200BK": "200 Back",
  "100BR": "100 Breast", "200BR": "200 Breast",
  "100FL": "100 Fly", "200FL": "200 Fly",
  "200IM": "200 IM", "400IM": "400 IM",
};

export const EVENT_GROUPS: Record<EventCode, EventGroup> = {
  "50FR": "SPRINT", "100FR": "SPRINT", "200FR": "MID", "500FR": "MID",
  "1000FR": "DIST", "1650FR": "DIST",
  "100BK": "BK", "200BK": "BK", "100BR": "BR", "200BR": "BR",
  "100FL": "FL", "200FL": "FL", "200IM": "IM", "400IM": "IM",
};

export const GROUP_LABELS: Record<EventGroup, string> = {
  SPRINT: "Sprint Free", MID: "Mid Free", DIST: "Distance",
  BK: "Backstroke", BR: "Breaststroke", FL: "Butterfly", IM: "IM",
};

export const GROUPS: EventGroup[] = ["SPRINT", "MID", "DIST", "BK", "BR", "FL", "IM"];

export const EVENTS_BY_COURSE: Record<Course, string[]> = {
  SCY: [...EVENT_ORDER],
  SCM: ["50FR", "100FR", "200FR", "400FR", "800FR", "1500FR", "100BK", "200BK", "100BR", "200BR", "100FL", "200FL", "200IM", "400IM"],
  LCM: ["50FR", "100FR", "200FR", "400FR", "800FR", "1500FR", "100BK", "200BK", "100BR", "200BR", "100FL", "200FL", "200IM", "400IM"],
};

export function eventLabelForCourse(event: string, course: Course): string {
  const normalized = event.toUpperCase().replace(/\s+/g, "");
  const asSwum = course === "SCY"
    ? normalized
    : ({ "500FR": "400FR", "1000FR": "800FR", "1650FR": "1500FR" } as Record<string, string>)[normalized] ?? normalized;
  const match = /^(\d+)(FR|BK|BR|FL|IM)$/.exec(asSwum);
  if (!match) return event;
  const stroke = { FR: "Free", BK: "Back", BR: "Breast", FL: "Fly", IM: "IM" }[match[2] as "FR" | "BK" | "BR" | "FL" | "IM"];
  return `${match[1]} ${stroke}`;
}

export function canonicalEvent(event: string, course: Course): EventCode | null {
  const e = event.toUpperCase().replace(/\s+/g, "");
  if (course === "SCY") {
    return (EVENT_ORDER as string[]).includes(e) ? (e as EventCode) : null;
  }
  const map: Record<string, EventCode> = {
    "50FR": "50FR", "100FR": "100FR", "200FR": "200FR",
    "400FR": "500FR", "800FR": "1000FR", "1500FR": "1650FR",
    "100BK": "100BK", "200BK": "200BK", "100BR": "100BR", "200BR": "200BR",
    "100FL": "100FL", "200FL": "200FL", "200IM": "200IM", "400IM": "400IM",
  };
  return map[e] ?? null;
}

export function toSCYSeconds(event: string, course: Course, seconds: number): number | null {
  const code = canonicalEvent(event, course);
  if (!code) return null;
  if (course === "SCY") return seconds;
  return null;
}

export const KNOWN_EVENTS = [
  ...EVENT_ORDER,
  "400FR", "800FR", "1500FR",
];
