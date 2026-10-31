import type { Gender } from "./types";
import {
  isWorkspaceDirectContactSource,
  type WorkspaceDirectContactSource,
} from "./workspace-contact-provenance";


export const RECRUIT_STAGES = ["identified", "contacted", "responded", "visiting", "committed", "passed"] as const;
export type RecruitStage = (typeof RECRUIT_STAGES)[number];

export const RECRUIT_STAGE_LABELS: Record<RecruitStage, string> = {
  identified: "Identified",
  contacted: "Contacted",
  responded: "Responded",
  visiting: "Visiting",
  committed: "Committed",
  passed: "Passed",
};

export type RecruitPriority = "high" | "medium" | "low";

export type LedgerContactSource = WorkspaceDirectContactSource | null;

export const RECRUITING_CONTACT_RIGHTS_NOTICE =
  "I confirm our program received this email directly from the swimmer or their parent or guardian, or otherwise has permission to use it for individualized, one-to-one recruiting communication.";

export function normalizeLedgerContactEmail(value: string | null | undefined): string | null {
  return value?.trim().toLowerCase() || null;
}

export function isValidLedgerContactEmail(value: string): boolean {
  const email = normalizeLedgerContactEmail(value);
  return email != null && email.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function ledgerEmailNeedsRightsAttestation(input: {
  currentEmail: string | null | undefined;
  nextEmail: string | null | undefined;
  contactSource: LedgerContactSource;
  contactRightsAttestedAt: string | null | undefined;
}): boolean {
  const nextEmail = normalizeLedgerContactEmail(input.nextEmail);
  if (!nextEmail) return false;

  const sourceHasDirectRights = isWorkspaceDirectContactSource(input.contactSource);
  return nextEmail !== normalizeLedgerContactEmail(input.currentEmail) ||
    !sourceHasDirectRights ||
    !input.contactRightsAttestedAt;
}

export type TimeSnapshot = {
  event: string;
  course: string;
  seconds: number;
  swimTime: string;
  swimDate: string | null;
  score: number | null;
};

export type LedgerRecruit = {
  id: string;
  memberId: string | null;
  fullName: string;
  gender: Gender | null;
  classYear: number | null;
  classYearMin: number | null;
  classYearMax: number | null;
  classConfidence: "exact" | "high" | "estimated" | "coach" | null;
  lsc: string | null;
  club: string | null;
  clubCode: string | null;
  bestEvent: string | null;
  bestTime: string | null;
  swimcloudUrl: string | null;
  stage: RecruitStage;
  priority: RecruitPriority | null;
  email: string | null;
  contactSource: LedgerContactSource;
  contactRightsAttestedAt: string | null;
  phone: string | null;
  notes: string | null;
  lastContactedAt: string | null;
  snapshots: TimeSnapshot[];
};
