import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { PUBLIC_PROGRAMS_TAG } from "@/lib/public-programs";

function sameSecret(supplied: string, expected: string): boolean {
  const suppliedBytes = Buffer.from(supplied);
  const expectedBytes = Buffer.from(expected);
  return suppliedBytes.length === expectedBytes.length && timingSafeEqual(suppliedBytes, expectedBytes);
}

export async function POST(request: Request) {
  const expected = [
    process.env.DATA_REVALIDATION_SECRET,
    process.env.SUPABASE_SECRET_KEY,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  ].map((value) => value?.trim()).filter((value): value is string => Boolean(value));
  if (expected.length === 0) {
    return Response.json({ ok: false, error: "Cache revalidation is not configured." }, { status: 503 });
  }

  const authorization = request.headers.get("authorization") ?? "";
  const supplied = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!supplied || !expected.some((secret) => sameSecret(supplied, secret))) {
    return Response.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  revalidateTag(PUBLIC_PROGRAMS_TAG, { expire: 0 });
  return Response.json({ ok: true, revalidated: PUBLIC_PROGRAMS_TAG }, {
    headers: { "Cache-Control": "no-store" },
  });
}
