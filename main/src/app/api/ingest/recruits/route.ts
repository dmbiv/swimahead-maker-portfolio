import { discoveryTick, ensureCoverageCells, SWEEP_SEASON_KEY } from "@/lib/recruit-coverage";
import { refuseUnlicensedIngest } from "@/lib/ingest-auth";


export const maxDuration = 300;

const TICK_BUDGET_MS = 260_000;

function seasonBounds(seasonKey: number): { seasonStart: string; seasonEnd: string } {
  const endYear = 1871 + seasonKey;  
  return { seasonStart: `${endYear - 1}-09-01`, seasonEnd: `${endYear}-08-31` };
}

async function handle(request: Request): Promise<Response> {
  const refusal = refuseUnlicensedIngest(request, {
    job: "recruits",
    secretEnvNames: ["CRON_SECRET", "RECRUIT_INGEST_SECRET"],
  });
  if (refusal) return refusal;

  const url = new URL(request.url);
  const cellLimit = Math.max(1, Math.min(40, Number(url.searchParams.get("cells") ?? "8") || 8));
  const { seasonStart, seasonEnd } = seasonBounds(SWEEP_SEASON_KEY);

  try {
    const seeded = await ensureCoverageCells();
    const result = await discoveryTick({
      cellLimit,
      deadlineMs: TICK_BUDGET_MS,
      seasonStart,
      seasonEnd,
    });
    console.log(
      `[ingest:recruits] cells=${result.cellsSwept} discovered=${result.discovered}` +
        ` requests=${result.requests} saturated=${result.saturatedCells}` +
        ` rateLimited=${result.rateLimited} budgetExhausted=${result.budgetExhausted}`,
    );
    return Response.json({ ok: true, seeded, ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    console.error("[ingest:recruits] tick failed.");
    return Response.json(
      { ok: false, code: "tick_failed", error: "Discovery failed." },
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
