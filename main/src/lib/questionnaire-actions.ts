"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireCoachWorkspace } from "./auth";
import { createClient } from "./supabase/server";
import { createAdminClient } from "./supabase/admin";
import type { Questionnaire, Submission, PublicQuestionnaire } from "./questionnaire-defs";
import { parseQuestionFields, prohibitedQuestionTopic, validateAnswers, type AnswerMap, type QuestionField } from "./questionnaire-fields";
import { isPersonalDataCollectionConfigured, PRIVACY_VERSION, TERMS_VERSION } from "./legal";

const UUID_RE = /^[0-9a-f-]{36}$/i;
const MAX_BULK_SUBMISSIONS = 2_000;

type QuestionnaireRow = {
  id: string;
  college_id: string | null;
  title: string;
  intro: string | null;
  share_token: string;
  status: "active" | "closed";
  campaign_id: string | null;
  extra_fields: unknown;
};

function toQuestionnaire(
  q: QuestionnaireRow,
  counts: { total: number; fresh: number } = { total: 0, fresh: 0 },
): Questionnaire {
  return {
    id: q.id,
    collegeId: q.college_id,
    title: q.title,
    intro: q.intro,
    shareToken: q.share_token,
    status: q.status,
    campaignId: q.campaign_id,
    extraFields: parseQuestionFields(q.extra_fields),
    submissionCount: counts.total,
    newCount: counts.fresh,
  };
}

function validateBulkIds(ids: string[]): string[] | null {
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > MAX_BULK_SUBMISSIONS) return null;
  if (ids.some((id) => typeof id !== "string" || !UUID_RE.test(id))) return null;
  return [...new Set(ids)];
}

function revalidateQuestionnaire(questionnaireId: string) {
  revalidatePath("/c/questionnaires");
  revalidatePath(`/c/questionnaires/${questionnaireId}`);
}

export async function listQuestionnaires(collegeId?: string | null): Promise<Questionnaire[]> {
  const { membership } = await requireCoachWorkspace();
  const supabase = await createClient();

  let questionnaireQuery = supabase
    .from("recruit_questionnaires")
    .select("id,college_id,title,intro,share_token,status,campaign_id,extra_fields")
    .eq("workspace_id", membership.workspaceId);
  if (collegeId && UUID_RE.test(collegeId)) questionnaireQuery = questionnaireQuery.eq("college_id", collegeId);

  const [{ data: qs }, { data: subs }] = await Promise.all([
    questionnaireQuery.order("created_at", { ascending: false }),
    supabase
      .from("questionnaire_submissions")
      .select("questionnaire_id,status")
      .eq("workspace_id", membership.workspaceId),
  ]);

  const counts = new Map<string, { total: number; fresh: number }>();
  for (const s of (subs ?? []) as { questionnaire_id: string; status: string }[]) {
    const c = counts.get(s.questionnaire_id) ?? { total: 0, fresh: 0 };
    c.total += 1;
    if (s.status === "new") c.fresh += 1;
    counts.set(s.questionnaire_id, c);
  }

  return ((qs ?? []) as QuestionnaireRow[]).map((q) => toQuestionnaire(q, counts.get(q.id)));
}

export async function getQuestionnaire(questionnaireId: string): Promise<Questionnaire | null> {
  const { membership } = await requireCoachWorkspace();
  if (!UUID_RE.test(questionnaireId)) return null;
  const supabase = await createClient();
  const [{ data }, { data: statuses }] = await Promise.all([
    supabase
      .from("recruit_questionnaires")
      .select("id,college_id,title,intro,share_token,status,campaign_id,extra_fields")
      .eq("id", questionnaireId)
      .eq("workspace_id", membership.workspaceId)
      .maybeSingle(),
    supabase
      .from("questionnaire_submissions")
      .select("status")
      .eq("questionnaire_id", questionnaireId)
      .eq("workspace_id", membership.workspaceId),
  ]);
  if (!data) return null;
  const rows = (statuses ?? []) as { status: string }[];
  return toQuestionnaire(data as QuestionnaireRow, {
    total: rows.length,
    fresh: rows.filter((row) => row.status === "new").length,
  });
}

export async function createQuestionnaire(input: {
  title: string;
  intro?: string | null;
  collegeId: string;
  campaignId?: string | null;
  extraFields?: QuestionField[];
}): Promise<{ ok: boolean; id: string | null; token: string | null; error: string | null }> {
  const { context, membership } = await requireCoachWorkspace();
  const title = input.title.trim();
  if (title.length < 1 || title.length > 160) return { ok: false, id: null, token: null, error: "Give the questionnaire a title." };
  const fields = parseQuestionFields(input.extraFields ?? []);
  const prohibitedTopic = prohibitedQuestionTopic(fields);
  if (prohibitedTopic) {
    return { ok: false, id: null, token: null, error: `Remove the sensitive custom question "${prohibitedTopic}".` };
  }

  const token = randomBytes(12).toString("base64url");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recruit_questionnaires")
    .insert({
      workspace_id: membership.workspaceId,
      college_id: input.collegeId,
      campaign_id: input.campaignId ?? null,
      title,
      intro: input.intro?.trim() || null,
      extra_fields: fields,
      share_token: token,
      created_by: context.userId,
    })
    .select("id,share_token")
    .single();
  if (error || !data) return { ok: false, id: null, token: null, error: "Could not create the questionnaire. Try again." };
  revalidatePath("/c/questionnaires");
  return { ok: true, id: data.id, token: data.share_token, error: null };
}

export async function updateQuestionnaire(input: {
  id: string;
  title: string;
  intro?: string | null;
  extraFields: QuestionField[];
}): Promise<{ ok: boolean; error: string | null }> {
  const { membership } = await requireCoachWorkspace();
  if (!UUID_RE.test(input.id)) return { ok: false, error: "Invalid questionnaire." };
  const title = input.title.trim();
  if (title.length < 1 || title.length > 160) return { ok: false, error: "Give the questionnaire a title." };
  const fields = parseQuestionFields(input.extraFields);
  const prohibitedTopic = prohibitedQuestionTopic(fields);
  if (prohibitedTopic) return { ok: false, error: `Remove the sensitive custom question "${prohibitedTopic}".` };

  const supabase = await createClient();
  const { error } = await supabase
    .from("recruit_questionnaires")
    .update({
      title,
      intro: input.intro?.trim() || null,
      extra_fields: fields,
    })
    .eq("id", input.id)
    .eq("workspace_id", membership.workspaceId);
  if (error) return { ok: false, error: "Could not save the questionnaire. Try again." };
  revalidateQuestionnaire(input.id);
  return { ok: true, error: null };
}

export async function setQuestionnaireStatus(id: string, status: "active" | "closed"): Promise<{ ok: boolean }> {
  const { membership } = await requireCoachWorkspace();
  if (!UUID_RE.test(id)) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase
    .from("recruit_questionnaires")
    .update({ status })
    .eq("id", id)
    .eq("workspace_id", membership.workspaceId);
  revalidateQuestionnaire(id);
  return { ok: !error };
}

export async function listSubmissions(questionnaireId: string): Promise<Submission[]> {
  const { membership } = await requireCoachWorkspace();
  if (!UUID_RE.test(questionnaireId)) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("questionnaire_submissions")
    .select("id,full_name,grad_year,gender,email,phone,swimcloud_url,club_name,lsc_code,times_text,answers,status,submitted_at")
    .eq("questionnaire_id", questionnaireId)
    .eq("workspace_id", membership.workspaceId)
    .order("submitted_at", { ascending: false });

  return ((data ?? []) as {
    id: string; full_name: string; grad_year: number | null; gender: "M" | "F" | null;
    email: string | null; phone: string | null; swimcloud_url: string | null; club_name: string | null;
    lsc_code: string | null; times_text: string | null; answers: unknown; status: "new" | "promoted" | "archived"; submitted_at: string;
  }[]).map((s) => ({
    id: s.id,
    fullName: s.full_name,
    gradYear: s.grad_year,
    gender: s.gender,
    email: s.email,
    phone: s.phone,
    swimcloudUrl: s.swimcloud_url,
    club: s.club_name,
    lsc: s.lsc_code,
    timesText: s.times_text,
    answers: (s.answers && typeof s.answers === "object" && !Array.isArray(s.answers) ? s.answers : {}) as AnswerMap,
    status: s.status,
    submittedAt: s.submitted_at,
  }));
}

export async function promoteSubmission(submissionId: string, campaignId: string): Promise<{ ok: boolean; error: string | null }> {
  await requireCoachWorkspace();
  if (!UUID_RE.test(submissionId) || !UUID_RE.test(campaignId)) return { ok: false, error: "Invalid selection." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("promote_submission", { p_submission_id: submissionId, p_campaign_id: campaignId });
  if (error) return { ok: false, error: "Could not promote this submission. Try again." };
  revalidatePath("/c/questionnaires");
  return { ok: true, error: null };
}

export async function archiveSubmission(submissionId: string): Promise<{ ok: boolean }> {
  const { membership } = await requireCoachWorkspace();
  const supabase = await createClient();
  const { error } = await supabase
    .from("questionnaire_submissions")
    .update({ status: "archived" })
    .eq("id", submissionId)
    .eq("workspace_id", membership.workspaceId);
  revalidatePath("/c/questionnaires");
  return { ok: !error };
}

export async function deleteQuestionnaireSubmissions(
  questionnaireId: string,
  submissionIds: string[],
): Promise<{ ok: boolean; deleted: number; error: string | null }> {
  await requireCoachWorkspace();
  const ids = validateBulkIds(submissionIds);
  if (!UUID_RE.test(questionnaireId) || !ids) {
    return { ok: false, deleted: 0, error: "Select between 1 and 2,000 valid submissions." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("bulk_delete_questionnaire_submissions", {
    p_questionnaire_id: questionnaireId,
    p_submission_ids: ids,
  });
  if (error) return { ok: false, deleted: 0, error: "Could not delete the selected submissions. Try again." };
  revalidateQuestionnaire(questionnaireId);
  return { ok: true, deleted: typeof data === "number" ? data : Number(data ?? 0), error: null };
}

export async function bulkPromoteQuestionnaireSubmissions(
  questionnaireId: string,
  submissionIds: string[],
  campaignId: string,
): Promise<{ ok: boolean; promoted: number; skipped: number; error: string | null }> {
  await requireCoachWorkspace();
  const ids = validateBulkIds(submissionIds);
  if (!UUID_RE.test(questionnaireId) || !UUID_RE.test(campaignId) || !ids) {
    return { ok: false, promoted: 0, skipped: 0, error: "Choose a class campaign and at least one valid submission." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("bulk_promote_submissions", {
    p_questionnaire_id: questionnaireId,
    p_submission_ids: ids,
    p_campaign_id: campaignId,
  });
  if (error) {
    return { ok: false, promoted: 0, skipped: 0, error: "Could not promote the selected submissions. Try again." };
  }
  const promoted = typeof data === "number" ? data : Number(data ?? 0);
  revalidateQuestionnaire(questionnaireId);
  revalidatePath("/c/campaigns");
  revalidatePath(`/c/campaigns/${campaignId}`);
  return { ok: true, promoted, skipped: ids.length - promoted, error: null };
}


type PublicQuestionnaireOwnerRow = {
  workspace_id: string;
  college_id: string | null;
};

type PublicQuestionnaireCollegeRow = {
  athletic_programs: {
    gender: string;
    institutions: { canonical_name: string } | { canonical_name: string }[] | null;
  } | {
    gender: string;
    institutions: { canonical_name: string } | { canonical_name: string }[] | null;
  }[] | null;
};

function firstRelation<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

async function publicQuestionnaireCoachingStaffName(questionnaireId: string): Promise<string> {
  const fallback = "the coaching staff that published this form";
  try {
    const admin = createAdminClient();
    const { data: ownerData } = await admin
      .from("recruit_questionnaires")
      .select("workspace_id,college_id")
      .eq("id", questionnaireId)
      .maybeSingle();
    const owner = ownerData as PublicQuestionnaireOwnerRow | null;
    if (!owner) return fallback;

    const [collegeResult, workspaceResult] = await Promise.all([
      owner.college_id
        ? admin
          .from("workspace_colleges")
          .select("athletic_programs(gender,institutions(canonical_name))")
          .eq("id", owner.college_id)
          .eq("workspace_id", owner.workspace_id)
          .maybeSingle()
        : Promise.resolve({ data: null }),
      admin.from("workspaces").select("name").eq("id", owner.workspace_id).maybeSingle(),
    ]);

    const college = collegeResult.data as unknown as PublicQuestionnaireCollegeRow | null;
    const program = firstRelation(college?.athletic_programs ?? null);
    const institution = firstRelation(program?.institutions ?? null)?.canonical_name?.trim();
    if (institution) {
      const squad = program?.gender === "women"
        ? "women's swimming"
        : program?.gender === "men"
          ? "men's swimming"
          : "swimming";
      return `the ${institution} ${squad} coaching staff`;
    }

    const workspaceName = (workspaceResult.data as { name: string | null } | null)?.name?.trim();
    return workspaceName ? `the ${workspaceName} coaching staff` : fallback;
  } catch {
    return fallback;
  }
}

export async function getPublicQuestionnaire(token: string): Promise<PublicQuestionnaire | null> {
  if (!isPersonalDataCollectionConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_public_questionnaire_state", { p_token: token });
  const row = (data as {
    id: string;
    title: string;
    intro: string | null;
    extra_fields: unknown;
    status: "active" | "closed";
  }[] | null)?.[0];

  if (!row) return null;
  const extraFields = parseQuestionFields(row.extra_fields);
  const status = prohibitedQuestionTopic(extraFields) ? "closed" : row.status;

  return {
    id: row.id,
    title: row.title,
    intro: row.intro,
    coachingStaffName: await publicQuestionnaireCoachingStaffName(row.id),
    status,
    extraFields,
  };
}

export async function submitQuestionnaire(token: string, input: {
  fullName: string;
  gradYear?: number | null;
  gender?: "M" | "F" | null;
  email?: string | null;
  phone?: string | null;
  swimcloudUrl?: string | null;
  club?: string | null;
  lsc?: string | null;
  timesText?: string | null;
  answers?: AnswerMap;
  legalAccepted: boolean;
  ageAndGuardianConfirmed: boolean;
}): Promise<{ ok: boolean; error: string | null }> {
  const name = input.fullName.trim();
  if (name.length < 1) return { ok: false, error: "Enter your name." };
  if (!input.legalAccepted) {
    return { ok: false, error: "Agree to the Terms and acknowledge the Privacy Policy." };
  }
  if (!input.ageAndGuardianConfirmed) {
    return { ok: false, error: "Confirm the age and guardian-permission requirements." };
  }
  const currentYear = new Date().getUTCFullYear();
  if (input.gradYear != null && (
    !Number.isInteger(input.gradYear) ||
    input.gradYear < currentYear - 1 ||
    input.gradYear > currentYear + 5
  )) {
    return { ok: false, error: "Enter a graduation year consistent with an athlete who is at least 13." };
  }

  const questionnaire = await getPublicQuestionnaire(token);
  if (!questionnaire) return { ok: false, error: "This questionnaire is unavailable." };
  if (questionnaire.status === "closed") {
    return { ok: false, error: "This questionnaire is no longer accepting responses." };
  }
  let answers: AnswerMap = {};
  if (input.answers && Object.keys(input.answers).length > 0) {
    const validated = validateAnswers(questionnaire.extraFields, input.answers);
    if (!validated.ok) return { ok: false, error: validated.error };
    answers = validated.answers;
  }

  const { error } = await createAdminClient().rpc("submit_questionnaire", {
    p_token: token,
    p_full_name: name,
    p_grad_year: input.gradYear ?? null,
    p_gender: input.gender ?? null,
    p_email: input.email ?? null,
    p_phone: input.phone ?? null,
    p_swimcloud_url: input.swimcloudUrl ?? null,
    p_club_name: input.club ?? null,
    p_lsc_code: input.lsc ?? null,
    p_times_text: input.timesText ?? null,
    p_answers: answers,
    p_terms_version: TERMS_VERSION,
    p_privacy_version: PRIVACY_VERSION,
    p_age_13_or_older_confirmed: true,
    p_guardian_permission_confirmed_if_minor: true,
  });
  if (error) return { ok: false, error: "Could not submit. Check your entries and try again." };
  return { ok: true, error: null };
}
