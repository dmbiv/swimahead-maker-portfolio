"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAccountType } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  OUTREACH_DATABASE_UPDATE_ERROR,
  EMPTY_OUTREACH_TIME_CONFIG,
  OUTREACH_STAGES,
  outreachStageSupportsResults,
  outreachPlaceholderKeys,
  outreachPlaceholderCount,
  materializeOutreachTemplate,
  parseOutreachTimeConfig,
  removeOutreachResultsBlock,
  unknownOutreachPlaceholders,
  usesOutreachPlaceholder,
  type OutreachDraftStatus,
  type OutreachStage,
  type OutreachTimeConfig,
  type SwimmerOutreachDraft,
  type SwimmerOutreachTemplate,
} from "@/lib/swimmer-outreach";
import type { Course } from "@/lib/types";
import { sanitizeEmailHtml } from "@/lib/email-html";
import { emailHtmlToText } from "@/lib/email-content";
import { loadOutreachDraftEditor } from "./data";

const timeConfigSchema = z.object({
  entries: z.array(z.object({ timeId: z.string().uuid() }).passthrough()).max(8)
    .refine((entries) => new Set(entries.map((entry) => entry.timeId)).size === entries.length, "Choose each result once."),
  layout: z.enum(["inline", "lines"]),
  includeMeet: z.boolean(),
  includeDate: z.boolean(),
});

const templateSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(1).max(120),
  stage: z.enum(OUTREACH_STAGES),
  subjectTemplate: z.string().min(1).max(500).refine((value) => value.trim().length > 0),
  bodyTemplate: z.string().min(1).max(20_000).refine((value) => value.trim().length > 0),
  timeConfig: timeConfigSchema,
});

const draftSchema = z.object({
  templateId: z.string().uuid(),
  programId: z.string().uuid(),
  coachName: z.string().trim().max(160),
  coachEmail: z.string().trim().max(320).refine(
    (value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    "Enter a valid coach email or leave it blank.",
  ),
  subject: z.string().min(1).max(500).refine((value) => value.trim().length > 0),
  body: z.string().min(1).max(100_000).refine((value) => value.trim().length > 0),
  bodyFormat: z.enum(["text", "html"]).optional(),
  timeConfig: timeConfigSchema,
  status: z.enum(["draft", "ready", "sent"]),
});

const applyTemplateSchema = z.object({
  templateId: z.string().uuid(),
  programId: z.string().uuid(),
});

type TemplateResult =
  | { ok: true; template: SwimmerOutreachTemplate }
  | { ok: false; error: string };

type DraftResult =
  | { ok: true; draft: SwimmerOutreachDraft }
  | { ok: false; error: string };

type DeleteTemplateResult =
  | { ok: true }
  | { ok: false; error: string };

function needsStructuredTimesMigration(result: { status: number; error: { code?: string; message?: string } | null }): boolean {
  if (result.status !== 400 || !result.error) return false;
  return result.error.code === "42703" || !result.error.message || result.error.message.includes("time_config");
}

function templateFromRow(row: {
  id: string;
  name: string;
  stage: string;
  subject_template: string;
  body_template: string;
  time_config: unknown;
  created_at: string;
  updated_at: string;
}): SwimmerOutreachTemplate {
  return {
    id: row.id,
    name: row.name,
    stage: row.stage as OutreachStage,
    subjectTemplate: row.subject_template,
    bodyTemplate: row.body_template,
    timeConfig: parseOutreachTimeConfig(row.time_config),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function draftFromRow(row: {
  id: string;
  template_id: string;
  athletic_program_id: string;
  coach_name: string;
  coach_email: string;
  subject: string;
  body: string;
  body_format?: string | null;
  time_config: unknown;
  status: string;
  created_at: string;
  updated_at: string;
}): SwimmerOutreachDraft {
  return {
    id: row.id,
    templateId: row.template_id,
    programId: row.athletic_program_id,
    coachName: row.coach_name,
    coachEmail: row.coach_email,
    subject: row.subject,
    body: row.body,
    bodyFormat: row.body_format === "html" ? "html" : "text",
    timeConfig: parseOutreachTimeConfig(row.time_config),
    status: row.status as OutreachDraftStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function resolveOwnedTimeConfig(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  requested: z.infer<typeof timeConfigSchema>,
): Promise<{ ok: true; timeConfig: OutreachTimeConfig } | { ok: false; error: string }> {
  if (requested.entries.length === 0) {
    return {
      ok: true,
      timeConfig: { entries: [], layout: requested.layout, includeMeet: requested.includeMeet, includeDate: requested.includeDate },
    };
  }

  const ids = requested.entries.map((entry) => entry.timeId);
  const { data, error } = await supabase
    .from("swim_times")
    .select("id,event,course,seconds,date,meet,source,swimmers!inner(owner_user_id)")
    .in("id", ids)
    .eq("swimmers.owner_user_id", userId);
  if (error || !data || data.length !== ids.length) {
    return { ok: false, error: "One of the selected results is no longer in My Times. Review the time block and try again." };
  }

  const byId = new Map(data.map((row) => [row.id, row]));
  const entries = ids.map((id) => {
    const row = byId.get(id)!;
    return {
      timeId: row.id,
      event: row.event,
      course: row.course as Course,
      seconds: Number(row.seconds),
      date: row.date,
      meet: row.meet ?? "",
      source: row.source ?? "",
    };
  });
  return {
    ok: true,
    timeConfig: { entries, layout: requested.layout, includeMeet: requested.includeMeet, includeDate: requested.includeDate },
  };
}

function validateStructuredTimes(subject: string, body: string, config: z.infer<typeof timeConfigSchema>): string | null {
  if (usesOutreachPlaceholder(subject, "best_times")) {
    return "Selected results belong in the message, not the subject line.";
  }
  const timeBlockCount = outreachPlaceholderCount(body, "best_times");
  if (timeBlockCount > 1) return "Use the selected-results field only once in a message.";
  const usesTimes = timeBlockCount === 1;
  if (usesTimes && config.entries.length === 0) {
    return "Choose at least one exact result, or remove the selected-results field.";
  }
  if (!usesTimes && config.entries.length > 0) {
    return "Insert the selected-results field into the message so the chosen swims appear.";
  }
  return null;
}

export async function saveOutreachTemplate(input: unknown): Promise<TemplateResult> {
  const parsed = templateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Complete the campaign name, subject, and message." };

  const supportsResults = outreachStageSupportsResults(parsed.data.stage);
  const subjectTemplate = supportsResults
    ? parsed.data.subjectTemplate
    : removeOutreachResultsBlock(parsed.data.subjectTemplate);
  const bodyTemplate = supportsResults
    ? parsed.data.bodyTemplate
    : removeOutreachResultsBlock(parsed.data.bodyTemplate);
  const requestedTimeConfig = supportsResults
    ? parsed.data.timeConfig
    : { ...EMPTY_OUTREACH_TIME_CONFIG, entries: [] };
  if (!subjectTemplate.trim() || !bodyTemplate.trim()) {
    return { ok: false, error: "Complete the subject and message after choosing the campaign stage." };
  }
  const unknown = unknownOutreachPlaceholders(subjectTemplate, bodyTemplate);
  if (unknown.length > 0) {
    return { ok: false, error: `Unknown placeholder${unknown.length === 1 ? "" : "s"}: ${unknown.join(", ")}.` };
  }
  const timeIssue = validateStructuredTimes(subjectTemplate, bodyTemplate, requestedTimeConfig);
  if (timeIssue) return { ok: false, error: timeIssue };

  const auth = await requireAccountType("swimmer", "/s/outreach");
  const supabase = await createClient();
  const resolvedTimes = await resolveOwnedTimeConfig(supabase, auth.userId, requestedTimeConfig);
  if (!resolvedTimes.ok) return resolvedTimes;
  const values = {
    name: parsed.data.name,
    stage: parsed.data.stage,
    subject_template: subjectTemplate,
    body_template: bodyTemplate,
    time_config: resolvedTimes.timeConfig,
  };
  const selection = "id,name,stage,subject_template,body_template,time_config,created_at,updated_at";
  const result = parsed.data.id
    ? await supabase
        .from("swimmer_outreach_templates")
        .update(values)
        .eq("id", parsed.data.id)
        .eq("swimmer_user_id", auth.userId)
        .select(selection)
        .maybeSingle()
    : await supabase
        .from("swimmer_outreach_templates")
        .insert({ swimmer_user_id: auth.userId, ...values })
        .select(selection)
        .single();

  if (result.error || !result.data) {
    if (needsStructuredTimesMigration(result)) return { ok: false, error: OUTREACH_DATABASE_UPDATE_ERROR };
    return {
      ok: false,
      error: result.error?.code === "23505"
        ? "You already have a campaign with that name."
        : "The campaign template couldn’t be saved.",
    };
  }

  revalidatePath("/s/outreach/campaigns");
  revalidatePath(`/s/outreach/campaigns/${result.data.id}`);
  revalidatePath(`/s/outreach/campaigns/${result.data.id}/template`);
  revalidatePath("/s/outreach/drafts");
  revalidatePath("/s/outreach/drafts/new");
  return { ok: true, template: templateFromRow(result.data) };
}

export async function saveOutreachDraft(input: unknown): Promise<DraftResult> {
  const parsed = draftSchema.safeParse(input);
  if (!parsed.success) {
    const emailIssue = parsed.error.issues.find((issue) => issue.path[0] === "coachEmail");
    return { ok: false, error: emailIssue?.message ?? "The personalized draft is incomplete." };
  }

  if (parsed.data.status !== "draft" && !parsed.data.coachEmail) {
    return { ok: false, error: "Add and verify the coach email before marking this file ready or sent." };
  }
  if (parsed.data.status !== "draft" && !parsed.data.coachName) {
    return { ok: false, error: "Add the coach’s name before marking this file ready or sent." };
  }

  const auth = await requireAccountType("swimmer", "/s/outreach");
  const supabase = await createClient();
  const requestedTimesPromise = resolveOwnedTimeConfig(supabase, auth.userId, parsed.data.timeConfig);
  const [
    { data: template, error: templateError },
    { data: savedProgram, error: savedError },
    { data: existingDraft, error: existingError },
    requestedTimes,
  ] = await Promise.all([
    supabase
      .from("swimmer_outreach_templates")
      .select("id,stage")
      .eq("id", parsed.data.templateId)
      .eq("swimmer_user_id", auth.userId)
      .maybeSingle(),
    supabase
      .from("swimmer_college_status")
      .select("athletic_program_id")
      .eq("swimmer_user_id", auth.userId)
      .eq("athletic_program_id", parsed.data.programId)
      .eq("status", "saved")
      .maybeSingle(),
    supabase
      .from("swimmer_outreach_drafts")
      .select("id")
      .eq("swimmer_user_id", auth.userId)
      .eq("template_id", parsed.data.templateId)
      .eq("athletic_program_id", parsed.data.programId)
      .maybeSingle(),
    requestedTimesPromise,
  ]);
  if (templateError || !template) return { ok: false, error: "That campaign template is no longer available." };
  if (savedError || existingError) return { ok: false, error: "The program’s saved-file status couldn’t be verified." };
  if (!savedProgram && !existingDraft) return { ok: false, error: "Save this exact program before creating an outreach draft." };

  const supportsResults = outreachStageSupportsResults(template.stage as OutreachStage);
  const isHtml = parsed.data.bodyFormat === "html";
  const subject = supportsResults ? parsed.data.subject : removeOutreachResultsBlock(parsed.data.subject);
  const rawBody = isHtml ? sanitizeEmailHtml(parsed.data.body, "html") : (supportsResults ? parsed.data.body : removeOutreachResultsBlock(parsed.data.body));
  const bodyText = isHtml ? emailHtmlToText(rawBody) : rawBody;
  if (!subject.trim() || !bodyText.trim()) return { ok: false, error: "Complete the subject and message." };
  const placeholders = outreachPlaceholderKeys(subject, bodyText);
  if (placeholders.length > 0) {
    return { ok: false, error: "School drafts contain final email text. Remove any template placeholders before saving." };
  }
  const body = rawBody;
  const resolvedTimes = supportsResults
    ? requestedTimes
    : {
        ok: true as const,
        timeConfig: { ...EMPTY_OUTREACH_TIME_CONFIG, entries: [] },
      };
  if (!resolvedTimes.ok) return resolvedTimes;

  const { data, error } = await supabase
    .from("swimmer_outreach_drafts")
    .upsert({
      swimmer_user_id: auth.userId,
      template_id: parsed.data.templateId,
      athletic_program_id: parsed.data.programId,
      coach_name: parsed.data.coachName,
      coach_email: parsed.data.coachEmail,
      subject,
      body,
      body_format: isHtml ? "html" : "text",
      time_config: resolvedTimes.timeConfig,
      status: parsed.data.status,
    }, { onConflict: "swimmer_user_id,athletic_program_id,template_id" })
    .select("id,template_id,athletic_program_id,coach_name,coach_email,subject,body,body_format,time_config,status,created_at,updated_at")
    .single();

  if (error || !data) {
    if (needsStructuredTimesMigration({ status: error ? 400 : 200, error })) {
      return { ok: false, error: OUTREACH_DATABASE_UPDATE_ERROR };
    }
    return { ok: false, error: "The personalized draft couldn’t be saved." };
  }

  revalidatePath(`/s/outreach/campaigns/${parsed.data.templateId}`);
  revalidatePath(`/s/outreach/campaigns/${parsed.data.templateId}/drafts/${parsed.data.programId}`);
  revalidatePath("/s/outreach/drafts");
  revalidatePath("/s/outreach/drafts/new");
  return { ok: true, draft: draftFromRow(data) };
}

export async function applyOutreachTemplate(input: unknown): Promise<DraftResult> {
  const parsed = applyTemplateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That campaign or saved program is invalid." };

  const workspace = await loadOutreachDraftEditor(parsed.data.templateId, parsed.data.programId);
  if (workspace.status === "unavailable") return { ok: false, error: workspace.message };
  if (workspace.existingDraft) return { ok: true, draft: workspace.existingDraft };
  if (!workspace.campaign) return { ok: false, error: "That campaign template is no longer available." };
  if (!workspace.program || !workspace.programSaved) {
    return { ok: false, error: "Save this exact program before applying an outreach template." };
  }
  if (!workspace.storageReady) return { ok: false, error: OUTREACH_DATABASE_UPDATE_ERROR };

  const draft = materializeOutreachTemplate(
    workspace.campaign,
    workspace.program,
    workspace.swimmer,
    workspace.priorContact ?? { coachName: "", coachEmail: "" },
  );
  const placeholders = outreachPlaceholderKeys(draft.subject, draft.body);
  if (placeholders.length > 0) {
    return { ok: false, error: "The master template contains a placeholder that could not be filled." };
  }

  return saveOutreachDraft({
    templateId: parsed.data.templateId,
    programId: parsed.data.programId,
    ...draft,
  });
}

export async function deleteOutreachTemplate(input: unknown): Promise<DeleteTemplateResult> {
  const parsed = z.string().uuid().safeParse(input);
  if (!parsed.success) return { ok: false, error: "That campaign ID is invalid." };

  const auth = await requireAccountType("swimmer", "/s/outreach/campaigns");
  const supabase = await createClient();
  const direct = await supabase
    .from("swimmer_outreach_templates")
    .delete()
    .eq("id", parsed.data)
    .eq("swimmer_user_id", auth.userId)
    .select("id")
    .maybeSingle();
  if (!direct.error) {
    if (!direct.data) return { ok: false, error: "That campaign no longer exists." };
    revalidatePath("/s/outreach/campaigns");
    revalidatePath("/s/outreach/drafts");
    revalidatePath("/s/outreach/drafts/new");
    return { ok: true };
  }
  if (direct.error.code !== "23503") return { ok: false, error: "The campaign couldn’t be deleted." };

  const drafts = await supabase
    .from("swimmer_outreach_drafts")
    .delete()
    .eq("template_id", parsed.data)
    .eq("swimmer_user_id", auth.userId);
  if (drafts.error) return { ok: false, error: "The campaign’s school versions couldn’t be deleted." };
  const template = await supabase
    .from("swimmer_outreach_templates")
    .delete()
    .eq("id", parsed.data)
    .eq("swimmer_user_id", auth.userId);
  if (template.error) return { ok: false, error: "School versions were removed, but the campaign itself could not be deleted." };

  revalidatePath("/s/outreach/campaigns");
  revalidatePath("/s/outreach/drafts");
  revalidatePath("/s/outreach/drafts/new");
  return { ok: true };
}
