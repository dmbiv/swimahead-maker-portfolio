import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { requireCoachWorkspace } from "./auth";
import { listCoachColleges, type CoachCollege } from "./coach-college";
import type { CollegeChoice } from "@/app/c/college-switcher";

export type CoachContext = {
  colleges: CoachCollege[];
  active: CoachCollege | null;
  choices: CollegeChoice[];
};

const ACTIVE_COLLEGE_COOKIE = "wr_coach_college";

export const getCoachContext = cache(async (requested?: string | null): Promise<CoachContext> => {
  const { membership } = await requireCoachWorkspace();
  const colleges = await listCoachColleges(membership);
  const remembered = (await cookies()).get(ACTIVE_COLLEGE_COOKIE)?.value ?? null;
  const preferred = requested ?? remembered;
  const active = preferred
    ? colleges.find((c) => c.id === preferred) ?? colleges[0] ?? null
    : colleges[0] ?? null;
  const choices: CollegeChoice[] = colleges.map((c) => ({
    id: c.id,
    name: c.name,
    squad: c.squad,
    division: c.division,
  }));
  return { colleges, active, choices };
});
