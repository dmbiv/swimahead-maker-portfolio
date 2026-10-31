import "server-only";

import type { PostgrestError } from "@supabase/supabase-js";
import type { createClient } from "@/lib/supabase/server";
import { collectAllPages } from "@/lib/paginated-query";

export type SwimmerProgramStatus = "saved" | "ruled_out";

export type SwimmerProgramStatusRow = {
  athletic_program_id: string;
  status: SwimmerProgramStatus;
  reason: string;
  created_at: string;
};

export type SwimmerProgramStatusIndexRow = Pick<
  SwimmerProgramStatusRow,
  "athletic_program_id" | "status"
>;

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

export async function loadSwimmerProgramStatuses(
  supabase: ServerSupabaseClient,
  swimmerUserId: string,
  status?: SwimmerProgramStatus,
): Promise<{ data: SwimmerProgramStatusRow[]; error: PostgrestError | null }> {
  return collectAllPages<SwimmerProgramStatusRow, PostgrestError>((from, to) => {
    let query = supabase
      .from("swimmer_college_status")
      .select("athletic_program_id,status,reason,created_at")
      .eq("swimmer_user_id", swimmerUserId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: true });
    if (status) query = query.eq("status", status);
    return query.range(from, to) as unknown as PromiseLike<{
      data: SwimmerProgramStatusRow[] | null;
      error: PostgrestError | null;
    }>;
  });
}

export async function loadSwimmerProgramStatusIndex(
  supabase: ServerSupabaseClient,
  swimmerUserId: string,
): Promise<{ data: SwimmerProgramStatusIndexRow[]; error: PostgrestError | null }> {
  return collectAllPages<SwimmerProgramStatusIndexRow, PostgrestError>((from, to) =>
    supabase
      .from("swimmer_college_status")
      .select("athletic_program_id,status")
      .eq("swimmer_user_id", swimmerUserId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, to) as unknown as PromiseLike<{
        data: SwimmerProgramStatusIndexRow[] | null;
        error: PostgrestError | null;
      }>);
}
