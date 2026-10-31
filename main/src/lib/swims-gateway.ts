import "server-only";

import { randomUUID } from "node:crypto";
import { createAdminClient } from "./supabase/admin";
import {
  SwimsGateway,
  SwimsError,
  isSwimsGatewayRequest,
  type SwimsGatewayClaim,
  type SwimsGatewayRequest,
  type SwimsGatewaySnapshot,
  type SwimsGatewayStore,
} from "./swims-gateway-core";
import { executeSwimsRequest } from "./swims-transport";

type RpcRow = Record<string, unknown>;

function firstRpcRow(data: unknown): RpcRow | null {
  if (Array.isArray(data)) {
    const row = data[0];
    return row && typeof row === "object" ? row as RpcRow : null;
  }
  return data && typeof data === "object" ? data as RpcRow : null;
}

function timestamp(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function configuredNumber(name: string, fallback: number, min: number, max: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? Math.max(min, Math.min(max, Math.round(value))) : fallback;
}

class SupabaseSwimsGatewayStore implements SwimsGatewayStore {
  private readonly localSnapshots = new Map<
    string,
    { value: SwimsGatewaySnapshot | null; expiresAtMs: number }
  >();
  private readonly recentEnqueues = new Map<string, number>();

  private remember(requestKey: string, value: SwimsGatewaySnapshot | null): void {
    if (!this.localSnapshots.has(requestKey) && this.localSnapshots.size >= 1_000) {
      const oldest = this.localSnapshots.keys().next().value;
      if (typeof oldest === "string") this.localSnapshots.delete(oldest);
    }
    const now = Date.now();
    const ttl = value == null
      ? 250
      : value.freshUntilMs > now
        ? Math.min(30_000, Math.max(250, value.freshUntilMs - now))
        : 2_000;
    this.localSnapshots.set(requestKey, { value, expiresAtMs: now + ttl });
  }

  async read(requestKey: string): Promise<SwimsGatewaySnapshot | null> {
    const local = this.localSnapshots.get(requestKey);
    if (local && local.expiresAtMs > Date.now()) return local.value;
    if (local) this.localSnapshots.delete(requestKey);

    const admin = createAdminClient();
    const { data, error } = await admin.rpc("read_swims_gateway_cache", {
      p_request_key: requestKey,
    });
    if (error) throw new Error(`SWIMS gateway cache read failed: ${error.message}`);
    const row = firstRpcRow(data);
    if (!row) {
      this.remember(requestKey, null);
      return null;
    }
    const fetchedAtMs = timestamp(row.fetched_at);
    const freshUntilMs = timestamp(row.fresh_until);
    const staleUntilMs = timestamp(row.stale_until);
    if (fetchedAtMs == null || freshUntilMs == null || staleUntilMs == null) return null;
    const snapshot = {
      requestKey,
      response: row.response_body,
      fetchedAtMs,
      freshUntilMs,
      staleUntilMs,
    };
    this.remember(requestKey, snapshot);
    return snapshot;
  }

  async enqueue(input: Parameters<SwimsGatewayStore["enqueue"]>[0]): Promise<void> {
    if (!input.force && (this.recentEnqueues.get(input.requestKey) ?? 0) > Date.now()) return;
    const admin = createAdminClient();
    const { error } = await admin.rpc("enqueue_swims_gateway_job", {
      p_request_key: input.requestKey,
      p_operation: input.operation,
      p_request_payload: input.request,
      p_priority: input.priority,
      p_force: input.force,
    });
    if (error) throw new Error(`SWIMS gateway enqueue failed: ${error.message}`);
    if (!input.force) {
      if (!this.recentEnqueues.has(input.requestKey) && this.recentEnqueues.size >= 1_000) {
        const oldest = this.recentEnqueues.keys().next().value;
        if (typeof oldest === "string") this.recentEnqueues.delete(oldest);
      }
      this.recentEnqueues.set(input.requestKey, Date.now() + 2_000);
    }
  }

  async claim(input: Parameters<SwimsGatewayStore["claim"]>[0]): Promise<SwimsGatewayClaim | null> {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("claim_swims_gateway_job", {
      p_worker_id: input.workerId,
      p_request_key: input.requestKey,
      p_lease_seconds: input.leaseSeconds,
      p_min_spacing_ms: input.minSpacingMs,
    });
    if (error) throw new Error(`SWIMS gateway claim failed: ${error.message}`);
    const row = firstRpcRow(data);
    if (!row) return null;
    const request = row.request_payload;
    if (!isSwimsGatewayRequest(request)) {
      throw new Error("SWIMS gateway claimed an invalid request payload");
    }
    if (typeof row.job_id !== "string" || typeof row.request_key !== "string" || typeof row.lease_token !== "string") {
      throw new Error("SWIMS gateway claim is missing its lease fence");
    }
    return {
      jobId: row.job_id,
      requestKey: row.request_key,
      request,
      leaseToken: row.lease_token,
      attempt: typeof row.attempt_number === "number" ? row.attempt_number : 1,
    };
  }

  async complete(input: Parameters<SwimsGatewayStore["complete"]>[0]): Promise<boolean> {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("complete_swims_gateway_job", {
      p_job_id: input.claim.jobId,
      p_lease_token: input.claim.leaseToken,
      p_http_status: input.status,
      p_response_body: input.response,
      p_response_hash: input.responseHash,
      p_fresh_for_seconds: input.freshForSeconds,
      p_serve_stale_for_seconds: input.staleForSeconds,
    });
    if (error) throw new Error(`SWIMS gateway completion failed: ${error.message}`);
    if (data === true) {
      const fetchedAtMs = Date.now();
      this.remember(input.claim.requestKey, {
        requestKey: input.claim.requestKey,
        response: input.response,
        fetchedAtMs,
        freshUntilMs: fetchedAtMs + input.freshForSeconds * 1_000,
        staleUntilMs: fetchedAtMs + input.staleForSeconds * 1_000,
      });
    }
    return data === true;
  }

  async fail(input: Parameters<SwimsGatewayStore["fail"]>[0]): Promise<boolean> {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("fail_swims_gateway_job", {
      p_job_id: input.claim.jobId,
      p_lease_token: input.claim.leaseToken,
      p_failure_kind: input.failure.kind,
      p_http_status: input.failure.status,
      p_error_message: input.failure.message,
      p_retry_after_seconds: input.failure.retryAfterSeconds,
    });
    if (error) throw new Error(`SWIMS gateway failure update failed: ${error.message}`);
    return data === true;
  }
}

type MemberProjection = {
  memberId: string;
  fullName: string;
  shortName: string | null;
  clubName: string | null;
  clubCode: string | null;
  lscCode: string | null;
  swimmerAge: number | null;
  isNcaa: number | null;
};

function memberProjection(value: unknown): MemberProjection | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.memberId !== "string" || !/^[A-Za-z0-9]{6,20}$/.test(row.memberId)) return null;
  if (typeof row.fullName !== "string" || row.fullName.trim().length === 0) return null;
  return {
    memberId: row.memberId,
    fullName: row.fullName.slice(0, 200),
    shortName: typeof row.shortName === "string" ? row.shortName.slice(0, 200) : null,
    clubName: typeof row.clubName === "string" ? row.clubName.slice(0, 200) : null,
    clubCode: typeof row.clubCode === "string" ? row.clubCode.trim().toUpperCase() || null : null,
    lscCode: typeof row.lscCode === "string" ? row.lscCode.slice(0, 8) : null,
    swimmerAge: typeof row.swimmerAge === "number" && Number.isFinite(row.swimmerAge) ? row.swimmerAge : null,
    isNcaa: typeof row.isNcaa === "number" ? row.isNcaa : null,
  };
}

async function recordMembers(request: SwimsGatewayRequest, response: unknown): Promise<void> {
  if (request.kind === "best_times") return;
  const values = Array.isArray(response) ? response : [response];
  const rows = values.map(memberProjection).filter((row): row is MemberProjection => row !== null);
  if (rows.length === 0) return;
  const admin = createAdminClient();
  const { error } = await admin.rpc("record_swims_members", { p_rows: rows });
  if (error) throw new Error(error.message);
}

const store = new SupabaseSwimsGatewayStore();
const gateway = new SwimsGateway({
  store,
  execute: executeSwimsRequest,
  onCompleted: recordMembers,
  minSpacingMs: configuredNumber("SWIMS_MIN_SPACING_MS", 1_100, 250, 60_000),
  leaseSeconds: configuredNumber("SWIMS_LEASE_SECONDS", 30, 10, 300),
  workerId: () => `swims-${process.env.VERCEL_REGION ?? "local"}-${randomUUID()}`,
});

export type RequestSwimsOptions = {
  forceRefresh?: boolean;
  allowStale?: boolean;
  waitMs?: number;
  priority?: number;
};

type LocalMemberRow = {
  member_id: string;
  full_name: string;
  short_name: string | null;
  club_name: string | null;
  club_code: string | null;
  lsc_code: string | null;
  swimmer_age: number | null;
  is_ncaa: boolean | null;
};

async function localMemberFallback(request: Extract<SwimsGatewayRequest, { kind: "member_search" }>): Promise<unknown[]> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("search_swims_members_local", {
    p_name: request.name,
    p_lsc_code: request.lscCode,
    p_limit: 40,
  });
  if (error) return [];
  return ((data ?? []) as LocalMemberRow[]).map((row) => ({
    memberId: row.member_id,
    fullName: row.full_name,
    shortName: row.short_name ?? row.full_name,
    clubName: row.club_name,
    clubCode: row.club_code?.trim().toUpperCase() || null,
    lscCode: row.lsc_code,
    swimmerAge: row.swimmer_age,
    isNcaa: row.is_ncaa ? 1 : 0,
  }));
}

export async function requestSwims<T>(
  request: SwimsGatewayRequest,
  options: RequestSwimsOptions = {},
): Promise<T> {
  try {
    return await gateway.request<T>(request, options);
  } catch (error) {
    if (request.kind === "member_search" && error instanceof SwimsError) {
      const local = await localMemberFallback(request);
      if (local.length > 0) return local as T;
    }
    throw error;
  }
}

export async function processSwimsQueue(limit = 40, deadlineMs = 50_000): Promise<number> {
  return gateway.drain({ limit, deadlineMs });
}

export async function enqueueDueSwimsBestTimes(limit = 100): Promise<number> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("enqueue_due_swims_best_times", {
    p_limit: Math.max(1, Math.min(500, limit)),
  });
  if (error) throw new Error(`Could not seed due SWIMS member refreshes: ${error.message}`);
  return typeof data === "number" ? data : 0;
}
