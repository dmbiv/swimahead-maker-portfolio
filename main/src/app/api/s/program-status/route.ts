import { revalidateSwimmerViews } from "@/lib/swimmer-view-revalidation";
import {
  persistSwimmerProgramStatus,
  removeSwimmerProgramStatus,
} from "@/lib/swimmer-program-status-mutations";

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
};

type RequestBody = {
  programId?: unknown;
  status?: unknown;
  reason?: unknown;
};

export async function POST(request: Request) {
  let body: RequestBody;
  try {
    body = await request.json() as RequestBody;
  } catch {
    return Response.json(
      { ok: false, error: "Invalid JSON body." },
      { status: 400, headers: PRIVATE_HEADERS },
    );
  }

  const result = body.status === null
    ? await removeSwimmerProgramStatus(body.programId)
    : await persistSwimmerProgramStatus(body.programId, body.status, body.reason);
  if (!result.ok) {
    return Response.json(result, { status: 400, headers: PRIVATE_HEADERS });
  }

  revalidateSwimmerViews();
  return Response.json(result, { headers: PRIVATE_HEADERS });
}
