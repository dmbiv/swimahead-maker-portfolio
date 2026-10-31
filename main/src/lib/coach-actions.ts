"use server";

import { revalidatePath } from "next/cache";
import { AuthorizationError, requireCoachWorkspace } from "./auth";
import { createClient } from "./supabase/server";
import { searchColleges, type CollegeOption } from "./coach-college-directory";
import { findSwimsIdentity } from "./swims-identity";
import type { SwimsMember } from "./types";

export async function searchCollegesAction(query: string): Promise<CollegeOption[]> {
  await requireCoachWorkspace();
  return searchColleges(query);
}

export async function searchSwimsMembersAction(name: string): Promise<SwimsMember[]> {
  const { membership } = await requireCoachWorkspace();
  if (membership.role === "viewer") throw new AuthorizationError();
  if (name.trim().length < 2) return [];
  try {
    const lookup = await findSwimsIdentity({
      fullName: name.trim(),
      classYear: null,
      classStanding: null,
      hometown: null,
    });
    if (lookup.candidates.length > 0) return lookup.candidates;
    return lookup.members.slice(0, 25);
  } catch {
    return [];
  }
}

const UUID_RE = /^[0-9a-f-]{36}$/i;

export async function addCoachCollegeAction(
  athleticProgramId: string,
): Promise<{ ok: boolean; error: string | null }> {
  await requireCoachWorkspace();
  if (!UUID_RE.test(athleticProgramId)) return { ok: false, error: "Pick a college from the list." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_coach_college", { p_athletic_program_id: athleticProgramId });
  if (error) return { ok: false, error: "That college could not be added. Try again." };
  revalidatePath("/c", "layout");
  return { ok: true, error: null };
}

export async function removeCoachCollegeAction(
  collegeId: string,
): Promise<{ ok: boolean; error: string | null }> {
  const { membership } = await requireCoachWorkspace();
  if (!UUID_RE.test(collegeId)) return { ok: false, error: "Invalid college." };
  if (!(membership.role === "owner" || membership.role === "admin" || membership.role === "head_coach")) {
    return { ok: false, error: "Only a workspace owner, admin, or head coach can remove a program." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("remove_coach_college", { p_college_id: collegeId });
  if (error) {
    if (/roster and campaigns/i.test(error.message)) {
      return { ok: false, error: "Clear this program’s roster and delete its recruiting campaigns before removing it." };
    }
    if (/college not found/i.test(error.message)) {
      return { ok: false, error: "That program is no longer attached to your workspace." };
    }
    return { ok: false, error: "That program could not be removed. Try again." };
  }
  if (data !== true) return { ok: false, error: "That program is no longer attached to your workspace." };
  revalidatePath("/c", "layout");
  return { ok: true, error: null };
}

export async function saveTargetPrefs(prefs: {
  squad: "men" | "women";
  gradYears?: number[];
  eventGroups?: string[];
  minGpa?: number | null;
}) {
  const { membership } = await requireCoachWorkspace();
  const supabase = await createClient();
  const { error } = await supabase.from("coach_target_prefs").upsert(
    {
      workspace_id: membership.workspaceId,
      squad: prefs.squad,
      grad_years: prefs.gradYears ?? [],
      event_groups: prefs.eventGroups ?? [],
      min_gpa: prefs.minGpa ?? null,
    },
    { onConflict: "workspace_id" },
  );
  return { ok: !error, error: error?.message ?? null };
}
