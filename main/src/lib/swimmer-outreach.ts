import { KNOWN_EVENTS } from "./events";
import { renderWithValues } from "./merge";
import { fmtClock } from "./time";
import type { Course, Gender, SwimTime } from "./types";

export const OUTREACH_STAGES = [
  "introduction",
  "follow_up",
  "update",
  "visit",
  "thank_you",
  "other",
] as const;

export const OUTREACH_DATABASE_UPDATE_ERROR = "Saving outreach templates and drafts is temporarily unavailable. Please try again later.";

export type OutreachStage = (typeof OUTREACH_STAGES)[number];
export type OutreachDraftStatus = "draft" | "ready" | "sent";

export const OUTREACH_STAGE_LABELS: Record<OutreachStage, string> = {
  introduction: "Initial introduction",
  follow_up: "Follow-up",
  update: "Results update",
  visit: "Campus visit",
  thank_you: "Thank-you",
  other: "Other",
};

export const OUTREACH_PLACEHOLDER_GROUPS = ["recipient", "program", "swimmer", "academics", "performance"] as const;
export type OutreachPlaceholderGroup = (typeof OUTREACH_PLACEHOLDER_GROUPS)[number];

export const OUTREACH_PLACEHOLDER_GROUP_LABELS: Record<OutreachPlaceholderGroup, string> = {
  recipient: "Recipient",
  program: "Program",
  swimmer: "Swimmer",
  academics: "Academics",
  performance: "Performance",
};

export const OUTREACH_PLACEHOLDERS = [
  { key: "coach_name", label: "Coach name", group: "recipient", description: "The coach name entered on the school draft." },
  { key: "coach_email", label: "Coach email", group: "recipient", description: "The verified email entered on the school draft." },
  { key: "program_name", label: "Program name", group: "program", description: "The selected school’s institution name." },
  { key: "squad", label: "Squad", group: "program", description: "Men’s, women’s, or coed." },
  { key: "division", label: "Division", group: "program", description: "The program’s current verified division." },
  { key: "first_name", label: "First name", group: "swimmer", description: "Your profile first name." },
  { key: "last_name", label: "Last name", group: "swimmer", description: "Your profile last name." },
  { key: "full_name", label: "Full name", group: "swimmer", description: "Your profile first and last name." },
  { key: "grad_year", label: "Graduation year", group: "swimmer", description: "Your high-school graduation year." },
  { key: "club", label: "Club / team", group: "swimmer", description: "The club or school team on your profile." },
  { key: "city", label: "Home city", group: "swimmer", description: "Your profile city." },
  { key: "state", label: "Home state", group: "swimmer", description: "Your profile state." },
  { key: "swimmer_email", label: "My email", group: "swimmer", description: "Your profile email." },
  { key: "swimmer_phone", label: "My phone", group: "swimmer", description: "Your profile phone number." },
  { key: "gpa", label: "GPA", group: "academics", description: "Your profile GPA, formatted to two decimals." },
  { key: "sat", label: "SAT", group: "academics", description: "Your profile SAT score when provided." },
  { key: "act", label: "ACT", group: "academics", description: "Your profile ACT score when provided." },
  { key: "academic_interests", label: "Academic interests", group: "academics", description: "The real majors selected on your profile." },
  { key: "video_url", label: "Race video", group: "performance", description: "The race-video link on your profile." },
  { key: "best_times", label: "Selected results", group: "performance", description: "Your ordered selection of exact swims, always including course." },
] as const satisfies ReadonlyArray<{
  key: string;
  label: string;
  group: OutreachPlaceholderGroup;
  description: string;
}>;

export type OutreachPlaceholder = (typeof OUTREACH_PLACEHOLDERS)[number]["key"];

export type OutreachTimeLayout = "inline" | "lines";

export interface OutreachTimeEntry {
  timeId: string;
  event: string;
  course: Course;
  seconds: number;
  date: string;
  meet: string;
  source: string;
}

export interface OutreachTimeConfig {
  entries: OutreachTimeEntry[];
  layout: OutreachTimeLayout;
  includeMeet: boolean;
  includeDate: boolean;
}

export const EMPTY_OUTREACH_TIME_CONFIG: OutreachTimeConfig = {
  entries: [],
  layout: "lines",
  includeMeet: false,
  includeDate: false,
};

export interface SwimmerOutreachTemplate {
  id: string;
  name: string;
  stage: OutreachStage;
  subjectTemplate: string;
  bodyTemplate: string;
  timeConfig: OutreachTimeConfig;
  createdAt: string;
  updatedAt: string;
}

export interface SwimmerOutreachDraft {
  id: string;
  templateId: string;
  programId: string;
  coachName: string;
  coachEmail: string;
  subject: string;
  body: string;
  bodyFormat: "text" | "html";
  timeConfig: OutreachTimeConfig;
  status: OutreachDraftStatus;
  createdAt: string;
  updatedAt: string;
}

export interface OutreachProgram {
  id: string;
  name: string;
  short: string;
  squad: "men" | "women" | "coed";
  division: string;
  staffUrl: string;
  questionnaireUrl: string;
}

export interface OutreachSwimmer {
  gender: Gender;
  firstName: string;
  lastName: string;
  gradYear: number;
  club: string;
  city: string;
  state: string;
  email: string;
  phone: string;
  gpa: number | null;
  sat: number | null;
  act: number | null;
  majors: string;
  videoUrl: string;
}

export const STARTER_OUTREACH_TEMPLATE = {
  name: "Initial introduction",
  stage: "introduction" as OutreachStage,
  subjectTemplate: "{{full_name}} | Class of {{grad_year}} | {{program_name}} swimming",
  bodyTemplate: `Hello {{coach_name}},

My name is {{full_name}}, and I am a class of {{grad_year}} swimmer with {{club}} in {{state}}.

I am interested in {{program_name}} and would like to learn more about your recruiting needs. Here are the results I think are most relevant:

{{best_times}}

My academic interests include {{academic_interests}}. I would be glad to send my meet schedule and race video. What information would be most useful?

Thank you,
{{full_name}}
Class of {{grad_year}}`,
  timeConfig: EMPTY_OUTREACH_TIME_CONFIG,
};

export function outreachStageSupportsResults(stage: OutreachStage): boolean {
  return stage === "introduction" || stage === "update";
}

export function removeOutreachResultsBlock(text: string): string {
  return text
    .split(/\r?\n/)
    .filter((line) => !/\{\{\s*best_times\s*\}\}/.test(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const PLACEHOLDER_PATTERN = /\{\{\s*([^{}]+?)\s*\}\}/g;
const ALLOWED_PLACEHOLDERS = new Set<string>(OUTREACH_PLACEHOLDERS.map(({ key }) => key));

export function placeholderToken(key: OutreachPlaceholder): string {
  return `{{${key}}}`;
}

export function insertPlaceholder(value: string, key: OutreachPlaceholder, start = value.length, end = start): {
  value: string;
  cursor: number;
} {
  const token = placeholderToken(key);
  const before = value.slice(0, start);
  const after = value.slice(end);
  const leading = before && !/\s$/.test(before) ? " " : "";
  const trailing = after && !/^[\s,.;:!?)]/.test(after) ? " " : "";
  const insertion = `${leading}${token}${trailing}`;
  return { value: `${before}${insertion}${after}`, cursor: before.length + insertion.length };
}

export function appendPlaceholder(value: string, key: OutreachPlaceholder): string {
  return insertPlaceholder(value, key).value;
}

export function unknownOutreachPlaceholders(...texts: string[]): string[] {
  return outreachPlaceholderKeys(...texts).filter((key) => !ALLOWED_PLACEHOLDERS.has(key));
}

export function outreachPlaceholderKeys(...texts: string[]): string[] {
  const keys = texts.flatMap((text) => [...text.matchAll(PLACEHOLDER_PATTERN)]
    .map((match) => match[1].trim()));
  return [...new Set(keys)];
}

export function usesOutreachPlaceholder(text: string, key: OutreachPlaceholder): boolean {
  return new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`).test(text);
}

export function outreachPlaceholderCount(text: string, key: OutreachPlaceholder): number {
  return [...text.matchAll(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g"))].length;
}

export function parseOutreachTimeConfig(value: unknown): OutreachTimeConfig {
  if (!value || typeof value !== "object") return { ...EMPTY_OUTREACH_TIME_CONFIG, entries: [] };
  const candidate = value as Record<string, unknown>;
  const entries = Array.isArray(candidate.entries)
    ? candidate.entries.flatMap((entry): OutreachTimeEntry[] => {
        if (!entry || typeof entry !== "object") return [];
        const row = entry as Record<string, unknown>;
        const course = row.course;
        if (
          typeof row.timeId !== "string" ||
          typeof row.event !== "string" ||
          !(course === "SCY" || course === "SCM" || course === "LCM") ||
          typeof row.seconds !== "number" || !Number.isFinite(row.seconds) ||
          typeof row.date !== "string" || typeof row.meet !== "string" || typeof row.source !== "string"
        ) return [];
        return [{
          timeId: row.timeId,
          event: row.event,
          course,
          seconds: row.seconds,
          date: row.date,
          meet: row.meet,
          source: row.source,
        }];
      }).slice(0, 8)
    : [];
  return {
    entries,
    layout: candidate.layout === "inline" ? "inline" : "lines",
    includeMeet: candidate.includeMeet === true,
    includeDate: candidate.includeDate === true,
  };
}

export function outreachTimeEntryFromSwimTime(time: SwimTime): OutreachTimeEntry {
  return {
    timeId: time.id,
    event: time.event,
    course: time.course,
    seconds: Number(time.seconds),
    date: time.date,
    meet: time.meet,
    source: time.source,
  };
}

export function bestOutreachTimeEntries(times: SwimTime[]): OutreachTimeEntry[] {
  const best = new Map<string, SwimTime>();
  for (const time of times) {
    const key = `${time.event.toUpperCase()}:${time.course}`;
    const current = best.get(key);
    if (!current || Number(time.seconds) < Number(current.seconds)) best.set(key, time);
  }
  return [...best.values()]
    .sort((left, right) => {
      const eventDifference = KNOWN_EVENTS.indexOf(left.event) - KNOWN_EVENTS.indexOf(right.event);
      return eventDifference || left.course.localeCompare(right.course) || Number(left.seconds) - Number(right.seconds);
    })
    .map(outreachTimeEntryFromSwimTime);
}

export function outreachEventLabel(event: string): string {
  const match = /^(\d+)(FR|BK|BR|FL|IM)$/.exec(event.trim().toUpperCase());
  if (!match) return event;
  const stroke = { FR: "Free", BK: "Back", BR: "Breast", FL: "Fly", IM: "IM" }[match[2]];
  return `${match[1]} ${stroke}`;
}

function outreachDateLabel(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  return `${Number(match[2])}/${Number(match[3])}/${match[1]}`;
}

export function renderOutreachTimes(config: OutreachTimeConfig): string {
  const lines = config.entries.map((entry) => {
    const context = [
      config.includeMeet && entry.meet ? entry.meet : "",
      config.includeDate && entry.date ? outreachDateLabel(entry.date) : "",
    ].filter(Boolean);
    const result = `${outreachEventLabel(entry.event)} ${entry.course}: ${fmtClock(entry.seconds)}`;
    return context.length ? `${result} (${context.join(", ")})` : result;
  });
  if (!lines.length) return "[Choose results]";
  return config.layout === "inline" ? lines.join("  •  ") : lines.join("\n");
}

export function outreachMergeValues(
  program: OutreachProgram,
  swimmer: OutreachSwimmer,
  contact: { coachName: string; coachEmail: string },
  timeConfig: OutreachTimeConfig = EMPTY_OUTREACH_TIME_CONFIG,
): Record<OutreachPlaceholder, string> {
  return {
    coach_name: contact.coachName.trim() || "Coach",
    coach_email: contact.coachEmail.trim(),
    program_name: program.name,
    squad: program.squad === "men" ? "men's" : program.squad === "women" ? "women's" : "coed",
    division: program.division,
    first_name: swimmer.firstName,
    last_name: swimmer.lastName,
    full_name: [swimmer.firstName, swimmer.lastName].filter(Boolean).join(" "),
    grad_year: String(swimmer.gradYear),
    club: swimmer.club,
    city: swimmer.city,
    state: swimmer.state,
    swimmer_email: swimmer.email,
    swimmer_phone: swimmer.phone,
    gpa: swimmer.gpa && swimmer.gpa > 0 ? swimmer.gpa.toFixed(2) : "",
    sat: swimmer.sat ? String(swimmer.sat) : "",
    act: swimmer.act ? String(swimmer.act) : "",
    academic_interests: swimmer.majors,
    video_url: swimmer.videoUrl,
    best_times: renderOutreachTimes(timeConfig),
  };
}

export function renderOutreachText(text: string, values: Record<OutreachPlaceholder, string>): string {
  return renderWithValues(text, values);
}

type MaterializableOutreachTemplate = Pick<
  SwimmerOutreachTemplate,
  "stage" | "subjectTemplate" | "bodyTemplate" | "timeConfig"
>;

type MaterializedOutreachDraft = Pick<
  SwimmerOutreachDraft,
  "coachName" | "coachEmail" | "subject" | "body" | "timeConfig" | "status"
>;

export function materializeOutreachTemplate(
  template: MaterializableOutreachTemplate,
  program: OutreachProgram,
  swimmer: OutreachSwimmer,
  contact: { coachName: string; coachEmail: string },
): MaterializedOutreachDraft {
  const supportsResults = outreachStageSupportsResults(template.stage);
  const subjectTemplate = supportsResults
    ? template.subjectTemplate
    : removeOutreachResultsBlock(template.subjectTemplate);
  const bodyTemplate = supportsResults
    ? template.bodyTemplate
    : removeOutreachResultsBlock(template.bodyTemplate);
  const timeConfig = supportsResults
    ? { ...template.timeConfig, entries: [...template.timeConfig.entries] }
    : { ...EMPTY_OUTREACH_TIME_CONFIG, entries: [] };
  const values = outreachMergeValues(program, swimmer, contact, timeConfig);
  return {
    coachName: contact.coachName,
    coachEmail: contact.coachEmail,
    subject: renderOutreachText(subjectTemplate, values),
    body: renderOutreachText(bodyTemplate, values),
    timeConfig,
    status: "draft",
  };
}

function replaceFirstOccurrences(text: string, search: string, replacement: string, limit: number): string {
  if (!search || search === replacement || limit < 1) return text;
  let result = text;
  let fromIndex = 0;
  for (let replaced = 0; replaced < limit; replaced += 1) {
    const index = result.indexOf(search, fromIndex);
    if (index < 0) break;
    result = `${result.slice(0, index)}${replacement}${result.slice(index + search.length)}`;
    fromIndex = index + replacement.length;
  }
  return result;
}

export function updateMaterializedOutreachCoachName(
  template: MaterializableOutreachTemplate,
  program: OutreachProgram,
  swimmer: OutreachSwimmer,
  current: MaterializedOutreachDraft,
  coachName: string,
): MaterializedOutreachDraft {
  const currentTemplate = { ...template, timeConfig: current.timeConfig };
  const previousMaterialized = materializeOutreachTemplate(currentTemplate, program, swimmer, current);
  const nextContact = { coachName, coachEmail: current.coachEmail };
  const nextMaterialized = materializeOutreachTemplate(currentTemplate, program, swimmer, nextContact);
  const previousName = outreachMergeValues(program, swimmer, current, current.timeConfig).coach_name;
  const nextName = outreachMergeValues(program, swimmer, nextContact, current.timeConfig).coach_name;

  const updateText = (
    currentText: string,
    previousText: string,
    nextText: string,
    templateText: string,
  ): string => currentText === previousText
    ? nextText
    : replaceFirstOccurrences(
        currentText,
        previousName,
        nextName,
        outreachPlaceholderCount(templateText, "coach_name"),
      );

  return {
    ...current,
    coachName,
    subject: updateText(
      current.subject,
      previousMaterialized.subject,
      nextMaterialized.subject,
      template.subjectTemplate,
    ),
    body: updateText(
      current.body,
      previousMaterialized.body,
      nextMaterialized.body,
      template.bodyTemplate,
    ),
  };
}
