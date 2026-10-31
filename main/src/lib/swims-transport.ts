import "server-only";

import { createHash } from "node:crypto";
import {
  parseRetryAfter,
  SwimsError,
  SwimsRateLimitError,
  type SwimsGatewayRequest,
} from "./swims-gateway-core";

const TIMES_API = "https://times-api.usaswimming.org/swims";
const REQUEST_TIMEOUT_MS = 12_000;
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const DEFAULT_DEVICE_SEED = "swimahead-swims-gateway-v1";

type UpstreamRequest = {
  path: string;
  method: "GET" | "POST";
  body?: unknown;
};

function deviceId(): string {
  const configured = process.env.SWIMS_DEVICE_ID?.trim();
  if (configured) return configured;

  const seed = process.env.SWIMS_DEVICE_SEED?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    DEFAULT_DEVICE_SEED;
  const fingerprint = createHash("sha256").update(seed).digest("hex");
  const encoded = Buffer.from(
    `MacIntel - Google Inc. - ${fingerprint} - 0`,
  ).toString("base64");
  return encoded.slice(0, 15) + encoded.slice(0, 5) + encoded.slice(15);
}

function requestHeaders(): Record<string, string> {
  return {
    "User-Agent": USER_AGENT,
    Accept: "application/json, text/plain, */*",
    "Content-Type": "application/json",
    "Device-Id": deviceId(),
    AppName: "DataHub",
    "Usas-Sub-Id": "Anonymous",
    Origin: "https://data.usaswimming.org",
    Referer: "https://data.usaswimming.org/",
  };
}

function upstreamRequest(request: SwimsGatewayRequest): UpstreamRequest {
  switch (request.kind) {
    case "member_search":
      return {
        path: "/TimesSearch/GetMembersForFilters",
        method: "POST",
        body: {
          orgCode: request.orgCode,
          lscCode: request.lscCode,
          isCurrent: request.currentOnly ? 1 : 0,
          name: request.name,
        },
      };
    case "member":
      return {
        path: `/TimesSearch/GetMember/${encodeURIComponent(request.memberId)}`,
        method: "GET",
      };
    case "best_times":
      return {
        path: `/TimesSearch/GetBestTimesForMember/${encodeURIComponent(request.memberId)}`,
        method: "GET",
      };
    case "top_times":
      return {
        path: "/TimesSearch/GetTopTimesLeaderBoard",
        method: "POST",
        body: {
          bestTimesOnly: 1,
          competitionGenderTypeId: request.gender === "F" ? 2 : 1,
          course: request.course,
          eventId: request.eventId,
          seasonKey: request.seasonKey,
          startDate: request.startDate,
          endDate: request.endDate,
          minAge: request.minAge,
          maxAge: request.maxAge,
          lscCode: request.lscCode,
          zoneCode: null,
          timeStandardType: null,
          loggedInUserClubs: false,
          teamUsaEligible: false,
        },
      };
    default:
      throw new SwimsError("Unsupported SWIMS gateway operation", 400);
  }
}

function isRateLimitStatus(status: number): boolean {
  return status === 406 || status === 429 || status === 503;
}

async function decodedResponse(response: Response): Promise<unknown> {
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new SwimsError("SWIMS returned an unparseable body", 502);
  }

  if (typeof data !== "string") return data;
  if (/^no records returned\b/i.test(data.trim())) return [];

  try {
    return JSON.parse(data) as unknown;
  } catch {
    throw new SwimsError("SWIMS returned an unparseable body", 502);
  }
}

export async function executeSwimsRequest(
  request: SwimsGatewayRequest,
): Promise<unknown> {
  const upstream = upstreamRequest(request);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${TIMES_API}${upstream.path}`, {
      method: upstream.method,
      headers: requestHeaders(),
      body: upstream.body === undefined ? undefined : JSON.stringify(upstream.body),
      cache: "no-store",
      signal: controller.signal,
    });

    if (response.status === 404) return [];
    if (isRateLimitStatus(response.status)) {
      throw new SwimsRateLimitError(
        response.status,
        parseRetryAfter(response.headers.get("retry-after")),
      );
    }
    if (!response.ok) {
      throw new SwimsError(`SWIMS returned ${response.status}`, response.status);
    }
    return decodedResponse(response);
  } finally {
    clearTimeout(timeout);
  }
}
