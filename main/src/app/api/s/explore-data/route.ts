import { getOptionalAuthContext } from "@/lib/auth";
import { loadExploreSwimmingPrograms } from "@/lib/explore-programs";
import { createClient } from "@/lib/supabase/server";
import { loadSwimmerProgramStatusIndex } from "@/lib/swimmer-program-statuses";
import type { PublicProgramMapItem } from "@/lib/public-programs";

const MAX_PROGRAMS = 2_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
};

type RequestBody = {
  kind?: unknown;
  programIds?: unknown;
};

function validatedIds(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > MAX_PROGRAMS) return null;
  const ids = value.filter((item): item is string => typeof item === "string" && UUID.test(item));
  if (ids.length !== value.length) return null;
  return [...new Set(ids)];
}

export async function POST(request: Request) {
  let body: RequestBody;
  try {
    body = await request.json() as RequestBody;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400, headers: PRIVATE_HEADERS });
  }
  const programIds = validatedIds(body.programIds);
  if (!programIds || (body.kind !== "map" && body.kind !== "rules")) {
    return Response.json({ error: "Invalid Explore data request." }, { status: 400, headers: PRIVATE_HEADERS });
  }

  const authPromise = body.kind === "rules" ? getOptionalAuthContext() : Promise.resolve(null);
  const [directory, auth] = await Promise.all([
    loadExploreSwimmingPrograms(),
    authPromise,
  ]);
  if (directory.status !== "ready") {
    return Response.json({ error: "Program data is unavailable." }, { status: 503, headers: PRIVATE_HEADERS });
  }
  const publicPrograms = new Map(directory.programs.map((program) => [program.id, program]));
  const programs = programIds.flatMap((id) => {
    const program = publicPrograms.get(id);
    return program ? [program] : [];
  });

  if (body.kind === "map") {
    const mapPrograms: PublicProgramMapItem[] = programs.map((program) => ({
      id: program.id,
      institutionId: program.institutionId,
      institutionName: program.institutionName,
      programName: program.programName,
      city: program.city,
      stateCode: program.stateCode,
      latitude: program.latitude,
      longitude: program.longitude,
      squad: program.squad,
      division: program.division,
      averageNetPrice: program.averageNetPrice,
      conferenceName: program.conference?.shortName ?? program.conference?.name ?? null,
    }));
    return Response.json({ programs: mapPrograms }, { headers: PRIVATE_HEADERS });
  }

  if (!auth || auth.accountType !== "swimmer" || !auth.onboardingCompleted) {
    return Response.json({ error: "Authentication required." }, { status: 401, headers: PRIVATE_HEADERS });
  }
  const supabase = await createClient();
  const statusResult = await loadSwimmerProgramStatusIndex(supabase, auth.userId);
  if (statusResult.error) {
    return Response.json({ error: "Program choices are unavailable." }, { status: 503, headers: PRIVATE_HEADERS });
  }
  const statuses = new Map(statusResult.data.map((row) => [row.athletic_program_id, row.status]));
  const targets = programs.map((program) => ({
    programId: program.id,
    squad: program.squad,
    netPrice: program.averageNetPrice,
    division: program.division,
    stateCode: program.stateCode,
    majors: program.bachelorsOfferings.map((offering) => offering.title),
    status: statuses.get(program.id),
  }));
  const states = [...new Set(programs.flatMap((program) => program.stateCode ? [program.stateCode] : []))].sort();
  const majorOptions = [...new Set(programs.flatMap((program) =>
    program.bachelorsOfferings.map((offering) => offering.title)))].sort((left, right) => left.localeCompare(right));

  return Response.json({ targets, states, majorOptions }, { headers: PRIVATE_HEADERS });
}
