import "server-only";

import { createClient } from "./supabase/server";

export type CollegeOption = {
  athleticProgramId: string;
  institutionId: string;
  name: string;
  division: string | null;
  squad: "men" | "women" | "coed";
  city: string | null;
  stateCode: string | null;
};

type Row = {
  id: string;
  division: string | null;
  gender: string;
  institution_id: string;
  institutions:
    | { canonical_name: string; city: string | null; state_code: string | null }
    | { canonical_name: string; city: string | null; state_code: string | null }[]
    | null;
};

function toOption(row: Row): CollegeOption | null {
  const inst = Array.isArray(row.institutions) ? row.institutions[0] : row.institutions;
  if (!inst) return null;
  const squad = row.gender === "women" || row.gender === "coed" ? row.gender : "men";
  return {
    athleticProgramId: row.id,
    institutionId: row.institution_id,
    name: inst.canonical_name,
    division: row.division,
    squad,
    city: inst.city,
    stateCode: inst.state_code,
  };
}

const SELECT = "id,division,gender,institution_id,institutions!inner(canonical_name,city,state_code)";

export async function searchColleges(query: string, limit = 25): Promise<CollegeOption[]> {
  const supabase = await createClient();
  let builder = supabase
    .from("athletic_programs")
    .select(SELECT)
    .eq("active", true)
    .eq("visibility", "public")
    .ilike("sport_code", "%swim%");

  const clean = query.trim();
  if (clean.length >= 2) {
    builder = builder.ilike("institutions.canonical_name", `%${clean}%`);
  }

  const { data } = await builder
    .order("canonical_name", { referencedTable: "institutions" })
    .limit(limit);

  return ((data ?? []) as Row[]).map(toOption).filter((o): o is CollegeOption => o !== null);
}

export async function autoMatchCollege(institutionName: string): Promise<CollegeOption | null> {
  const clean = institutionName.trim();
  if (clean.length < 3) return null;
  const results = await searchColleges(clean, 1);
  return results[0] ?? null;
}
