import "server-only";

import { randomUUID } from "node:crypto";
import { createAdminClient } from "./supabase/admin";
import { getBestTimes, SwimsPendingError, SwimsRateLimitError } from "./swims";
import { resolveTodayAges, type TodayAgeResult } from "./class-resolver";
import { collectAllChunkedPages } from "./paginated-query";
import type { EventCode } from "./types";
import type { ProspectProfile } from "./recruit-fit";


const CALL_HEADROOM_MS = 15_000;

type EnrichmentClaim = {
  member_id: string;
  gender: "M" | "F" | null;
  swim_age: number | null;
  lease_token: string;
};

function admin() {
  return createAdminClient();
}

async function claimMembers(limit: number, workerId: string): Promise<EnrichmentClaim[]> {
  const { data, error } = await admin().rpc("claim_recruit_enrichment", {
    p_worker_id: workerId, p_limit: limit, p_lease_seconds: 600,
  });
  if (error) throw new Error(`Could not claim enrichment work: ${error.message}`);
  return (data ?? []) as EnrichmentClaim[];
}

async function finishMember(
  claim: EnrichmentClaim,
  rows: { event: string; course: string; seconds: number; swim_time: string }[] | null,
  errorMessage: string | null,
): Promise<void> {
  const { error } = await admin().rpc("finish_recruit_enrichment", {
    p_member_id: claim.member_id,
    p_lease_token: claim.lease_token,
    p_rows: rows,
    p_error_message: errorMessage?.slice(0, 500) ?? null,
  });
  if (error) throw new Error(`Could not finish enrichment: ${error.message}`);
}

export type EnrichmentTickResult = {
  membersEnriched: number;
  timesStored: number;
  failures: number;
  rateLimited: boolean;
  budgetExhausted: boolean;
  classes: TodayAgeResult | null;
};

export async function enrichmentTick(input: {
  limit?: number;
  deadlineMs?: number;
  classLimit?: number;
} = {}): Promise<EnrichmentTickResult> {
  const workerId = `enrich-${randomUUID()}`;
  const deadline = Date.now() + Math.max(1_000, input.deadlineMs ?? 240_000);
  const limit = Math.max(1, Math.min(200, input.limit ?? 60));

  let membersEnriched = 0;
  let timesStored = 0;
  let failures = 0;
  let rateLimited = false;
  const touched: string[] = [];

  while (membersEnriched + failures < limit && Date.now() + CALL_HEADROOM_MS <= deadline) {
    const claims = await claimMembers(Math.min(10, limit - membersEnriched - failures), workerId);
    if (claims.length === 0) break;  

    for (const claim of claims) {
      touched.push(claim.member_id);
      if (Date.now() + CALL_HEADROOM_MS > deadline) {
        await finishMember(claim, null, "Deadline reached before refresh").catch(() => undefined);
        continue;
      }
      try {
        const times = await getBestTimes(claim.member_id, {
          forceRefresh: false, allowStale: true, waitMs: 10_000, priority: 60,
        });
        const rows = times.map((t) => ({
          event: t.event,
          course: t.course,
          seconds: t.seconds,
          swim_time: t.clock,
        }));
        await finishMember(claim, rows, null);
        membersEnriched += 1;
        timesStored += rows.length;
      } catch (error) {
        if (error instanceof SwimsRateLimitError) {
          rateLimited = true;
          await finishMember(claim, null, error.message).catch(() => undefined);
          return { membersEnriched, timesStored, failures, rateLimited, budgetExhausted: false, classes: null };
        }
        const message = error instanceof SwimsPendingError
          ? "Queued upstream; retrying"
          : error instanceof Error ? error.message : "Unknown enrichment failure";
        await finishMember(claim, null, message).catch(() => undefined);
        failures += 1;
      }
    }
  }

  const classLimit = Math.max(0, input.classLimit ?? 40);
  const classes = classLimit > 0 && touched.length > 0 && Date.now() + CALL_HEADROOM_MS <= deadline
    ? await resolveTodayAges(touched, { limit: classLimit, deadline: deadline - CALL_HEADROOM_MS })
        .catch(() => null)
    : null;

  return {
    membersEnriched, timesStored, failures, rateLimited,
    budgetExhausted: membersEnriched + failures < limit && Date.now() + CALL_HEADROOM_MS > deadline,
    classes,
  };
}

type MemberTimeRow = { member_id: string; event: string; seconds: number };

export async function profilesFor(memberIds: readonly string[]): Promise<Map<string, ProspectProfile>> {
  const profiles = new Map<string, ProspectProfile>();
  const ids = [...new Set(memberIds)].filter((id) => /^[A-Za-z0-9]{6,20}$/.test(id));
  if (ids.length === 0) return profiles;

  const client = admin();
  const result = await collectAllChunkedPages<string, MemberTimeRow, unknown>(
    ids,
    (chunk, from, to) => client
      .from("recruit_member_times")
      .select("member_id, event, seconds")
      .eq("course", "SCY")
      .in("member_id", [...chunk])
      .order("member_id")
      .order("event")
      .range(from, to) as unknown as PromiseLike<{
        data: MemberTimeRow[] | null;
        error: unknown | null;
      }>,
  );
  if (result.error != null) return profiles;

  for (const row of result.data) {
    const profile = profiles.get(row.member_id) ?? {};
    profile[row.event as EventCode] = Number(row.seconds);
    profiles.set(row.member_id, profile);
  }
  return profiles;
}

export type SingletonRow = {
  event: string;
  gender: string;
  swim_age: number;
  lsc_code: string;
  singletons: number;
};

export async function discoverySingletons(seasonKey: number): Promise<SingletonRow[]> {
  const { data, error } = await admin().rpc("recruit_discovery_singletons", { p_season_key: seasonKey });
  if (error) return [];
  return (data ?? []) as SingletonRow[];
}
