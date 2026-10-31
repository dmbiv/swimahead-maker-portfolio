import { createHash, randomUUID } from "node:crypto";


export type SwimsGatewayRequest =
  | {
      kind: "member_search";
      name: string;
      lscCode: string | null;
      orgCode: string | null;
      currentOnly: boolean;
    }
  | { kind: "member"; memberId: string }
  | { kind: "best_times"; memberId: string }
  | {
      kind: "top_times";
      eventId: number;
      gender: "M" | "F";
      course: "SCY" | "SCM" | "LCM";
      seasonKey: number;
      minAge: number | null;
      maxAge: number | null;
      lscCode: string | null;
      startDate: string | null;
      endDate: string | null;
    };

export type SwimsGatewayOperation = SwimsGatewayRequest["kind"];

export type SwimsGatewaySnapshot = {
  requestKey: string;
  response: unknown;
  fetchedAtMs: number;
  freshUntilMs: number;
  staleUntilMs: number;
};

export type SwimsGatewayClaim = {
  jobId: string;
  requestKey: string;
  request: SwimsGatewayRequest;
  leaseToken: string;
  attempt: number;
};

export type SwimsGatewayFailure = {
  kind: "rate_limit" | "timeout" | "upstream" | "invalid_response";
  status: number | null;
  message: string;
  retryAfterSeconds: number;
};

export interface SwimsGatewayStore {
  read(requestKey: string): Promise<SwimsGatewaySnapshot | null>;
  enqueue(input: {
    requestKey: string;
    operation: SwimsGatewayOperation;
    request: SwimsGatewayRequest;
    priority: number;
    force: boolean;
  }): Promise<void>;
  claim(input: {
    workerId: string;
    requestKey: string | null;
    leaseSeconds: number;
    minSpacingMs: number;
  }): Promise<SwimsGatewayClaim | null>;
  complete(input: {
    claim: SwimsGatewayClaim;
    response: unknown;
    responseHash: string;
    status: number;
    freshForSeconds: number;
    staleForSeconds: number;
  }): Promise<boolean>;
  fail(input: { claim: SwimsGatewayClaim; failure: SwimsGatewayFailure }): Promise<boolean>;
}

export interface SwimsGatewayExecutor {
  (request: SwimsGatewayRequest): Promise<unknown>;
}

export class SwimsError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "SwimsError";
    this.status = status;
  }
}

export class SwimsRateLimitError extends SwimsError {
  readonly retryAfterMs: number | null;

  constructor(status: number, retryAfterMs: number | null = null) {
    super(`SWIMS is rate-limiting requests (${status})`, status);
    this.name = "SwimsRateLimitError";
    this.retryAfterMs = retryAfterMs;
  }
}

export class SwimsPendingError extends SwimsError {
  readonly retryAfterMs: number;

  constructor(retryAfterMs = 2_000) {
    super("SWIMS data is queued for refresh", 202);
    this.name = "SwimsPendingError";
    this.retryAfterMs = retryAfterMs;
  }
}

export type CachePolicy = {
  freshSeconds: number;
  staleSeconds: number;
  emptyFreshSeconds: number;
};

const CACHE_POLICIES: Record<SwimsGatewayOperation, CachePolicy> = {
  member_search: { freshSeconds: 24 * 60 * 60, staleSeconds: 30 * 24 * 60 * 60, emptyFreshSeconds: 30 * 60 },
  member: { freshSeconds: 12 * 60 * 60, staleSeconds: 30 * 24 * 60 * 60, emptyFreshSeconds: 30 * 60 },
  best_times: { freshSeconds: 4 * 60 * 60, staleSeconds: 180 * 24 * 60 * 60, emptyFreshSeconds: 30 * 60 },
  top_times: { freshSeconds: 3 * 60 * 60, staleSeconds: 14 * 24 * 60 * 60, emptyFreshSeconds: 20 * 60 },
};

export function cachePolicyFor(operation: SwimsGatewayOperation, response: unknown): CachePolicy {
  const policy = CACHE_POLICIES[operation];
  return Array.isArray(response) && response.length === 0
    ? { ...policy, freshSeconds: policy.emptyFreshSeconds }
    : policy;
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("Gateway keys cannot contain non-finite numbers");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(",")}}`;
  }
  throw new TypeError(`Gateway keys cannot contain ${typeof value}`);
}

export function swimsRequestKey(request: SwimsGatewayRequest): string {
  const digest = createHash("sha256")
    .update(canonicalJson({ schema: 1, request }))
    .digest("hex");
  return `swims:v1:${digest}`;
}

export function responseHash(response: unknown): string {
  return createHash("sha256").update(canonicalJson(response)).digest("hex");
}

export function parseRetryAfter(value: string | null, nowMs = Date.now()): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
    return Math.max(0, Math.ceil(Number(trimmed) * 1_000));
  }
  const timestamp = Date.parse(trimmed);
  return Number.isFinite(timestamp) ? Math.max(0, timestamp - nowMs) : null;
}

export function isSwimsRateLimitStatus(status: number): boolean {
  return status === 406 || status === 429 || status === 503;
}

export function durableRetryDelayMs(input: {
  attempt: number;
  rateLimited: boolean;
  retryAfterMs?: number | null;
}): number {
  const exponent = Math.max(0, Math.min(8, input.attempt - 1));
  const base = input.rateLimited ? 60_000 : 5_000;
  const cap = input.rateLimited ? 60 * 60_000 : 15 * 60_000;
  return Math.min(cap, Math.max(input.retryAfterMs ?? 0, base * 2 ** exponent));
}

export function isSwimsGatewayRequest(value: unknown): value is SwimsGatewayRequest {
  if (!value || typeof value !== "object") return false;
  const request = value as Record<string, unknown>;
  const nullableString = (candidate: unknown, max: number) =>
    candidate === null || (typeof candidate === "string" && candidate.length <= max);
  const nullableAge = (candidate: unknown) =>
    candidate === null || (Number.isInteger(candidate) && Number(candidate) >= 5 && Number(candidate) <= 120);
  switch (request.kind) {
    case "member_search":
      return typeof request.name === "string" && request.name.length >= 2 && request.name.length <= 80 &&
        nullableString(request.lscCode, 8) && nullableString(request.orgCode, 20) &&
        typeof request.currentOnly === "boolean";
    case "member":
    case "best_times":
      return typeof request.memberId === "string" && /^[A-Za-z0-9]{6,20}$/.test(request.memberId);
    case "top_times": {
      const isoDate = (candidate: unknown) =>
        candidate === null || (typeof candidate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(candidate));
      return Number.isInteger(request.eventId) && Number(request.eventId) > 0 && Number(request.eventId) < 10_000 &&
        (request.gender === "M" || request.gender === "F") &&
        (request.course === "SCY" || request.course === "SCM" || request.course === "LCM") &&
        Number.isInteger(request.seasonKey) && Number(request.seasonKey) > 0 &&
        nullableAge(request.minAge) && nullableAge(request.maxAge) && nullableString(request.lscCode, 8) &&
        isoDate(request.startDate) && isoDate(request.endDate);
    }
    default:
      return false;
  }
}

type GatewayOptions = {
  forceRefresh?: boolean;
  allowStale?: boolean;
  waitMs?: number;
  priority?: number;
};

type GatewayDependencies = {
  store: SwimsGatewayStore;
  execute: SwimsGatewayExecutor;
  onCompleted?: (request: SwimsGatewayRequest, response: unknown) => Promise<void>;
  now?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
  workerId?: () => string;
  minSpacingMs?: number;
  leaseSeconds?: number;
};

function defaultSleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function failureFor(error: unknown, attempt: number): SwimsGatewayFailure {
  const rateLimited = error instanceof SwimsRateLimitError;
  const status = error instanceof SwimsError ? error.status : null;
  const timeout = error instanceof Error && (error.name === "AbortError" || /timed?\s*out/i.test(error.message));
  const retryAfterMs = rateLimited ? error.retryAfterMs : null;
  return {
    kind: rateLimited ? "rate_limit" : timeout ? "timeout" : status === 502 ? "invalid_response" : "upstream",
    status,
    message: error instanceof Error ? error.message.slice(0, 500) : "Unknown SWIMS failure",
    retryAfterSeconds: Math.max(1, Math.ceil(durableRetryDelayMs({
      attempt,
      rateLimited,
      retryAfterMs,
    }) / 1_000)),
  };
}

export class SwimsGateway {
  private readonly store: SwimsGatewayStore;
  private readonly execute: SwimsGatewayExecutor;
  private readonly onCompleted: ((request: SwimsGatewayRequest, response: unknown) => Promise<void>) | null;
  private readonly now: () => number;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private readonly workerId: () => string;
  readonly minSpacingMs: number;
  private readonly leaseSeconds: number;
  private readonly foregroundFlights = new Map<string, Promise<unknown>>();

  constructor(dependencies: GatewayDependencies) {
    this.store = dependencies.store;
    this.execute = dependencies.execute;
    this.onCompleted = dependencies.onCompleted ?? null;
    this.now = dependencies.now ?? Date.now;
    this.sleep = dependencies.sleep ?? defaultSleep;
    this.workerId = dependencies.workerId ?? (() => `swims-${randomUUID()}`);
    this.minSpacingMs = Math.max(250, dependencies.minSpacingMs ?? 1_100);
    this.leaseSeconds = Math.max(10, dependencies.leaseSeconds ?? 30);
  }

  async request<T>(request: SwimsGatewayRequest, options: GatewayOptions = {}): Promise<T> {
    const requestKey = swimsRequestKey(request);
    const flightKey = [
      requestKey,
      options.forceRefresh === true ? "force" : "normal",
      options.allowStale === false ? "strict" : "stale",
      options.priority ?? 100,
    ].join(":");
    const existing = this.foregroundFlights.get(flightKey);
    if (existing) return existing as Promise<T>;

    const flight = this.requestUncoalesced<T>(request, requestKey, options);
    this.foregroundFlights.set(flightKey, flight);
    try {
      return await flight;
    } finally {
      if (this.foregroundFlights.get(flightKey) === flight) this.foregroundFlights.delete(flightKey);
    }
  }

  private async requestUncoalesced<T>(
    request: SwimsGatewayRequest,
    requestKey: string,
    options: GatewayOptions,
  ): Promise<T> {
    const initial = await this.store.read(requestKey);
    const now = this.now();
    const force = options.forceRefresh === true;
    const allowStale = options.allowStale !== false;

    if (!force && initial && initial.freshUntilMs > now) return initial.response as T;
    if (force && initial && initial.freshUntilMs > now && initial.fetchedAtMs > now - 5 * 60_000) {
      return initial.response as T;
    }

    if (!force && allowStale && initial && initial.staleUntilMs > now) {
      await this.store.enqueue({
        requestKey,
        operation: request.kind,
        request,
        priority: options.priority ?? 100,
        force: false,
      }).catch(() => undefined);
      return initial.response as T;
    }

    await this.store.enqueue({
      requestKey,
      operation: request.kind,
      request,
      priority: options.priority ?? 100,
      force,
    });

    const waitMs = Math.max(0, Math.min(10_000, options.waitMs ?? 2_500));
    const deadline = this.now() + waitMs;
    const baselineFetchedAt = initial?.fetchedAtMs ?? -1;
    const workerId = this.workerId();

    while (true) {
      const refreshed = await this.store.read(requestKey);
      if (refreshed && refreshed.fetchedAtMs > baselineFetchedAt && refreshed.freshUntilMs > this.now()) {
        return refreshed.response as T;
      }

      const claim = await this.store.claim({
        workerId,
        requestKey,
        leaseSeconds: this.leaseSeconds,
        minSpacingMs: this.minSpacingMs,
      });
      if (claim) {
        try {
          return await this.executeClaim<T>(claim);
        } catch (error) {
          if (allowStale && initial) return initial.response as T;
          throw error;
        }
      }

      if (this.now() >= deadline) {
        if (allowStale && initial) return initial.response as T;
        throw new SwimsPendingError(Math.max(this.minSpacingMs, 2_000));
      }
      await this.sleep(Math.min(150, Math.max(1, deadline - this.now())));
    }
  }

  async runOne(workerId = this.workerId()): Promise<boolean> {
    const claim = await this.store.claim({
      workerId,
      requestKey: null,
      leaseSeconds: this.leaseSeconds,
      minSpacingMs: this.minSpacingMs,
    });
    if (!claim) return false;
    try {
      await this.executeClaim(claim);
    } catch {
    }
    return true;
  }

  async drain(input: { limit?: number; deadlineMs?: number } = {}): Promise<number> {
    const limit = Math.max(1, Math.min(100, input.limit ?? 40));
    const deadline = this.now() + Math.max(1_000, input.deadlineMs ?? 50_000);
    const workerId = this.workerId();
    let processed = 0;
    while (processed < limit && this.now() < deadline) {
      const didRun = await this.runOne(workerId);
      if (!didRun) break;
      processed += 1;
      if (processed < limit && this.now() + this.minSpacingMs < deadline) {
        await this.sleep(this.minSpacingMs);
      }
    }
    return processed;
  }

  private async executeClaim<T>(claim: SwimsGatewayClaim): Promise<T> {
    try {
      const response = await this.execute(claim.request);
      const policy = cachePolicyFor(claim.request.kind, response);
      const completed = await this.store.complete({
        claim,
        response,
        responseHash: responseHash(response),
        status: 200,
        freshForSeconds: policy.freshSeconds,
        staleForSeconds: policy.staleSeconds,
      });
      if (!completed) {
        const winner = await this.store.read(claim.requestKey);
        if (winner) return winner.response as T;
        throw new SwimsPendingError();
      }
      if (this.onCompleted) {
        await this.onCompleted(claim.request, response).catch(() => undefined);
      }
      return response as T;
    } catch (error) {
      if (error instanceof SwimsPendingError) throw error;
      await this.store.fail({
        claim,
        failure: failureFor(error, claim.attempt),
      }).catch(() => false);
      throw error;
    }
  }
}
