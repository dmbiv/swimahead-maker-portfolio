import { enqueueDueSwimsBestTimes, processSwimsQueue } from "@/lib/swims-gateway";
import { enrichmentTick } from "@/lib/recruit-enrichment";
import { refuseUnlicensedIngest } from "@/lib/ingest-auth";


export const maxDuration = 300;

const DRAIN_BUDGET_MS = 90_000;
const ENRICH_BUDGET_MS = 160_000;

async function handle(request: Request): Promise<Response> {
  const refusal = refuseUnlicensedIngest(request, {
    job: "swims",
    secretEnvNames: ["CRON_SECRET", "SWIMS_GATEWAY_SECRET"],
  });
  if (refusal) return refusal;

  const url = new URL(request.url);
  const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit") ?? "100") || 100));
  const enrichLimit = Math.max(0, Math.min(200, Number(url.searchParams.get("enrich") ?? "60") || 60));
  const classLimit = Math.max(0, Math.min(200, Number(url.searchParams.get("classes") ?? "40") || 40));

  try {
    const enqueued = await enqueueDueSwimsBestTimes(100);
    const processed = await processSwimsQueue(limit, DRAIN_BUDGET_MS);
    const enrichment = enrichLimit > 0
      ? await enrichmentTick({ limit: enrichLimit, deadlineMs: ENRICH_BUDGET_MS, classLimit })
      : null;

    console.log(
      `[ingest:swims] enqueued=${enqueued} processed=${processed}` +
        ` enriched=${enrichment?.membersEnriched ?? 0} times=${enrichment?.timesStored ?? 0}` +
        ` failures=${enrichment?.failures ?? 0} rateLimited=${enrichment?.rateLimited ?? false}` +
        ` classLookups=${enrichment?.classes?.lookedUp ?? 0}` +
        ` classPinned=${enrichment?.classes?.newlyResolved ?? 0}` +
        ` classAlreadyExact=${enrichment?.classes?.alreadyResolved ?? 0}`,
    );
    return Response.json(
      { ok: true, enqueued, processed, enrichment },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    console.error("[ingest:swims] worker failed.");
    return Response.json(
      { ok: false, code: "worker_failed", error: "SWIMS gateway worker failed." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function GET(request: Request): Promise<Response> {
  return handle(request);
}

export async function POST(request: Request): Promise<Response> {
  return handle(request);
}
