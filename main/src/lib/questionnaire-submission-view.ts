import type { Submission } from "./questionnaire-defs";
import { formatAnswer, type QuestionField } from "./questionnaire-fields";

export type SubmissionStatusFilter = "all" | Submission["status"];
export type SubmissionGenderFilter = "all" | "M" | "F" | "unset";
export type SubmissionSortKey =
  | "fullName"
  | "status"
  | "gradYear"
  | "gender"
  | "email"
  | "phone"
  | "club"
  | "lsc"
  | "swimcloudUrl"
  | "timesText"
  | "submittedAt"
  | `answer:${string}`;
export type SubmissionSortState = { key: SubmissionSortKey; direction: "asc" | "desc" };

export const SUBMISSION_STATUS_LABEL: Record<Submission["status"], string> = {
  new: "New",
  promoted: "Promoted",
  archived: "Archived",
};

export function filterAndSortSubmissions(
  submissions: Submission[],
  fields: QuestionField[],
  filters: {
    query: string;
    status: SubmissionStatusFilter;
    gradYear: string;
    gender: SubmissionGenderFilter;
    sort: SubmissionSortState;
  },
): Submission[] {
  const terms = filters.query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return submissions
    .filter((row) => {
      if (filters.status !== "all" && row.status !== filters.status) return false;
      if (filters.gradYear === "unset" && row.gradYear !== null) return false;
      if (filters.gradYear !== "all" && filters.gradYear !== "unset" && row.gradYear !== Number(filters.gradYear)) return false;
      if (filters.gender === "unset" && row.gender !== null) return false;
      if (filters.gender !== "all" && filters.gender !== "unset" && row.gender !== filters.gender) return false;
      if (terms.length === 0) return true;
      const haystack = [
        row.fullName,
        row.gradYear,
        row.gender === "F" ? "women female" : row.gender === "M" ? "men male" : "",
        row.email,
        row.phone,
        row.club,
        row.lsc,
        row.swimcloudUrl,
        row.timesText,
        SUBMISSION_STATUS_LABEL[row.status],
        ...fields.map((field) => formatAnswer(row.answers[field.key])),
      ].filter((value) => value !== null && value !== undefined).join(" ").toLocaleLowerCase();
      return terms.every((term) => haystack.includes(term));
    })
    .sort((a, b) => compareSubmissions(a, b, filters.sort));
}

function compareSubmissions(a: Submission, b: Submission, sort: SubmissionSortState): number {
  const aValue = submissionSortValue(a, sort.key);
  const bValue = submissionSortValue(b, sort.key);
  const aEmpty = aValue === null || aValue === "";
  const bEmpty = bValue === null || bValue === "";
  if (aEmpty && bEmpty) return a.fullName.localeCompare(b.fullName);
  if (aEmpty) return 1;
  if (bEmpty) return -1;
  const comparison = typeof aValue === "number" && typeof bValue === "number"
    ? aValue - bValue
    : String(aValue).localeCompare(String(bValue), undefined, { numeric: true, sensitivity: "base" });
  return sort.direction === "asc" ? comparison : -comparison;
}

function submissionSortValue(row: Submission, key: SubmissionSortKey): string | number | null {
  if (key.startsWith("answer:")) return formatAnswer(row.answers[key.slice("answer:".length)]);
  switch (key) {
    case "submittedAt": return Date.parse(row.submittedAt);
    case "fullName": return row.fullName;
    case "status": return row.status;
    case "gradYear": return row.gradYear;
    case "gender": return row.gender;
    case "email": return row.email;
    case "phone": return row.phone;
    case "club": return row.club;
    case "lsc": return row.lsc;
    case "swimcloudUrl": return row.swimcloudUrl;
    case "timesText": return row.timesText;
    default: return null;
  }
}
