export const WORKSPACE_DIRECT_CONTACT_SOURCES = [
  "manual_verified",
  "recruiting_questionnaire",
  "coach_mailbox_history",
  "camp_registration",
  "athletics_crm",
  "admissions_crm",
  "licensed_student_search",
] as const;

export type WorkspaceDirectContactSource =
  (typeof WORKSPACE_DIRECT_CONTACT_SOURCES)[number];

const WORKSPACE_DIRECT_CONTACT_SOURCE_SET = new Set<string>(
  WORKSPACE_DIRECT_CONTACT_SOURCES,
);

export function isWorkspaceDirectContactSource(
  value: unknown,
): value is WorkspaceDirectContactSource {
  return typeof value === "string" && WORKSPACE_DIRECT_CONTACT_SOURCE_SET.has(value);
}

export const WORKSPACE_DIRECT_CONTACT_SOURCE_LABELS: Record<
  WorkspaceDirectContactSource,
  string
> = {
  manual_verified: "coach-verified manual entry",
  recruiting_questionnaire: "this program's recruiting questionnaire",
  coach_mailbox_history: "the coach's connected mailbox history",
  camp_registration: "an institution-run camp registration",
  athletics_crm: "the institution's athletics CRM",
  admissions_crm: "the institution's admissions CRM",
  licensed_student_search: "student-search data licensed to the institution",
};
