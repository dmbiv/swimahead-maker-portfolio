import "server-only";

import type { PostgrestError } from "@supabase/supabase-js";
import { cache } from "react";
import { requireAccountType } from "@/lib/auth";
import { collectAllPages, ID_FILTER_CHUNK_SIZE } from "@/lib/paginated-query";
import { createClient } from "@/lib/supabase/server";
import {
  parseOutreachTimeConfig,
  type OutreachDraftStatus,
  type OutreachProgram,
  type OutreachStage,
  type OutreachSwimmer,
  type OutreachTimeEntry,
  type SwimmerOutreachDraft,
  type SwimmerOutreachTemplate,
} from "@/lib/swimmer-outreach";
import type { Course } from "@/lib/types";

export type OutreachUnavailable = {
  status: "unavailable";
  message: string;
};

export type OutreachResult<T extends object> = ({ status: "ready" } & T) | OutreachUnavailable;

export type OutreachCampaignSummary = {
  id: string;
  name: string;
  stage: OutreachStage;
  subjectTemplate: string;
  updatedAt: string;
};

export type OutreachDraftListItem = {
  id: string;
  templateId: string;
  programId: string;
  coachName: string;
  status: OutreachDraftStatus;
  updatedAt: string;
};

export type OutreachDraftReference = {
  templateId: string;
  programId: string;
};

export type OutreachTimesResult = OutreachResult<{ results: OutreachTimeEntry[] }>;

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

type OutreachTemplateRow = {
  id: string;
  name: string;
  stage: string;
  subject_template: string;
  body_template: string;
  time_config?: unknown;
  created_at: string;
  updated_at: string;
};

type OutreachDraftRow = {
  id: string;
  template_id: string;
  athletic_program_id: string;
  coach_name: string;
  coach_email: string;
  subject: string;
  body: string;
  body_format?: string | null;
  time_config?: unknown;
  status: string;
  created_at: string;
  updated_at: string;
};

type OutreachProgramRow = {
  id: string;
  gender: "men" | "women" | "coed";
  division: string | null;
  display_name?: string | null;
  institutions:
    | { canonical_name: string }
    | { canonical_name: string }[]
    | null;
};

type OutreachProgramLinkRow = {
  athletic_program_id: string;
  link_type: "staff" | "questionnaire" | "recruiting_form" | string;
  url: string;
};

type OutreachProfileRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  gender: string;
  grad_year: number | null;
  club: string | null;
  city: string | null;
  state: string | null;
  email: string | null;
  phone: string | null;
  gpa: number | string | null;
  sat: number | null;
  act: number | null;
  majors: string[] | null;
  video_url: string | null;
};

type LoadedRow<T> = {
  row: T | null;
  structuredTimesReady: boolean;
  error: PostgrestError | null;
};

const outreachRequest = cache(async () => {
  const auth = await requireAccountType("swimmer", "/s/outreach");
  const supabase = await createClient();
  return { supabase, userId: auth.userId };
});

function unavailable(message: string): OutreachUnavailable {
  return { status: "unavailable", message };
}

function isMissingColumn(error: PostgrestError | null, column: string): boolean {
  if (!error) return false;
  const message = `${error.message ?? ""} ${error.details ?? ""} ${error.hint ?? ""}`.toLowerCase();
  return error.code === "42703" || (message.includes(column.toLowerCase()) && (
    message.includes("column") || message.includes("schema cache") || message.includes("could not find")
  ));
}

function templateFromRow(row: OutreachTemplateRow): SwimmerOutreachTemplate {
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

function draftFromRow(row: OutreachDraftRow): SwimmerOutreachDraft {
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

function swimmerFromRow(row: OutreachProfileRow): OutreachSwimmer {
  return {
    gender: row.gender as OutreachSwimmer["gender"],
    firstName: row.first_name ?? "",
    lastName: row.last_name ?? "",
    gradYear: row.grad_year ?? new Date().getFullYear() + 1,
    club: row.club ?? "",
    city: row.city ?? "",
    state: row.state ?? "",
    email: row.email ?? "",
    phone: row.phone ?? "",
    gpa: row.gpa == null ? null : Number(row.gpa),
    sat: row.sat ?? null,
    act: row.act ?? null,
    majors: (row.majors ?? []).join(" / "),
    videoUrl: row.video_url ?? "",
  };
}

async function loadTemplateById(
  supabase: ServerSupabaseClient,
  userId: string,
  templateId: string,
): Promise<LoadedRow<OutreachTemplateRow>> {
  const current = await supabase
    .from("swimmer_outreach_templates")
    .select("id,name,stage,subject_template,body_template,time_config,created_at,updated_at")
    .eq("id", templateId)
    .eq("swimmer_user_id", userId)
    .maybeSingle();
  if (!current.error) {
    return { row: current.data as OutreachTemplateRow | null, structuredTimesReady: true, error: null };
  }
  if (!isMissingColumn(current.error, "time_config")) {
    return { row: null, structuredTimesReady: false, error: current.error };
  }

  const legacy = await supabase
    .from("swimmer_outreach_templates")
    .select("id,name,stage,subject_template,body_template,created_at,updated_at")
    .eq("id", templateId)
    .eq("swimmer_user_id", userId)
    .maybeSingle();
  return {
    row: legacy.data as OutreachTemplateRow | null,
    structuredTimesReady: false,
    error: legacy.error,
  };
}

async function loadDraftByTemplateAndProgram(
  supabase: ServerSupabaseClient,
  userId: string,
  templateId: string,
  programId: string,
): Promise<LoadedRow<OutreachDraftRow>> {
  const current = await supabase
    .from("swimmer_outreach_drafts")
    .select("id,template_id,athletic_program_id,coach_name,coach_email,subject,body,body_format,time_config,status,created_at,updated_at")
    .eq("swimmer_user_id", userId)
    .eq("template_id", templateId)
    .eq("athletic_program_id", programId)
    .maybeSingle();
  if (!current.error) {
    return { row: current.data as OutreachDraftRow | null, structuredTimesReady: true, error: null };
  }
  if (!isMissingColumn(current.error, "time_config")) {
    return { row: null, structuredTimesReady: false, error: current.error };
  }

  const legacy = await supabase
    .from("swimmer_outreach_drafts")
    .select("id,template_id,athletic_program_id,coach_name,coach_email,subject,body,status,created_at,updated_at")
    .eq("swimmer_user_id", userId)
    .eq("template_id", templateId)
    .eq("athletic_program_id", programId)
    .maybeSingle();
  return {
    row: legacy.data as OutreachDraftRow | null,
    structuredTimesReady: false,
    error: legacy.error,
  };
}

function batches<T>(values: T[], size = ID_FILTER_CHUNK_SIZE): T[][] {
  const unique = [...new Set(values)];
  const result: T[][] = [];
  for (let index = 0; index < unique.length; index += size) result.push(unique.slice(index, index + size));
  return result;
}

function singleInstitution(value: OutreachProgramRow["institutions"]): { canonical_name: string } | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

async function loadRelevantPrograms(
  supabase: ServerSupabaseClient,
  programIds: string[],
  includeLinks = false,
): Promise<{ programs: OutreachProgram[]; error: string | null }> {
  const chunks = batches(programIds);
  if (chunks.length === 0) return { programs: [], error: null };

  const loaded = await Promise.all(chunks.map(async (ids) => {
    const programPromise = supabase
      .from("athletic_programs")
      .select("id,gender,division,display_name,institutions!inner(canonical_name)")
      .in("id", ids)
      .eq("active", true)
      .eq("visibility", "public")
      .eq("institutions.active", true)
      .eq("institutions.visibility", "public");
    const linkPromise = includeLinks
      ? supabase
          .from("verified_program_links")
          .select("athletic_program_id,link_type,url")
          .in("athletic_program_id", ids)
          .in("link_type", ["staff", "questionnaire", "recruiting_form"])
          .eq("verification_status", "verified")
          .eq("visibility", "public")
      : Promise.resolve({ data: [], error: null });
    const [currentPrograms, links] = await Promise.all([programPromise, linkPromise]);
    if (links.error) return { rows: [] as OutreachProgramRow[], links: [] as OutreachProgramLinkRow[], error: true };

    if (!currentPrograms.error) {
      return {
        rows: (currentPrograms.data ?? []) as unknown as OutreachProgramRow[],
        links: (links.data ?? []) as OutreachProgramLinkRow[],
        error: false,
      };
    }
    if (!isMissingColumn(currentPrograms.error, "display_name")) {
      return { rows: [] as OutreachProgramRow[], links: [] as OutreachProgramLinkRow[], error: true };
    }

    const legacy = await supabase
      .from("athletic_programs")
      .select("id,gender,division,institutions!inner(canonical_name)")
      .in("id", ids)
      .eq("active", true)
      .eq("visibility", "public")
      .eq("institutions.active", true)
      .eq("institutions.visibility", "public");
    return {
      rows: (legacy.data ?? []) as unknown as OutreachProgramRow[],
      links: (links.data ?? []) as OutreachProgramLinkRow[],
      error: Boolean(legacy.error),
    };
  }));

  if (loaded.some((part) => part.error)) {
    return { programs: [], error: "Saved program details couldn’t be loaded for outreach." };
  }

  const programRows = loaded.flatMap((part) => part.rows);
  const linkRows = loaded.flatMap((part) => part.links);
  const links = new Map<string, OutreachProgramLinkRow[]>();
  for (const link of linkRows) links.set(link.athletic_program_id, [...(links.get(link.athletic_program_id) ?? []), link]);

  const programs = programRows.flatMap((program): OutreachProgram[] => {
    const institutionName = singleInstitution(program.institutions)?.canonical_name;
    if (!institutionName) return [];
    const name = program.display_name ?? institutionName;
    const programLinks = links.get(program.id) ?? [];
    const link = (type: "staff" | "questionnaire" | "recruiting_form") =>
      programLinks.find((item) => item.link_type === type)?.url ?? "";
    const squad = program.gender === "men" ? "Men’s" : program.gender === "women" ? "Women’s" : "Coed";
    return [{
      id: program.id,
      name,
      short: `${name}, ${squad} swimming`,
      squad: program.gender,
      division: program.division ?? "",
      staffUrl: link("staff"),
      questionnaireUrl: link("questionnaire") || link("recruiting_form"),
    }];
  }).sort((left, right) => left.short.localeCompare(right.short));
  return { programs, error: null };
}

async function loadSavedProgramIds(
  supabase: ServerSupabaseClient,
  userId: string,
): Promise<{ ids: string[]; error: PostgrestError | null }> {
  const result = await collectAllPages<{ athletic_program_id: string }, PostgrestError>((from, to) => supabase
    .from("swimmer_college_status")
    .select("athletic_program_id")
    .eq("swimmer_user_id", userId)
    .eq("status", "saved")
    .order("athletic_program_id", { ascending: true })
    .range(from, to) as unknown as PromiseLike<{
      data: { athletic_program_id: string }[] | null;
      error: PostgrestError | null;
    }>);
  return { ids: result.data.map((row) => row.athletic_program_id), error: result.error };
}

const loadOutreachProfile = cache(async (): Promise<OutreachResult<{ swimmerId: string; swimmer: OutreachSwimmer }>> => {
  const { supabase, userId } = await outreachRequest();
  const { data, error } = await supabase
    .from("swimmers")
    .select("id,first_name,last_name,gender,grad_year,club,city,state,email,phone,gpa,sat,act,majors,video_url")
    .eq("owner_user_id", userId)
    .maybeSingle();
  if (error || !data) return unavailable("Your swimmer profile couldn’t be loaded.");
  const row = data as OutreachProfileRow;
  return { status: "ready", swimmerId: row.id, swimmer: swimmerFromRow(row) };
});

export const loadOutreachStorageReadiness = cache(async (): Promise<boolean | null> => {
  const { supabase, userId } = await outreachRequest();
  const [templates, drafts] = await Promise.all([
    supabase.from("swimmer_outreach_templates").select("time_config").eq("swimmer_user_id", userId).limit(1),
    supabase.from("swimmer_outreach_drafts").select("time_config").eq("swimmer_user_id", userId).limit(1),
  ]);
  if (!templates.error && !drafts.error) return true;
  if (isMissingColumn(templates.error, "time_config") || isMissingColumn(drafts.error, "time_config")) return false;
  return null;
});

export const loadOutreachCampaignList = cache(async (): Promise<OutreachResult<{
  campaigns: OutreachCampaignSummary[];
  draftCounts: Record<string, number>;
}>> => {
  const { supabase, userId } = await outreachRequest();
  const [templates, drafts] = await Promise.all([
    collectAllPages<{
      id: string;
      name: string;
      stage: string;
      subject_template: string;
      updated_at: string;
    }, PostgrestError>((from, to) => supabase
      .from("swimmer_outreach_templates")
      .select("id,name,stage,subject_template,updated_at")
      .eq("swimmer_user_id", userId)
      .order("updated_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, to) as never),
    collectAllPages<{ id: string; template_id: string }, PostgrestError>((from, to) => supabase
      .from("swimmer_outreach_drafts")
      .select("id,template_id")
      .eq("swimmer_user_id", userId)
      .order("updated_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, to) as never),
  ]);
  if (templates.error || drafts.error) {
    return unavailable("Your outreach workspace is temporarily unavailable. Please try again later.");
  }

  const draftCounts: Record<string, number> = {};
  for (const draft of drafts.data) draftCounts[draft.template_id] = (draftCounts[draft.template_id] ?? 0) + 1;
  return {
    status: "ready",
    campaigns: templates.data.map((row) => ({
      id: row.id,
      name: row.name,
      stage: row.stage as OutreachStage,
      subjectTemplate: row.subject_template,
      updatedAt: row.updated_at,
    })),
    draftCounts,
  };
});

export const loadOutreachDraftList = cache(async (): Promise<OutreachResult<{
  drafts: OutreachDraftListItem[];
  campaigns: Array<Pick<OutreachCampaignSummary, "id" | "name" | "stage">>;
  programs: OutreachProgram[];
}>> => {
  const { supabase, userId } = await outreachRequest();
  const [templates, drafts] = await Promise.all([
    collectAllPages<{ id: string; name: string; stage: string }, PostgrestError>((from, to) => supabase
      .from("swimmer_outreach_templates")
      .select("id,name,stage")
      .eq("swimmer_user_id", userId)
      .order("updated_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, to) as never),
    collectAllPages<{
      id: string;
      template_id: string;
      athletic_program_id: string;
      coach_name: string;
      status: string;
      updated_at: string;
    }, PostgrestError>((from, to) => supabase
      .from("swimmer_outreach_drafts")
      .select("id,template_id,athletic_program_id,coach_name,status,updated_at")
      .eq("swimmer_user_id", userId)
      .order("updated_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, to) as never),
  ]);
  if (templates.error || drafts.error) {
    return unavailable("Your outreach workspace is temporarily unavailable. Please try again later.");
  }
  const programs = await loadRelevantPrograms(supabase, drafts.data.map((row) => row.athletic_program_id));
  if (programs.error) return unavailable(programs.error);
  return {
    status: "ready",
    campaigns: templates.data.map((row) => ({ id: row.id, name: row.name, stage: row.stage as OutreachStage })),
    drafts: drafts.data.map((row) => ({
      id: row.id,
      templateId: row.template_id,
      programId: row.athletic_program_id,
      coachName: row.coach_name,
      status: row.status as OutreachDraftStatus,
      updatedAt: row.updated_at,
    })),
    programs: programs.programs,
  };
});

export const loadOutreachNewDraft = cache(async (): Promise<OutreachResult<{
  campaigns: Array<Pick<OutreachCampaignSummary, "id" | "name" | "stage">>;
  drafts: OutreachDraftReference[];
  savedPrograms: OutreachProgram[];
}>> => {
  const { supabase, userId } = await outreachRequest();
  const [templates, drafts, saved] = await Promise.all([
    collectAllPages<{ id: string; name: string; stage: string }, PostgrestError>((from, to) => supabase
      .from("swimmer_outreach_templates")
      .select("id,name,stage")
      .eq("swimmer_user_id", userId)
      .order("updated_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, to) as never),
    collectAllPages<{ id: string; template_id: string; athletic_program_id: string }, PostgrestError>((from, to) => supabase
      .from("swimmer_outreach_drafts")
      .select("id,template_id,athletic_program_id")
      .eq("swimmer_user_id", userId)
      .order("updated_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, to) as never),
    loadSavedProgramIds(supabase, userId),
  ]);
  if (templates.error || drafts.error) {
    return unavailable("Your outreach workspace is temporarily unavailable. Please try again later.");
  }
  if (saved.error) return unavailable("Your saved-program list couldn’t be loaded for outreach.");
  const programs = await loadRelevantPrograms(supabase, saved.ids);
  if (programs.error) return unavailable(programs.error);
  return {
    status: "ready",
    campaigns: templates.data.map((row) => ({ id: row.id, name: row.name, stage: row.stage as OutreachStage })),
    drafts: drafts.data.map((row) => ({ templateId: row.template_id, programId: row.athletic_program_id })),
    savedPrograms: programs.programs,
  };
});

export const loadOutreachCampaignFolder = cache(async (campaignId: string): Promise<OutreachResult<{
  campaign: SwimmerOutreachTemplate | null;
  drafts: Array<Pick<SwimmerOutreachDraft, "id" | "templateId" | "programId" | "coachName" | "coachEmail" | "status">>;
  programs: OutreachProgram[];
  savedPrograms: OutreachProgram[];
}>> => {
  const { supabase, userId } = await outreachRequest();
  const [template, drafts, saved] = await Promise.all([
    loadTemplateById(supabase, userId, campaignId),
    collectAllPages<{
      id: string;
      template_id: string;
      athletic_program_id: string;
      coach_name: string;
      coach_email: string;
      status: string;
    }, PostgrestError>((from, to) => supabase
      .from("swimmer_outreach_drafts")
      .select("id,template_id,athletic_program_id,coach_name,coach_email,status")
      .eq("swimmer_user_id", userId)
      .eq("template_id", campaignId)
      .order("updated_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, to) as never),
    loadSavedProgramIds(supabase, userId),
  ]);
  if (template.error || drafts.error) {
    return unavailable("Your outreach workspace is temporarily unavailable. Please try again later.");
  }
  if (saved.error) return unavailable("Your saved-program list couldn’t be loaded for outreach.");

  const relevantIds = [...saved.ids, ...drafts.data.map((row) => row.athletic_program_id)];
  const programs = await loadRelevantPrograms(supabase, relevantIds);
  if (programs.error) return unavailable(programs.error);
  const savedIds = new Set(saved.ids);
  return {
    status: "ready",
    campaign: template.row ? templateFromRow(template.row) : null,
    drafts: drafts.data.map((row) => ({
      id: row.id,
      templateId: row.template_id,
      programId: row.athletic_program_id,
      coachName: row.coach_name,
      coachEmail: row.coach_email,
      status: row.status as OutreachDraftStatus,
    })),
    programs: programs.programs,
    savedPrograms: programs.programs.filter((program) => savedIds.has(program.id)),
  };
});

export const loadOutreachCampaignEditor = cache(async (campaignId?: string): Promise<OutreachResult<{
  campaign?: SwimmerOutreachTemplate;
  programs: OutreachProgram[];
  swimmer: OutreachSwimmer;
  storageReady: boolean;
}>> => {
  const { supabase, userId } = await outreachRequest();
  const [profile, template, saved, draftPrograms, storageReady] = await Promise.all([
    loadOutreachProfile(),
    campaignId
      ? loadTemplateById(supabase, userId, campaignId)
      : Promise.resolve<LoadedRow<OutreachTemplateRow>>({ row: null, structuredTimesReady: true, error: null }),
    loadSavedProgramIds(supabase, userId),
    collectAllPages<{ id: string; athletic_program_id: string }, PostgrestError>((from, to) => supabase
      .from("swimmer_outreach_drafts")
      .select("id,athletic_program_id")
      .eq("swimmer_user_id", userId)
      .order("updated_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, to) as never),
    loadOutreachStorageReadiness(),
  ]);
  if (profile.status === "unavailable") return profile;
  if (template.error || draftPrograms.error) {
    return unavailable("Your outreach workspace is temporarily unavailable. Please try again later.");
  }
  if (saved.error) return unavailable("Your saved-program list couldn’t be loaded for outreach.");
  if (storageReady === null) return unavailable("The outreach campaign tables couldn’t be verified. Try reloading this page.");
  if (campaignId && !template.row) {
    return { status: "ready", programs: [], swimmer: profile.swimmer, storageReady: storageReady === true };
  }

  const programs = await loadRelevantPrograms(supabase, [
    ...saved.ids,
    ...draftPrograms.data.map((row) => row.athletic_program_id),
  ]);
  if (programs.error) return unavailable(programs.error);
  return {
    status: "ready",
    ...(template.row ? { campaign: templateFromRow(template.row) } : {}),
    programs: programs.programs,
    swimmer: profile.swimmer,
    storageReady: storageReady === true,
  };
});

export const loadOutreachDraftEditor = cache(async (
  campaignId: string,
  programId: string,
): Promise<OutreachResult<{
  campaign: SwimmerOutreachTemplate | null;
  program: OutreachProgram | null;
  swimmer: OutreachSwimmer;
  existingDraft?: SwimmerOutreachDraft;
  programSaved: boolean;
  storageReady: boolean;
  priorContact?: { coachName: string; coachEmail: string };
}>> => {
  const { supabase, userId } = await outreachRequest();
  const [profile, template, draft, contacts, saved, programs] = await Promise.all([
    loadOutreachProfile(),
    loadTemplateById(supabase, userId, campaignId),
    loadDraftByTemplateAndProgram(supabase, userId, campaignId, programId),
    supabase
      .from("swimmer_outreach_drafts")
      .select("coach_name,coach_email")
      .eq("swimmer_user_id", userId)
      .eq("athletic_program_id", programId)
      .or("coach_name.neq.,coach_email.neq.")
      .order("updated_at", { ascending: false })
      .limit(1),
    supabase
      .from("swimmer_college_status")
      .select("athletic_program_id")
      .eq("swimmer_user_id", userId)
      .eq("athletic_program_id", programId)
      .eq("status", "saved")
      .maybeSingle(),
    loadRelevantPrograms(supabase, [programId], true),
  ]);
  if (profile.status === "unavailable") return profile;
  if (template.error || draft.error || contacts.error) {
    return unavailable("Your outreach workspace is temporarily unavailable. Please try again later.");
  }
  if (saved.error) return unavailable("The program’s saved-file status couldn’t be verified.");
  if (programs.error) return unavailable(programs.error);

  const prior = (contacts.data ?? []).find((row) => row.coach_name || row.coach_email);
  return {
    status: "ready",
    campaign: template.row ? templateFromRow(template.row) : null,
    program: programs.programs[0] ?? null,
    swimmer: profile.swimmer,
    ...(draft.row ? { existingDraft: draftFromRow(draft.row) } : {}),
    programSaved: Boolean(saved.data),
    storageReady: template.structuredTimesReady && draft.structuredTimesReady,
    ...(prior ? { priorContact: { coachName: prior.coach_name, coachEmail: prior.coach_email } } : {}),
  };
});

export const loadOutreachResults = cache(async (): Promise<OutreachTimesResult> => {
  const profile = await loadOutreachProfile();
  if (profile.status === "unavailable") return profile;
  const { supabase } = await outreachRequest();
  const result = await collectAllPages<{
    id: string;
    event: string;
    course: string;
    seconds: number | string;
    date: string;
    meet: string | null;
    source: string | null;
  }, PostgrestError>((from, to) => supabase
    .from("swim_times")
    .select("id,event,course,seconds,date,meet,source")
    .eq("swimmer_id", profile.swimmerId)
    .order("date", { ascending: false })
    .order("id", { ascending: true })
    .range(from, to) as never);
  if (result.error) {
    return unavailable("Your swim results couldn’t be loaded for outreach. My Times may be temporarily unavailable.");
  }
  return {
    status: "ready",
    results: result.data.map((row) => ({
      timeId: row.id,
      event: row.event,
      course: row.course as Course,
      seconds: Number(row.seconds),
      date: row.date,
      meet: row.meet ?? "",
      source: row.source ?? "",
    })),
  };
});
