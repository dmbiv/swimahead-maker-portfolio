import { cacheLife } from "next/cache";
import { requireCoachWorkspace } from "@/lib/auth";
import {
  buildSwimCloudSwimmerLuckyUrl,
  buildSwimCloudSwimmerSearchUrl,
  profileUrlFromLuckyRedirect,
} from "@/lib/swimcloud-links";


const LUCKY_TIMEOUT_MS = 4000;

const LUCKY_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
} as const;

async function lookupProfileUrl(luckyUrl: string): Promise<string | null> {
  "use cache";
  cacheLife("max");

  try {
    const response = await fetch(luckyUrl, {
      headers: LUCKY_HEADERS,
      redirect: "manual",
      signal: AbortSignal.timeout(LUCKY_TIMEOUT_MS),
    });
    const location = response.headers.get("location");
    return location ? profileUrlFromLuckyRedirect(location) : null;
  } catch {
    return null;
  }
}

export async function GET(request: Request): Promise<Response> {
  await requireCoachWorkspace();

  const params = new URL(request.url).searchParams;
  const fullName = (params.get("name") ?? "").trim().slice(0, 80);
  if (fullName.length < 2) {
    return Response.json({ ok: false, error: "A swimmer name is required." }, { status: 400 });
  }
  const classYears = (params.get("classes") ?? "")
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((year) => Number.isInteger(year) && year >= 2000 && year <= 2100)
    .slice(0, 4);
  const lscCode = /^[A-Za-z]{2,4}$/.test(params.get("lsc") ?? "") ? params.get("lsc") : null;

  const lookup = { fullName, classYears, lscCode };
  const profile = await lookupProfileUrl(buildSwimCloudSwimmerLuckyUrl(lookup));

  return Response.redirect(profile ?? buildSwimCloudSwimmerSearchUrl(lookup), 302);
}
