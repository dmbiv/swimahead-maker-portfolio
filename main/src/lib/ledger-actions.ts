"use server";

import { revalidatePath } from "next/cache";
import { requireCoachWorkspace } from "./auth";
import { createClient } from "./supabase/server";
import { createAdminClient } from "./supabase/admin";
import { idChunks } from "./paginated-query";
import { CURRENT_SEASON_KEY } from "./recruit-pool-query";
import { performanceScore } from "./performance-points";
import { EVENT_LABELS, EVENT_ORDER } from "./events";
import { fmtClock, parseClock } from "./time";
import type { EventCode, Gender } from "./types";
import {
  RECRUIT_STAGES,
  isValidLedgerContactEmail,
  ledgerEmailNeedsRightsAttestation,
  normalizeLedgerContactEmail,
  type LedgerContactSource,
  type RecruitStage,
  type RecruitPriority,
  type TimeSnapshot,
  type LedgerRecruit,
} from "./ledger-defs";

type RecruitRow = {
  id: string;
  swims_member_id: string | null;
  full_name: string;
  gender: Gender | null;
  class_year: number | null;
  class_year_min: number | null;
  class_year_max: number | null;
  class_confidence: "exact" | "high" | "estimated" | "coach" | null;
  lsc_code: string | null;
  club_name: string | null;
  club_code: string | null;
  best_event: string | null;
  best_time: string | null;
  swimcloud_url: string | null;
  stage: RecruitStage;
  priority: RecruitPriority | null;
  email: string | null;
  contact_source: LedgerContactSource;
  contact_rights_attested_at: string | null;
  phone: string | null;
  notes: string | null;
  last_contacted_at: string | null;
};

type SnapshotRow = {
  recruit_id: string;
  event: string;
  course: string;
  seconds: number;
  swim_time: string;
  swim_date: string | null;
};

export async function listLedger(campaignId: string, bucket: "ledger" | "questionnaire" = "ledger"): Promise<LedgerRecruit[]> {
  const { membership } = await requireCoachWorkspace();
  const supabase = await createClient();

  const { data: recruits } = await supabase
    .from("campaign_recruits")
    .select(
      "id,swims_member_id,full_name,gender,class_year,class_year_min,class_year_max,class_confidence,lsc_code,club_name,club_code,best_event,best_time,swimcloud_url,stage,priority,email,contact_source,contact_rights_attested_at,phone,notes,last_contacted_at",
    )
    .eq("campaign_id", campaignId)
    .eq("workspace_id", membership.workspaceId)
    .eq("bucket", bucket)
    .order("priority", { ascending: true, nullsFirst: false })
    .order("full_name");

  const rows = (recruits ?? []) as RecruitRow[];
  const ids = rows.map((r) => r.id);

  const snapshotsByRecruit = new Map<string, TimeSnapshot[]>();
  if (ids.length > 0) {
    const pages = await Promise.all(idChunks(ids).map((chunk) => supabase
      .from("recruit_time_snapshots")
      .select("recruit_id,event,course,seconds,swim_time,swim_date")
      .in("recruit_id", chunk)
      .order("swim_date", { ascending: true })));
    const snaps = pages.flatMap((page) => page.data ?? []);
    for (const s of snaps as SnapshotRow[]) {
      const list = snapshotsByRecruit.get(s.recruit_id) ?? [];
      list.push({
        event: s.event,
        course: s.course,
        seconds: Number(s.seconds),
        swimTime: s.swim_time,
        swimDate: s.swim_date,
        score: null,
      });
      snapshotsByRecruit.set(s.recruit_id, list);
    }
  }

  return rows.map((r) => ({
    id: r.id,
    memberId: r.swims_member_id,
    fullName: r.full_name,
    gender: r.gender,
    classYear: r.class_year,
    classYearMin: r.class_year_min,
    classYearMax: r.class_year_max,
    classConfidence: r.class_confidence,
    lsc: r.lsc_code,
    club: r.club_name,
    clubCode: r.club_code?.trim().toUpperCase() || null,
    bestEvent: r.best_event,
    bestTime: r.best_time,
    swimcloudUrl: r.swimcloud_url,
    stage: r.stage,
    priority: r.priority,
    email: r.email,
    contactSource: r.contact_source,
    contactRightsAttestedAt: r.contact_rights_attested_at,
    phone: r.phone,
    notes: r.notes,
    lastContactedAt: r.last_contacted_at,
    snapshots: (snapshotsByRecruit.get(r.id) ?? []).map((s) => ({
      ...s,
      score: performanceScore({ event: s.event as EventCode, course: s.course as "SCY" | "SCM" | "LCM", seconds: s.seconds }, r.gender ?? "M")?.value ?? null,
    })),
  }));
}

const UUID_RE = /^[0-9a-f-]{36}$/i;

export async function updateRecruit(input: {
  recruitId: string;
  campaignId: string;
  stage?: RecruitStage;
  priority?: RecruitPriority | null;
  email?: string | null;
  emailRightsAttested?: boolean;
  phone?: string | null;
  notes?: string | null;
  markContacted?: boolean;
}): Promise<{ ok: boolean; error: string | null }> {
  const { membership } = await requireCoachWorkspace();
  if (membership.role === "viewer") return { ok: false, error: "You do not have permission to edit recruits." };
  if (!UUID_RE.test(input.recruitId) || !UUID_RE.test(input.campaignId)) {
    return { ok: false, error: "Invalid recruit or campaign." };
  }
  if (input.stage !== undefined && !RECRUIT_STAGES.includes(input.stage)) {
    return { ok: false, error: "Choose a valid recruiting stage." };
  }
  if (input.priority !== undefined && input.priority !== null && !["high", "medium", "low"].includes(input.priority)) {
    return { ok: false, error: "Choose a valid priority." };
  }
  if (input.email !== undefined && input.email !== null && typeof input.email !== "string") {
    return { ok: false, error: "Enter a valid email address." };
  }
  if (input.phone !== undefined && input.phone !== null && typeof input.phone !== "string") {
    return { ok: false, error: "Enter a valid phone number." };
  }
  if (input.notes !== undefined && input.notes !== null && typeof input.notes !== "string") {
    return { ok: false, error: "Enter valid notes." };
  }

  const supabase = await createClient();
  const { data: recruit, error: recruitError } = await supabase
    .from("campaign_recruits")
    .select("id,email,phone,notes,contact_source,contact_rights_attested_at")
    .eq("id", input.recruitId)
    .eq("campaign_id", input.campaignId)
    .eq("workspace_id", membership.workspaceId)
    .maybeSingle();
  if (recruitError || !recruit) return { ok: false, error: "Recruit not found in this campaign." };

  const current = recruit as {
    email: string | null;
    phone: string | null;
    notes: string | null;
    contact_source: LedgerContactSource;
    contact_rights_attested_at: string | null;
  };
  const emailWasProvided = input.email !== undefined;
  const nextEmail = emailWasProvided ? normalizeLedgerContactEmail(input.email) : normalizeLedgerContactEmail(current.email);
  if (emailWasProvided && nextEmail && !isValidLedgerContactEmail(nextEmail)) {
    return { ok: false, error: "Enter a valid email address." };
  }

  const emailNeedsRights = emailWasProvided && ledgerEmailNeedsRightsAttestation({
    currentEmail: current.email,
    nextEmail,
    contactSource: current.contact_source,
    contactRightsAttestedAt: current.contact_rights_attested_at,
  });
  if (emailNeedsRights && input.emailRightsAttested !== true) {
    return { ok: false, error: "Confirm that your program has permission to use this email for one-to-one recruiting communication." };
  }

  const emailChanged = nextEmail !== normalizeLedgerContactEmail(current.email);
  const mustWriteAttestedEmail = emailWasProvided && (emailChanged || emailNeedsRights);
  if (mustWriteAttestedEmail) {
    const { error } = await supabase.rpc("update_campaign_recruit_contact", {
      p_recruit_id: input.recruitId,
      p_email: nextEmail,
      p_email_rights_attested: nextEmail ? input.emailRightsAttested === true : false,
      p_phone: input.phone !== undefined ? input.phone : current.phone,
      p_notes: input.notes !== undefined ? input.notes : current.notes,
    });
    if (error) return { ok: false, error: "Could not save the recruit's contact details. Try again." };
  }

  const patch: Record<string, unknown> = {};
  if (input.stage !== undefined) patch.stage = input.stage;
  if (input.priority !== undefined) patch.priority = input.priority;
  if (!mustWriteAttestedEmail && input.phone !== undefined) patch.phone = input.phone?.trim().slice(0, 40) || null;
  if (!mustWriteAttestedEmail && input.notes !== undefined) patch.notes = input.notes?.slice(0, 10000) || null;
  if (input.markContacted) {
    patch.last_contacted_at = new Date().toISOString();
    if (input.stage === undefined) patch.stage = "contacted";
  }

  if (Object.keys(patch).length > 0) {
    patch.updated_at = new Date().toISOString();
    const { data: updated, error } = await supabase
      .from("campaign_recruits")
      .update(patch)
      .eq("id", input.recruitId)
      .eq("campaign_id", input.campaignId)
      .eq("workspace_id", membership.workspaceId)
      .select("id")
      .maybeSingle();
    if (error) return { ok: false, error: "Could not save. Try again." };
    if (!updated) return { ok: false, error: "The recruit changed campaigns. Refresh and try again." };
  }
  revalidatePath(`/c/campaigns/${input.campaignId}`);
  return { ok: true, error: null };
}

export async function removeRecruit(recruitId: string, campaignId: string): Promise<{ ok: boolean }> {
  const { membership } = await requireCoachWorkspace();
  const supabase = await createClient();
  const { error } = await supabase
    .from("campaign_recruits")
    .delete()
    .eq("id", recruitId)
    .eq("workspace_id", membership.workspaceId);
  revalidatePath(`/c/campaigns/${campaignId}`);
  return { ok: !error };
}

export async function refreshRecruitTimes(recruitId: string, campaignId: string): Promise<{ ok: boolean; added: number; error: string | null }> {
  const { membership } = await requireCoachWorkspace();
  const supabase = await createClient();

  const { data: recruit } = await supabase
    .from("campaign_recruits")
    .select("id,swims_member_id,gender,workspace_id")
    .eq("id", recruitId)
    .eq("workspace_id", membership.workspaceId)
    .maybeSingle();
  const memberId = (recruit as { swims_member_id: string | null } | null)?.swims_member_id;
  if (!memberId) return { ok: false, added: 0, error: "This recruit has no USA Swimming id to refresh from." };
  const gender = (recruit as { gender: Gender | null }).gender ?? "M";

  const { data: prospects } = await supabase
    .from("recruit_prospects")
    .select("event,seconds,swim_time,swim_date")
    .eq("member_id", memberId)
    .eq("gender", gender)
    .eq("season_key", CURRENT_SEASON_KEY);

  const rows = ((prospects ?? []) as { event: string; seconds: number; swim_time: string; swim_date: string | null }[]).map((p) => ({
    recruit_id: recruitId,
    workspace_id: membership.workspaceId,
    event: p.event,
    course: "SCY",
    seconds: p.seconds,
    swim_time: p.swim_time,
    swim_date: p.swim_date,
    source: "pool",
  }));
  if (rows.length === 0) return { ok: true, added: 0, error: "No pooled times found yet for this recruit." };

  const { error } = await supabase
    .from("recruit_time_snapshots")
    .upsert(rows, { onConflict: "recruit_id,event,course,seconds", ignoreDuplicates: true });
  if (error) return { ok: false, added: 0, error: "Could not refresh times. Try again." };
  revalidatePath(`/c/campaigns/${campaignId}`);
  return { ok: true, added: rows.length, error: null };
}

export async function addManualRecruit(input: {
  campaignId: string;
  fullName: string;
  lsc?: string | null;
  club?: string | null;
  bestEvent?: EventCode | null;
  bestTime?: string | null;
  swimcloudUrl?: string | null;
}): Promise<{ ok: boolean; error: string | null }> {
  const { context, membership } = await requireCoachWorkspace();
  const supabase = await createClient();

  const { data: campaign } = await supabase
    .from("recruiting_campaigns")
    .select("id,class_year,gender")
    .eq("id", input.campaignId)
    .eq("workspace_id", membership.workspaceId)
    .maybeSingle();
  if (!campaign) return { ok: false, error: "Campaign not found." };
  const { class_year: classYear, gender } = campaign as { class_year: number; gender: Gender };

  const fullName = input.fullName.trim();
  if (fullName.length < 1 || fullName.length > 120) return { ok: false, error: "Enter the swimmer's name." };

  const lsc = input.lsc?.trim().toUpperCase() || null;
  const club = input.club?.trim().slice(0, 200) || null;

  const swimcloudUrl = input.swimcloudUrl?.trim() || null;
  if (swimcloudUrl && !/^https:\/\//.test(swimcloudUrl)) {
    return { ok: false, error: "The SwimCloud link must start with https://." };
  }

  const event = input.bestEvent ?? null;
  if (event && !(EVENT_ORDER as EventCode[]).includes(event)) return { ok: false, error: "Pick a valid event." };
  const rawTime = input.bestTime?.trim() || null;
  let bestEventLabel: string | null = null;
  let bestTime: string | null = null;
  let seconds: number | null = null;
  if (event && rawTime) {
    seconds = parseClock(rawTime);
    if (seconds == null) return { ok: false, error: "Enter the best time like 1:52.34 or 52.30." };
    bestEventLabel = EVENT_LABELS[event];
    bestTime = fmtClock(seconds);  
  } else if (event && !rawTime) {
    return { ok: false, error: "Add a time for the event, or clear the event." };
  } else if (!event && rawTime) {
    return { ok: false, error: "Pick the event for that time." };
  }

  const { data: inserted, error } = await supabase
    .from("campaign_recruits")
    .insert({
      campaign_id: input.campaignId,
      workspace_id: membership.workspaceId,
      swims_member_id: null,
      full_name: fullName,
      gender,
      class_year: classYear,
      class_year_min: classYear,
      class_year_max: classYear,
      class_confidence: "coach",
      lsc_code: lsc,
      club_name: club,
      best_event: bestEventLabel,
      best_time: bestTime,
      swimcloud_url: swimcloudUrl,
      bucket: "ledger",
      added_by: context.userId,
    })
    .select("id")
    .single();
  if (error || !inserted) return { ok: false, error: "Could not add the swimmer. Try again." };

  if (event && seconds != null && bestTime) {
    await supabase.from("recruit_time_snapshots").upsert(
      {
        recruit_id: inserted.id,
        workspace_id: membership.workspaceId,
        event,
        course: "SCY",
        seconds,
        swim_time: bestTime,
        swim_date: null,
        source: "manual",
      },
      { onConflict: "recruit_id,event,course,seconds", ignoreDuplicates: true },
    );
  }

  revalidatePath(`/c/campaigns/${input.campaignId}`);
  return { ok: true, error: null };
}

export type MoveTarget = { id: string; name: string; classYear: number; gender: Gender };

export async function listMoveTargets(recruitId: string): Promise<MoveTarget[]> {
  const { membership } = await requireCoachWorkspace();
  if (!UUID_RE.test(recruitId)) return [];
  const supabase = await createClient();

  const { data: recruit } = await supabase
    .from("campaign_recruits")
    .select("campaign_id")
    .eq("id", recruitId)
    .eq("workspace_id", membership.workspaceId)
    .maybeSingle();
  const currentCampaignId = (recruit as { campaign_id: string } | null)?.campaign_id;
  if (!currentCampaignId) return [];

  const { data: current } = await supabase
    .from("recruiting_campaigns")
    .select("college_id")
    .eq("id", currentCampaignId)
    .maybeSingle();
  const collegeId = (current as { college_id: string | null } | null)?.college_id;
  if (!collegeId) return [];

  const { data: campaigns } = await supabase
    .from("recruiting_campaigns")
    .select("id,name,class_year,gender")
    .eq("workspace_id", membership.workspaceId)
    .eq("college_id", collegeId)
    .eq("status", "active")
    .neq("id", currentCampaignId)
    .order("class_year", { ascending: false })
    .order("name");

  return ((campaigns ?? []) as { id: string; name: string; class_year: number; gender: Gender }[]).map((c) => ({
    id: c.id,
    name: c.name,
    classYear: c.class_year,
    gender: c.gender,
  }));
}

export async function moveRecruitToCampaign(input: {
  recruitId: string;
  fromCampaignId: string;
  toCampaignId: string;
}): Promise<{ ok: boolean; error: string | null }> {
  const { membership } = await requireCoachWorkspace();
  if (membership.role === "viewer") return { ok: false, error: "You do not have permission to move recruits." };
  if (!UUID_RE.test(input.recruitId) || !UUID_RE.test(input.fromCampaignId) || !UUID_RE.test(input.toCampaignId)) {
    return { ok: false, error: "Invalid recruit or campaign." };
  }
  if (input.toCampaignId === input.fromCampaignId) return { ok: false, error: "That's the same campaign." };
  const supabase = await createClient();

  const { data: recruit } = await supabase
    .from("campaign_recruits")
    .select("id,class_confidence,campaign_id")
    .eq("id", input.recruitId)
    .eq("workspace_id", membership.workspaceId)
    .maybeSingle();
  const row = recruit as
    | { class_confidence: string | null; campaign_id: string }
    | null;
  if (!row) return { ok: false, error: "Recruit not found." };
  if (row.campaign_id !== input.fromCampaignId) {
    return { ok: false, error: "The recruit is no longer in that campaign. Refresh and try again." };
  }

  const [{ data: sourceData }, { data: destinationData }] = await Promise.all([
    supabase
      .from("recruiting_campaigns")
      .select("id,college_id")
      .eq("id", input.fromCampaignId)
      .eq("workspace_id", membership.workspaceId)
      .maybeSingle(),
    supabase
      .from("recruiting_campaigns")
      .select("id,college_id,class_year,gender,status")
      .eq("id", input.toCampaignId)
      .eq("workspace_id", membership.workspaceId)
      .maybeSingle(),
  ]);
  const source = sourceData as { college_id: string | null } | null;
  const destination = destinationData as {
    college_id: string | null;
    class_year: number;
    gender: Gender;
    status: string;
  } | null;
  if (!source || !destination || destination.status !== "active") {
    return { ok: false, error: "Destination campaign not found." };
  }
  if (!source.college_id || destination.college_id !== source.college_id) {
    return { ok: false, error: "Recruits can move only between campaigns for the same program." };
  }

  const isCoachClass = row.class_confidence === "coach";
  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, error: "Could not move the recruit. Try again." };
  }
  const { data: moved, error } = await admin
    .from("campaign_recruits")
    .update({
      campaign_id: input.toCampaignId,
      gender: destination.gender,
      class_year: isCoachClass ? destination.class_year : null,
      class_year_min: destination.class_year,
      class_year_max: destination.class_year,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.recruitId)
    .eq("workspace_id", membership.workspaceId)
    .eq("campaign_id", input.fromCampaignId)
    .select("id")
    .maybeSingle();
  if (error) {
    if (/duplicate|unique/i.test(error.message)) {
      return { ok: false, error: "That campaign already has this swimmer." };
    }
    return { ok: false, error: "Could not move the recruit. Try again." };
  }
  if (!moved) return { ok: false, error: "The recruit changed campaigns. Refresh and try again." };

  revalidatePath(`/c/campaigns/${input.fromCampaignId}`);
  revalidatePath(`/c/campaigns/${input.toCampaignId}`);
  return { ok: true, error: null };
}
