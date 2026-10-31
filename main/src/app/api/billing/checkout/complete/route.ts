import { NextResponse } from "next/server";
import { requireAccountType } from "@/lib/auth";
import { reconcileCoachCheckout } from "@/lib/coach-billing";
import { configuredSiteUrl } from "@/lib/env";

function destination(path: string): NextResponse {
  const base = configuredSiteUrl() ?? "http://localhost";
  return NextResponse.redirect(new URL(path, base), {
    status: 303,
    headers: {
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}

export async function GET(request: Request) {
  const context = await requireAccountType("coach", "/subscribe");
  const sessionId = new URL(request.url).searchParams.get("session_id") ?? "";

  try {
    const result = await reconcileCoachCheckout(context.userId, sessionId);
    if (result.entitled) return destination("/c?billing=success");
    return destination(`/subscribe?billing=${result.paid ? "processing" : "payment_required"}`);
  } catch {
    return destination("/subscribe?billing=verification_failed");
  }
}
