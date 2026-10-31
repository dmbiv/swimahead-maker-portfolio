
import type { PublicContactRouteDto } from "./contact-route-core";

export const OUTREACH_PLACEHOLDERS = [
  { key: "first_name", label: "Recruit first name" },
  { key: "full_name", label: "Recruit full name" },
  { key: "best_event", label: "Best event" },
  { key: "best_time", label: "Best time" },
  { key: "class_year", label: "Class year" },
  { key: "club", label: "Club or team" },
  { key: "coach_name", label: "Coach name" },
  { key: "program_name", label: "Program name" },
] as const;

export type OutreachTemplate = {
  id: string;
  name: string;
  subject: string;
  body: string;
  bodyFormat: "text" | "html";
};

export type ConnectedSender = {
  connectionId: string;
  provider: "google" | "microsoft";
  senderEmail: string;
  displayName: string;
};

export type OutreachRecipient = {
  recruitId: string;
  fullName: string;
  email: string | null;
  route: PublicContactRouteDto;
  subject: string;
  body: string;
  bodyHtml: string;
  composeUrl: string | null;
  mailtoUrl: string | null;
  threadUrl: string | null;
  canProviderSend: boolean;
  blockedReason: string | null;
};

export type BuildCampaignOutreachResult = {
  ok: boolean;
  recipients: OutreachRecipient[];
  error: string | null;
  sendAllowed: boolean;
  sendBlockedReason: string | null;
};

export type ProviderOutreachSendResult = {
  ok: boolean;
  status: "provider_accepted" | "already_sent" | "unknown" | "failed";
  error: string | null;
};
