import type { Course } from "./types";
import { KNOWN_EVENTS } from "./events";
import { parseClock } from "./time";

export interface ParsedSwim {
  event: string;  
  course: Course;
  seconds: number;
  clock: string;
  date: string | null;
  meet: string | null;
}

const STROKE_WORDS: [RegExp, string][] = [
  [/\b(free(style)?|fr)\b/i, "FR"],
  [/\b(back(stroke)?|bk|bak)\b/i, "BK"],
  [/\b(breast(stroke)?|br|brst)\b/i, "BR"],
  [/\b(fly|butterfly|fl)\b/i, "FL"],
  [/\b(im|i\.m\.|medley)\b/i, "IM"],
];

const COURSE_RE = /\b(SCY|LCM|SCM)\b|\b(short\s+course\s+yards?|short\s+course\s+meters?|long\s+course\s+meters?)\b/i;
const DIST_RE = /\b(25|50|100|200|400|500|800|1000|1500|1650)\b/;
const TIME_RE = /\b(?:(?:\d{1,2}:)?\d{1,2}[.,]\d{1,2}|\d{1,2}:\d{2})\b/;
const DATE_RE = /\b((?:19|20)\d{2}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/(?:\d{2}|\d{4})|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+(?:19|20)\d{2})\b/i;

export function parsePastedTimes(text: string): ParsedSwim[] {
  const out: ParsedSwim[] = [];
  const lines = text.split(/\n+/);
  let pendingEvent: { event: string; course: Course | null } | null = null;
  let sectionCourse: Course | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const inlineCourse = extractCourse(line);
    if (inlineCourse && isCourseHeading(line)) sectionCourse = inlineCourse;
    const event = extractEvent(line);
    const course = inlineCourse ?? sectionCourse;
    const timeMatch = line.match(TIME_RE);

    if (event && timeMatch && course) {
      const seconds = parseClock(timeMatch[0]);
      if (seconds != null) {
        out.push(build(event, course, seconds, timeMatch[0], line));
        pendingEvent = null;
        continue;
      }
    }
    if (event && !timeMatch) { pendingEvent = { event, course }; continue; }
    if (!event && timeMatch && pendingEvent) {
      const seconds = parseClock(timeMatch[0]);
      const pendingCourse = inlineCourse ?? pendingEvent.course ?? sectionCourse;
      if (seconds != null && pendingCourse) {
        out.push(build(pendingEvent.event, pendingCourse, seconds, timeMatch[0], line));
        pendingEvent = null;
      }
    }
  }
  const seen = new Set<string>();
  return out.filter((s) => {
    const k = `${s.event}|${s.course}|${s.seconds.toFixed(2)}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function extractCourse(line: string): Course | null {
  const match = line.match(COURSE_RE);
  if (!match) return null;
  const value = match[0].toLowerCase();
  if (value === "scy" || value.includes("yards")) return "SCY";
  if (value === "lcm" || value.includes("long course")) return "LCM";
  if (value === "scm" || value.includes("short course")) return "SCM";
  return null;
}

function isCourseHeading(line: string): boolean {
  const withoutPunctuation = line.replace(/[|:()\[\]{}-]/g, " ").replace(/\s+/g, " ").trim();
  return /^(SCY|SCM|LCM|short course yards?|short course meters?|long course meters?)$/i.test(withoutPunctuation);
}

function extractEvent(line: string): string | null {
  const dist = line.match(DIST_RE);
  if (!dist) return null;
  let stroke: string | null = null;
  for (const [re, code] of STROKE_WORDS) {
    if (re.test(line)) { stroke = code; break; }
  }
  if (!stroke) {
    const compact = line.toUpperCase().match(/\b(25|50|100|200|400|500|800|1000|1500|1650)\s*(FR|BK|BR|FL|IM)\b/);
    if (compact) stroke = compact[2];
  }
  if (!stroke) return null;
  const event = `${dist[1]}${stroke}`;
  if (!KNOWN_EVENTS.includes(event)) return null;

  return event;
}

function build(event: string, course: Course, seconds: number, clock: string, line: string): ParsedSwim {
  const d = line.match(DATE_RE);
  let date: string | null = null;
  if (d) {
    const t = new Date(d[0]);
    if (!isNaN(t.getTime())) date = t.toISOString().slice(0, 10);
  }
  let meet: string | null = line
    .replace(TIME_RE, " ")
    .replace(DATE_RE, " ")
    .replace(COURSE_RE, " ")
    .replace(/\b(25|50|100|200|400|500|800|1000|1500|1650)\b/g, " ")
    .replace(/\b(free(style)?|back(stroke)?|breast(stroke)?|butterfly|fly|medley|im|fr|bk|br|fl)\b/gi, " ")
    .replace(/[|•·]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (meet && meet.length < 4) meet = null;
  return { event, course, seconds, clock, date, meet };
}
