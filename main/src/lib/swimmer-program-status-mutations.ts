import "server-only";

import { requireAccountType } from "./auth";
import { createClient } from "./supabase/server";

export type SwimmerProgramStatus = "saved" | "ruled_out";

export type ProgramStatusMutationResult = {
  ok: boolean;
  error: string | null;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizedProgramId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const programId = value.trim();
  return UUID_PATTERN.test(programId) ? programId : null;
}

async function swimmerUserContext() {
  const [auth, supabase] = await Promise.all([
    requireAccountType("swimmer", "/s"),
    createClient(),
  ]);
  return { userId: auth.userId, supabase };
}

export async function persistSwimmerProgramStatus(
  athleticProgramId: unknown,
  status: unknown,
  reason: unknown = "",
): Promise<ProgramStatusMutationResult> {
  const programId = normalizedProgramId(athleticProgramId);
  if (!programId) return { ok: false, error: "Choose a valid swimming program." };
  if (status !== "saved" && status !== "ruled_out") {
    return { ok: false, error: "Choose a valid list status." };
  }
  const safeReason = typeof reason === "string" ? reason.slice(0, 300) : "";
  const { userId, supabase } = await swimmerUserContext();

  const { data: program, error: programError } = await supabase
    .from("athletic_programs")
    .select("id,sport_code")
    .eq("id", programId)
    .eq("active", true)
    .eq("visibility", "public")
    .maybeSingle();
  if (programError || !program || !program.sport_code.toLocaleLowerCase().includes("swim")) {
    return { ok: false, error: "That swimming program is not available." };
  }

  const { error } = await supabase.from("swimmer_college_status").upsert(
    { swimmer_user_id: userId, athletic_program_id: programId, status, reason: safeReason },
    { onConflict: "swimmer_user_id,athletic_program_id" },
  );
  return { ok: !error, error: error?.message ?? null };
}

export async function removeSwimmerProgramStatus(
  athleticProgramId: unknown,
): Promise<ProgramStatusMutationResult> {
  const programId = normalizedProgramId(athleticProgramId);
  if (!programId) return { ok: false, error: "Choose a valid swimming program." };
  const { userId, supabase } = await swimmerUserContext();
  const { error } = await supabase
    .from("swimmer_college_status")
    .delete()
    .eq("swimmer_user_id", userId)
    .eq("athletic_program_id", programId);
  return { ok: !error, error: error?.message ?? null };
}
