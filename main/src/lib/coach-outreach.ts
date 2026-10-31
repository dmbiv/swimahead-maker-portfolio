"use server";

import { revalidatePath } from "next/cache";
import { createHash } from "node:crypto";
import { z } from "zod";
import { requireCoachWorkspace } from "./auth";
import { getCoachCollege } from "./coach-college";
import { renderCoachContactMessage } from "./coach-contact-message";
import {
  createOutreachIdempotencyKey,
  outreachRouteDestinationVersion,
} from "./coach-outreach-idempotency";
import { contactRule } from "./compliance";
import {
  ContactRouteResolutionError,
  resolveContactRoutes,
  hasVerifiedCoachAuthority,
} from "./contact-routes";
import { toPublicContactRouteDto, type SelectedContactRoute } from "./contact-route-core";
import { createContactRelayAlias, isContactRelayDeliveryConfigured } from "./contact-relay";
import {
  CONTACT_RELAY_SENDER_PREFLIGHT_REQUIRED,
  hasApprovedContactRelaySenderConnection,
} from "./contact-relay-preflight";
import { createClient } from "./supabase/server";
import { gmailComposeUrl, mailtoUrl, gmailSearchThreadUrl } from "./gmail";
import { sanitizeEmailHtml } from "./email-html";
import { type EmailBodyFormat } from "./email-content";
import { getUsableEmailSender, listEmailSenderConnections, EmailConnectionError } from "./email/connections";
import {
  canonicalOutreachSubject,
  sendOutreachWithProvider,
  CoachEmailProviderError,
} from "./email/outreach-provider";
import { PUBLIC_LEGAL_CONTACT } from "./legal";
import { createAdminClient } from "./supabase/admin";
import type { Division } from "./types";
import type { WorkspaceDirectContactSource } from "./workspace-contact-provenance";
import type {
  BuildCampaignOutreachResult,
  ConnectedSender,
  OutreachRecipient,
  OutreachTemplate,
  ProviderOutreachSendResult,
} from "./coach-outreach-defs";


type TemplateRow = { id: string; name: string; subject_template: string; body_template: string; body_format: EmailBodyFormat | null };

export async function listTemplates(): Promise<OutreachTemplate[]> {
  const { membership } = await requireCoachWorkspace();
  const supabase = await createClient();
  const { data } = await supabase
    .from("coach_outreach_templates")
    .select("id,name,subject_template,body_template,body_format")
    .eq("workspace_id", membership.workspaceId)
    .order("name");
  return ((data ?? []) as TemplateRow[]).map((t) => ({
    id: t.id,
    name: t.name,
    subject: t.subject_template,
    body: t.body_template,
    bodyFormat: t.body_format === "html" ? "html" : "text",
  }));
}

export async function saveTemplate(input: {
  id?: string | null;
  name: string;
  subject: string;
  body: string;
  bodyFormat?: EmailBodyFormat;
}): Promise<{ ok: boolean; error: string | null }> {
  const { context, membership } = await requireCoachWorkspace();
  const name = input.name.trim();
  if (name.length < 1) return { ok: false, error: "Name the template." };
  if (input.subject.trim().length < 1 || input.body.trim().length < 1) return { ok: false, error: "Subject and body are required." };

  const isHtml = input.bodyFormat === "html";
  const body = isHtml ? sanitizeEmailHtml(input.body, "html") : input.body;

  const supabase = await createClient();
  const payload = {
    workspace_id: membership.workspaceId,
    name,
    subject_template: input.subject.slice(0, 500),
    body_template: body.slice(0, 100000),
    body_format: isHtml ? "html" : "text",
    created_by: context.userId,
  };
  const query = input.id
    ? supabase.from("coach_outreach_templates").update(payload).eq("id", input.id).eq("workspace_id", membership.workspaceId)
    : supabase.from("coach_outreach_templates").insert(payload);
  const { error } = await query;
  if (error) return { ok: false, error: "Could not save the template. Try again." };
  revalidatePath("/c/outreach");
  return { ok: true, error: null };
}

export async function deleteTemplate(id: string): Promise<{ ok: boolean }> {
  const { membership } = await requireCoachWorkspace();
  const supabase = await createClient();
  const { error } = await supabase
    .from("coach_outreach_templates")
    .delete()
    .eq("id", id)
    .eq("workspace_id", membership.workspaceId);
  revalidatePath("/c/outreach");
  return { ok: !error };
}

const buildInputSchema = z.object({
  campaignId: z.string().uuid(),
  templateId: z.string().uuid(),
  bucket: z.enum(["ledger", "questionnaire"]).default("ledger"),
  connectionId: z.string().uuid().optional(),
}).strict();

const sendInputSchema = z.object({
  campaignId: z.string().uuid(),
  recruitId: z.string().uuid(),
  connectionId: z.string().uuid(),
  templateId: z.string().uuid(),
}).strict();

type CampaignOutreachRow = {
  id: string;
  class_year: number;
  college_id: string | null;
  status: "active" | "archived";
};

type ContactRecruitRow = {
  id: string;
  full_name: string;
  email: string | null;
  contact_name: string | null;
  contact_relationship: string | null;
  swims_member_id: string | null;
  lsc_code: string | null;
  club_code: string | null;
  best_event: string | null;
  best_time: string | null;
  class_year: number | null;
  class_year_min: number | null;
  class_year_max: number | null;
  club_name: string | null;
  contact_source: WorkspaceDirectContactSource | null;
  contact_rights_attested_at: string | null;
};

type SendGate = { allowed: true; reason: null } | { allowed: false; reason: string };

function emptyBuild(error: string): BuildCampaignOutreachResult {
  return { ok: false, recipients: [], error, sendAllowed: false, sendBlockedReason: null };
}

function normalizedDivision(value: string | null): Division | null {
  const normalized = value?.trim().toUpperCase().replace(/[._-]+/g, " ").replace(/\s+/g, " ") ?? "";
  if (["D1", "DI", "DIVISION I", "NCAA DIVISION I", "NCAA D1"].includes(normalized)) return "D1";
  if (["D2", "DII", "DIVISION II", "NCAA DIVISION II", "NCAA D2"].includes(normalized)) return "D2";
  if (["D3", "DIII", "DIVISION III", "NCAA DIVISION III", "NCAA D3"].includes(normalized)) return "D3";
  if (normalized === "NAIA") return "NAIA";
  return null;
}

async function outreachProgramGate(input: {
  userId: string;
  workspaceId: string;
  workspaceRole: string;
  athleticProgramId: string;
  division: string | null;
}): Promise<SendGate> {
  if (input.workspaceRole === "viewer") {
    return { allowed: false, reason: "Your workspace role cannot send recruiting email." };
  }
  const division = normalizedDivision(input.division);
  if (!division) {
    return { allowed: false, reason: "This program's division is not verified, so the contact-date gate cannot be evaluated." };
  }
  if (!PUBLIC_LEGAL_CONTACT.postalAddress) {
    return { allowed: false, reason: "A legal postal address must be configured before recruiting email can be sent." };
  }
  let hasAuthority = false;
  try {
    hasAuthority = await hasVerifiedCoachAuthority({
      userId: input.userId,
      workspaceId: input.workspaceId,
      athleticProgramId: input.athleticProgramId,
    });
  } catch {
    hasAuthority = false;
  }
  if (!hasAuthority) {
    return { allowed: false, reason: "Verify that you are authorized to recruit for this college program before sending." };
  }
  return { allowed: true, reason: null };
}

function conservativeRecruitClassYear(campaignClassYear: number, recruit: ContactRecruitRow): number {
  const candidates = [
    campaignClassYear,
    recruit.class_year,
    recruit.class_year_min,
    recruit.class_year_max,
  ].filter((value): value is number => typeof value === "number" && Number.isInteger(value) && value >= 2000 && value <= 2100);
  return Math.max(...candidates);
}

function outreachDateGate(divisionValue: string | null, classYear: number): SendGate {
  const division = normalizedDivision(divisionValue);
  if (!division) {
    return { allowed: false, reason: "This program's division is not verified, so the contact-date gate cannot be evaluated." };
  }
  const rule = contactRule(classYear, division);
  return rule.open ? { allowed: true, reason: null } : { allowed: false, reason: rule.detail };
}

function relationship(value: string | null): "athlete" | "parent_guardian" | null {
  return value === "athlete" || value === "parent_guardian" ? value : null;
}

function routeRecruit(workspaceId: string, recruit: ContactRecruitRow) {
  return {
    id: recruit.id,
    workspaceId,
    memberId: recruit.swims_member_id,
    lscCode: recruit.lsc_code,
    clubCode: recruit.club_code,
    directEmail: recruit.email,
    directContactName: recruit.contact_name,
    directRelationship: relationship(recruit.contact_relationship),
    directContactSource: recruit.contact_source,
    directRightsAttestedAt: recruit.contact_rights_attested_at,
  };
}

function messageRecruit(recruit: ContactRecruitRow) {
  return {
    fullName: recruit.full_name,
    bestEvent: recruit.best_event,
    bestTime: recruit.best_time,
    classYear: recruit.class_year,
    classYearMin: recruit.class_year_min,
    classYearMax: recruit.class_year_max,
    clubName: recruit.club_name,
  };
}

export async function buildCampaignOutreach(input: {
  campaignId: string;
  templateId: string;
  bucket?: "ledger" | "questionnaire";
  connectionId?: string;
}): Promise<BuildCampaignOutreachResult> {
  const parsed = buildInputSchema.safeParse(input);
  if (!parsed.success) return emptyBuild("Choose a valid campaign and template.");
  const { context, membership } = await requireCoachWorkspace();
  const supabase = await createClient();
  const [{ data: campaignData, error: campaignError }, { data: templateData, error: templateError }] = await Promise.all([
    supabase
      .from("recruiting_campaigns")
      .select("id,class_year,college_id,status")
      .eq("id", parsed.data.campaignId)
      .eq("workspace_id", membership.workspaceId)
      .maybeSingle(),
    supabase
      .from("coach_outreach_templates")
      .select("subject_template,body_template,body_format")
      .eq("id", parsed.data.templateId)
      .eq("workspace_id", membership.workspaceId)
      .maybeSingle(),
  ]);
  if (campaignError || !campaignData) return emptyBuild("Campaign not found.");
  if (templateError || !templateData) return emptyBuild("Template not found.");
  const campaign = campaignData as CampaignOutreachRow;
  if (campaign.status !== "active" || !campaign.college_id) return emptyBuild("Only an active campaign attached to a college can send outreach.");
  const college = await getCoachCollege(membership, campaign.college_id);
  if (!college) return emptyBuild("This campaign is not attached to one of your programs.");

  const { data: recruitData, error: recruitError } = await supabase
    .from("campaign_recruits")
    .select("id,full_name,email,contact_name,contact_relationship,swims_member_id,lsc_code,club_code,best_event,best_time,class_year,class_year_min,class_year_max,club_name,contact_source,contact_rights_attested_at")
    .eq("campaign_id", campaign.id)
    .eq("workspace_id", membership.workspaceId)
    .eq("bucket", parsed.data.bucket)
    .order("full_name");
  if (recruitError) return emptyBuild("Campaign contacts could not be loaded. Please try again later.");

  const recruits = (recruitData ?? []) as ContactRecruitRow[];
  const programGate = await outreachProgramGate({
    userId: context.userId,
    workspaceId: membership.workspaceId,
    workspaceRole: membership.role,
    athleticProgramId: college.athleticProgramId,
    division: college.division,
  });
  const relayDeliveryConfigured = isContactRelayDeliveryConfigured();
  const selectedSenderPreflightApproved = programGate.allowed &&
    relayDeliveryConfigured &&
    parsed.data.connectionId
    ? await hasApprovedContactRelaySenderConnection({
        connectionId: parsed.data.connectionId,
        workspaceId: membership.workspaceId,
        ownerUserId: context.userId,
      })
    : false;
  let routes = new Map<string, SelectedContactRoute>();
  if (programGate.allowed) {
    try {
      routes = await resolveContactRoutes(
        membership.workspaceId,
        recruits.map((recruit) => routeRecruit(membership.workspaceId, recruit)),
      );
    } catch (error) {
      if (error instanceof ContactRouteResolutionError) {
        return emptyBuild("Contact routes could not be verified safely. Try again after the routing service is available.");
      }
      return emptyBuild("Contact routes could not be prepared safely.");
    }
  }
  const template = templateData as { subject_template: string; body_template: string; body_format: EmailBodyFormat | null };
  const coachName = context.displayName.trim() || "Coach";
  const postalAddress = PUBLIC_LEGAL_CONTACT.postalAddress ?? "";

  let renderFailed = false;
  const recipients: OutreachRecipient[] = recruits.map((recruit) => {
    const dateGate = outreachDateGate(
      college.division,
      conservativeRecruitClassYear(campaign.class_year, recruit),
    );
    const recipientGate = programGate.allowed ? dateGate : programGate;
    const route = routes.get(recruit.id) ?? { kind: "none" as const };
    const publicRoute = toPublicContactRouteDto(route);
    if (route.kind === "none") {
      return {
        recruitId: recruit.id,
        fullName: recruit.full_name,
        email: null,
        route: publicRoute,
        subject: "",
        body: "",
        bodyHtml: "",
        composeUrl: null,
        mailtoUrl: null,
        threadUrl: null,
        canProviderSend: false,
        blockedReason: recipientGate.reason ?? "Add this recruit's email on their row in the campaign ledger.",
      };
    }
    let rendered: ReturnType<typeof renderCoachContactMessage>;
    try {
      rendered = renderCoachContactMessage({
        recruit: messageRecruit(recruit),
        template: {
          subjectTemplate: template.subject_template,
          bodyTemplate: template.body_template,
          bodyFormat: template.body_format,
        },
        route,
        coachName,
        programName: college.name,
        operatorName: PUBLIC_LEGAL_CONTACT.operatorName,
        postalAddress,
        optOutEmail: PUBLIC_LEGAL_CONTACT.privacyEmail,
        revealWorkspaceContactName: route.kind === "workspace_direct",
      });
    } catch {
      renderFailed = true;
      return {
        recruitId: recruit.id,
        fullName: recruit.full_name,
        email: route.kind === "workspace_direct" ? route.destinationEmail : null,
        route: publicRoute,
        subject: "",
        body: "",
        bodyHtml: "",
        composeUrl: null,
        mailtoUrl: null,
        threadUrl: null,
        canProviderSend: false,
        blockedReason: "The selected template could not be rendered safely for this recruit.",
      };
    }
    const directEmail = route.kind === "workspace_direct" ? route.destinationEmail : null;
    const protectedRoute = route.kind !== "workspace_direct";
    const relayUnavailable = protectedRoute && !relayDeliveryConfigured;
    const senderPreflightUnavailable = protectedRoute &&
      relayDeliveryConfigured &&
      !selectedSenderPreflightApproved;
    const blockedReason = recipientGate.reason ?? (relayUnavailable
      ? "The protected mail relay is not enabled on this deployment."
      : senderPreflightUnavailable
        ? CONTACT_RELAY_SENDER_PREFLIGHT_REQUIRED
        : null);
    const canProviderSend = recipientGate.allowed && !relayUnavailable && !senderPreflightUnavailable;
    const allowCompose = Boolean(directEmail && canProviderSend);
    const previewSubject = canonicalOutreachSubject(rendered.subject);
    return {
      recruitId: recruit.id,
      fullName: recruit.full_name,
      email: directEmail,
      route: publicRoute,
      subject: previewSubject,
      body: rendered.text,
      bodyHtml: rendered.html,
      composeUrl: allowCompose ? gmailComposeUrl(directEmail!, previewSubject, rendered.text) : null,
      mailtoUrl: allowCompose ? mailtoUrl(directEmail!, previewSubject, rendered.text) : null,
      threadUrl: allowCompose ? gmailSearchThreadUrl({ email: directEmail, name: recruit.full_name }) : null,
      canProviderSend,
      blockedReason,
    };
  });
  const browserRecipients = renderFailed
    ? recipients.map((recipient) => ({
        ...recipient,
        composeUrl: null,
        mailtoUrl: null,
        threadUrl: null,
        canProviderSend: false,
        blockedReason: "The template or required legal footer could not be rendered safely.",
      }))
    : recipients;

  const sendAllowed = !renderFailed && browserRecipients.some((recipient) => recipient.canProviderSend);

  return {
    ok: true,
    recipients: browserRecipients,
    error: null,
    sendAllowed,
    sendBlockedReason: programGate.reason ?? (renderFailed
      ? "The template or required legal footer could not be rendered safely."
      : sendAllowed
        ? null
        : "None of these recruits currently has an email address this program can send to."),
  };
}

export async function listConnectedSenders(): Promise<ConnectedSender[]> {
  const { membership } = await requireCoachWorkspace();
  try {
    const connections = await listEmailSenderConnections(membership.workspaceId);
    return connections
      .filter((c) => c.status === "connected")
      .map((c) => ({ connectionId: c.id, provider: c.provider, senderEmail: c.senderEmail, displayName: c.displayName }));
  } catch {
    return [];
  }
}

export async function sendOutreachViaProvider(input: {
  campaignId: string;
  recruitId: string;
  connectionId: string;
  templateId: string;
}): Promise<ProviderOutreachSendResult> {
  const parsed = sendInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, status: "failed", error: "Choose a valid campaign, recruit, template, and mailbox." };
  }
  const { context, membership } = await requireCoachWorkspace();
  if (membership.role === "viewer") {
    return { ok: false, status: "failed", error: "Your workspace role cannot send recruiting email." };
  }
  const supabase = await createClient();
  const [{ data: campaignData }, { data: templateData }, { data: recruitData }] = await Promise.all([
    supabase
      .from("recruiting_campaigns")
      .select("id,class_year,college_id,status")
      .eq("id", parsed.data.campaignId)
      .eq("workspace_id", membership.workspaceId)
      .maybeSingle(),
    supabase
      .from("coach_outreach_templates")
      .select("subject_template,body_template,body_format")
      .eq("id", parsed.data.templateId)
      .eq("workspace_id", membership.workspaceId)
      .maybeSingle(),
    supabase
      .from("campaign_recruits")
      .select("id,full_name,email,contact_name,contact_relationship,swims_member_id,lsc_code,club_code,best_event,best_time,class_year,class_year_min,class_year_max,club_name,contact_source,contact_rights_attested_at")
      .eq("id", parsed.data.recruitId)
      .eq("campaign_id", parsed.data.campaignId)
      .eq("workspace_id", membership.workspaceId)
      .maybeSingle(),
  ]);
  if (!campaignData || !templateData || !recruitData) {
    return { ok: false, status: "failed", error: "The campaign, recruit, or template is no longer available." };
  }
  const campaign = campaignData as CampaignOutreachRow;
  if (campaign.status !== "active" || !campaign.college_id) {
    return { ok: false, status: "failed", error: "Only an active campaign attached to a college can send outreach." };
  }
  const college = await getCoachCollege(membership, campaign.college_id);
  if (!college) {
    return { ok: false, status: "failed", error: "This campaign is not attached to one of your programs." };
  }
  const programGate = await outreachProgramGate({
    userId: context.userId,
    workspaceId: membership.workspaceId,
    workspaceRole: membership.role,
    athleticProgramId: college.athleticProgramId,
    division: college.division,
  });
  if (!programGate.allowed) return { ok: false, status: "failed", error: programGate.reason };

  const recruit = recruitData as ContactRecruitRow;
  const dateGate = outreachDateGate(
    college.division,
    conservativeRecruitClassYear(campaign.class_year, recruit),
  );
  if (!dateGate.allowed) return { ok: false, status: "failed", error: dateGate.reason };
  let routes: Map<string, SelectedContactRoute>;
  try {
    routes = await resolveContactRoutes(membership.workspaceId, [routeRecruit(membership.workspaceId, recruit)]);
  } catch {
    return { ok: false, status: "failed", error: "The contact route could not be verified safely. Try again later." };
  }
  const route = routes.get(recruit.id) ?? { kind: "none" as const };
  if (route.kind === "none") {
    return { ok: false, status: "failed", error: "No current contact route is available for this recruit." };
  }
  const protectedRoute = route.kind !== "workspace_direct";
  if (protectedRoute && !isContactRelayDeliveryConfigured()) {
    return { ok: false, status: "failed", error: "The protected mail relay is not enabled on this deployment." };
  }
  const template = templateData as { subject_template: string; body_template: string; body_format: EmailBodyFormat | null };
  let rendered: ReturnType<typeof renderCoachContactMessage>;
  try {
    rendered = renderCoachContactMessage({
      recruit: messageRecruit(recruit),
      template: {
        subjectTemplate: template.subject_template,
        bodyTemplate: template.body_template,
        bodyFormat: template.body_format,
      },
      route,
      coachName: context.displayName.trim() || "Coach",
      programName: college.name,
      operatorName: PUBLIC_LEGAL_CONTACT.operatorName,
      postalAddress: PUBLIC_LEGAL_CONTACT.postalAddress ?? "",
      optOutEmail: PUBLIC_LEGAL_CONTACT.privacyEmail,
      revealWorkspaceContactName: route.kind === "workspace_direct",
    });
  } catch {
    return { ok: false, status: "failed", error: "The selected template could not be rendered safely." };
  }

  let sender: Awaited<ReturnType<typeof getUsableEmailSender>>;
  try {
    sender = await getUsableEmailSender(membership.workspaceId, parsed.data.connectionId);
  } catch (error) {
    if (error instanceof EmailConnectionError) {
      return { ok: false, status: "failed", error: "Reconnect the selected mailbox in Settings before sending." };
    }
    return { ok: false, status: "failed", error: "The selected mailbox is unavailable." };
  }
  if (protectedRoute && !(await hasApprovedContactRelaySenderConnection({
    connectionId: parsed.data.connectionId,
    workspaceId: membership.workspaceId,
    ownerUserId: context.userId,
    expectedSenderEmail: sender.senderEmail,
  }))) {
    return { ok: false, status: "failed", error: CONTACT_RELAY_SENDER_PREFLIGHT_REQUIRED };
  }

  const providerSubject = canonicalOutreachSubject(rendered.subject);
  const providerHtml = sanitizeEmailHtml(rendered.html, "html");
  const contentSha256 = createHash("sha256")
    .update(JSON.stringify([providerSubject, providerHtml, rendered.text]), "utf8")
    .digest("hex");
  const destinationVersion = outreachRouteDestinationVersion(route);
  const idempotencyKey = createOutreachIdempotencyKey({
    workspaceId: membership.workspaceId,
    actorUserId: context.userId,
    connectionId: parsed.data.connectionId,
    campaignId: campaign.id,
    recruitId: recruit.id,
    templateId: parsed.data.templateId,
    routeKind: route.kind,
    routeId: route.routeId,
    destinationVersion,
    contentSha256,
  });
  const reservationRoute = routeReservation(route);
  let relayAlias: ReturnType<typeof createContactRelayAlias> | null = null;
  if (protectedRoute) {
    try {
      relayAlias = createContactRelayAlias();
    } catch {
      return { ok: false, status: "failed", error: "The protected mail relay is not configured safely." };
    }
  }
  const admin = createAdminClient();
  const { data: reservationData, error: reservationError } = await admin.rpc("reserve_coach_outreach_send", {
    p_actor_user_id: context.userId,
    p_workspace_id: membership.workspaceId,
    p_connection_id: parsed.data.connectionId,
    p_campaign_id: campaign.id,
    p_recruit_id: recruit.id,
    p_template_id: parsed.data.templateId,
    p_route_type: reservationRoute.routeType,
    p_contact_grant_id: reservationRoute.contactGrantId,
    p_relay_contact_id: reservationRoute.relayContactId,
    p_direct_email: reservationRoute.directEmail,
    p_route_version: reservationRoute.routeVersion,
    p_alias_token_hash: relayAlias?.tokenHash ?? null,
    p_delivery_id: relayAlias?.deliveryId ?? null,
    p_alias_expires_at: relayAlias?.expiresAt ?? null,
    p_subject: providerSubject,
    p_content_sha256: contentSha256,
    p_idempotency_key: idempotencyKey,
  });
  const reservation = reservationResult(reservationData);
  if (reservationError || !reservation) {
    return { ok: false, status: "failed", error: "The send could not be authorized. Refresh the contact route and try again." };
  }
  if (!reservation.shouldSend) {
    if (reservation.sendStatus === "provider_accepted") {
      return { ok: true, status: "already_sent", error: null };
    }
    if (reservation.sendStatus === "reserved" || reservation.sendStatus === "unknown") {
      return {
        ok: false,
        status: "unknown",
        error: "This email may already have been submitted. Check the connected mailbox's Sent folder; do not retry it automatically.",
      };
    }
    return {
      ok: false,
      status: "failed",
      error: "This exact send was rejected recently. Wait a few minutes before trying it again, or update the message now.",
    };
  }

  try {
    const accepted = await sendOutreachWithProvider({
      provider: sender.provider,
      accessToken: sender.accessToken,
      message: {
        senderEmail: sender.senderEmail,
        senderName: sender.displayName,
        recipientEmail: relayAlias?.address ?? route.destinationEmail,
        subject: providerSubject,
        html: providerHtml,
        text: rendered.text,
        deliveryId: relayAlias?.deliveryId ?? reservation.sendId.replace(/-/g, ""),
        contentSha256,
      },
    });
    const finalized = await finalizeSend({
      admin,
      actorUserId: context.userId,
      workspaceId: membership.workspaceId,
      sendId: reservation.sendId,
      status: "provider_accepted",
      providerMessageId: accepted.providerMessageId,
      providerThreadId: accepted.providerThreadId,
      errorCode: null,
    });
    revalidatePath(`/c/campaigns/${campaign.id}`);
    return {
      ok: true,
      status: "provider_accepted",
      error: finalized ? null : "The mailbox accepted the email, but its delivery record could not be finalized. Do not resend it.",
    };
  } catch (error) {
    const status = error instanceof CoachEmailProviderError && error.disposition === "rejected"
      ? "failed" as const
      : "unknown" as const;
    const retryable = error instanceof CoachEmailProviderError && error.retryable;
    const errorCode = error instanceof CoachEmailProviderError ? error.code : "unclassified_provider_result";
    await finalizeSend({
      admin,
      actorUserId: context.userId,
      workspaceId: membership.workspaceId,
      sendId: reservation.sendId,
      status,
      providerMessageId: null,
      providerThreadId: null,
      errorCode,
    });
    return status === "unknown"
      ? {
          ok: false,
          status,
          error: "The provider response was interrupted, so the email may have sent. Check Sent before taking any further action.",
        }
      : retryable
        ? {
            ok: false,
            status,
            error: "The mailbox provider is temporarily limiting sends. Wait a few minutes, then try this email again.",
          }
        : {
            ok: false,
            status,
            error: "The mailbox provider rejected this email. Reconnect the mailbox or update the message before trying again.",
          };
  }
}

type ReservationRoute = {
  routeType: "direct_workspace" | "member_grant" | "organization_relay";
  contactGrantId: string | null;
  relayContactId: string | null;
  directEmail: string | null;
  routeVersion: string | null;
};

function routeReservation(route: Exclude<SelectedContactRoute, { kind: "none" }>): ReservationRoute {
  if (route.kind === "workspace_direct") {
    return {
      routeType: "direct_workspace",
      contactGrantId: null,
      relayContactId: null,
      directEmail: route.destinationEmail,
      routeVersion: null,
    };
  }
  if (route.kind === "contact_grant") {
    return {
      routeType: "member_grant",
      contactGrantId: route.routeId,
      relayContactId: null,
      directEmail: null,
      routeVersion: route.destinationVersion,
    };
  }
  return {
    routeType: "organization_relay",
    contactGrantId: null,
    relayContactId: route.routeId,
    directEmail: null,
    routeVersion: route.destinationVersion,
  };
}

const reservationResultSchema = z.object({
  send_id: z.string().uuid(),
  send_status: z.enum(["reserved", "provider_accepted", "unknown", "failed"]),
  should_send: z.boolean(),
});

function reservationResult(value: unknown): { sendId: string; sendStatus: z.infer<typeof reservationResultSchema>["send_status"]; shouldSend: boolean } | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  const parsed = reservationResultSchema.safeParse(candidate);
  return parsed.success
    ? { sendId: parsed.data.send_id, sendStatus: parsed.data.send_status, shouldSend: parsed.data.should_send }
    : null;
}

async function finalizeSend(input: {
  admin: ReturnType<typeof createAdminClient>;
  actorUserId: string;
  workspaceId: string;
  sendId: string;
  status: "provider_accepted" | "unknown" | "failed";
  providerMessageId: string | null;
  providerThreadId: string | null;
  errorCode: string | null;
}): Promise<boolean> {
  const { error } = await input.admin.rpc("finalize_coach_outreach_send", {
    p_actor_user_id: input.actorUserId,
    p_workspace_id: input.workspaceId,
    p_send_id: input.sendId,
    p_status: input.status,
    p_provider_message_id: input.providerMessageId,
    p_provider_thread_id: input.providerThreadId,
    p_error_code: input.errorCode,
  });
  return !error;
}
