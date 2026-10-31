
export const QUESTION_KINDS = [
  "short_text",
  "long_text",
  "single_select",
  "multi_select",
  "yes_no",
  "number",
] as const;

export type QuestionKind = (typeof QUESTION_KINDS)[number];

export const QUESTION_KIND_LABELS: Record<QuestionKind, string> = {
  short_text: "Short text",
  long_text: "Paragraph",
  single_select: "Choose one",
  multi_select: "Choose many",
  yes_no: "Yes / No",
  number: "Number",
};

export type QuestionField = {
  key: string;
  label: string;
  kind: QuestionKind;
  required: boolean;
  options?: string[];
};

export type AnswerValue = string | number | string[];
export type AnswerMap = Record<string, AnswerValue>;

export const MAX_QUESTIONS = 20;
export const MAX_OPTIONS = 12;
const MAX_LABEL = 120;
const MAX_OPTION = 80;
const MAX_ANSWER_TEXT = 2000;

const PROHIBITED_SENSITIVE_TOPIC = /\b(?:social\s*security|ssn|medical|health|diagnos\w*|disabilit\w*|medication|prescription|bank|routing\s*number|credit\s*card|debit\s*card|passport|driver'?s?\s*license|government\s*id|race|ethnic\w*|religio\w*|sexual\s*orientation|gender\s*identity|immigration|citizenship|visa\s*status)\b/i;

export function fieldNeedsOptions(kind: QuestionKind): boolean {
  return kind === "single_select" || kind === "multi_select";
}

export function makeFieldKey(label: string, existing: readonly string[]): string {
  const base = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || "field";
  let key = base;
  let n = 2;
  while (existing.includes(key)) key = `${base}_${n++}`;
  return key;
}

function cleanOptions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const raw of value) {
    if (typeof raw !== "string") continue;
    const opt = raw.trim().slice(0, MAX_OPTION);
    if (opt && !out.includes(opt)) out.push(opt);
    if (out.length >= MAX_OPTIONS) break;
  }
  return out;
}

export function parseQuestionFields(value: unknown): QuestionField[] {
  if (!Array.isArray(value)) return [];
  const fields: QuestionField[] = [];
  const keys: string[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const label = typeof row.label === "string" ? row.label.trim().slice(0, MAX_LABEL) : "";
    if (!label) continue;
    const kind = QUESTION_KINDS.includes(row.kind as QuestionKind) ? (row.kind as QuestionKind) : "short_text";
    const options = fieldNeedsOptions(kind) ? cleanOptions(row.options) : undefined;
    if (fieldNeedsOptions(kind) && (!options || options.length === 0)) continue;  
    const existingKey = typeof row.key === "string" && /^[a-z0-9_]{1,40}$/.test(row.key) && !keys.includes(row.key)
      ? row.key
      : makeFieldKey(label, keys);
    keys.push(existingKey);
    fields.push({ key: existingKey, label, kind, required: row.required === true, ...(options ? { options } : {}) });
    if (fields.length >= MAX_QUESTIONS) break;
  }
  return fields;
}

export function prohibitedQuestionTopic(fields: readonly QuestionField[]): string | null {
  for (const field of fields) {
    const values = [field.label, ...(field.options ?? [])];
    if (values.some((value) => PROHIBITED_SENSITIVE_TOPIC.test(value))) return field.label;
  }
  return null;
}

function isBlank(value: AnswerValue | undefined): boolean {
  if (value == null) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "string") return value.trim().length === 0;
  return false;
}

export function validateAnswers(
  fields: QuestionField[],
  answers: unknown,
): { ok: true; answers: AnswerMap } | { ok: false; error: string } {
  const input = (answers && typeof answers === "object" && !Array.isArray(answers) ? answers : {}) as Record<string, unknown>;
  const clean: AnswerMap = {};

  for (const field of fields) {
    const raw = input[field.key] as AnswerValue | undefined;

    if (field.kind === "multi_select") {
      const picks = Array.isArray(raw) ? raw.filter((o): o is string => typeof o === "string" && (field.options ?? []).includes(o)) : [];
      if (field.required && picks.length === 0) return { ok: false, error: `Please answer "${field.label}".` };
      if (picks.length) clean[field.key] = picks;
      continue;
    }

    if (field.kind === "single_select") {
      const pick = typeof raw === "string" && (field.options ?? []).includes(raw) ? raw : "";
      if (field.required && !pick) return { ok: false, error: `Please answer "${field.label}".` };
      if (pick) clean[field.key] = pick;
      continue;
    }

    if (field.kind === "yes_no") {
      const pick = raw === "yes" || raw === "no" ? raw : "";
      if (field.required && !pick) return { ok: false, error: `Please answer "${field.label}".` };
      if (pick) clean[field.key] = pick;
      continue;
    }

    if (field.kind === "number") {
      if (isBlank(raw)) {
        if (field.required) return { ok: false, error: `Please answer "${field.label}".` };
        continue;
      }
      const num = typeof raw === "number" ? raw : Number(String(raw).trim());
      if (!Number.isFinite(num)) return { ok: false, error: `"${field.label}" must be a number.` };
      clean[field.key] = num;
      continue;
    }

    const text = typeof raw === "string" ? raw.trim().slice(0, MAX_ANSWER_TEXT) : "";
    if (field.required && !text) return { ok: false, error: `Please answer "${field.label}".` };
    if (text) clean[field.key] = text;
  }

  return { ok: true, answers: clean };
}

export function formatAnswer(value: AnswerValue | undefined): string {
  if (value == null) return "";
  if (Array.isArray(value)) return value.join(", ");
  if (value === "yes") return "Yes";
  if (value === "no") return "No";
  return String(value);
}
