import { NextResponse } from "next/server";
import { beginEmailConnection } from "@/lib/email/connections";
import { configuredSiteUrl } from "@/lib/env";
import { isEmailOAuthProvider } from "@/lib/email/oauth";

function settingsRedirect(code: string): NextResponse {
  const base = configuredSiteUrl();
  if (!base) {
    return NextResponse.json(
      { error: "Email connection is not configured." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  const destination = new URL(`/c/settings?mailbox=${encodeURIComponent(code)}`, base);
  return NextResponse.redirect(destination, {
    status: 303,
    headers: {
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ provider: string }> },
) {
  const { provider } = await context.params;
  if (!isEmailOAuthProvider(provider)) return settingsRedirect("provider_invalid");

  const siteUrl = configuredSiteUrl();
  const origin = request.headers.get("origin");
  if (!siteUrl || (origin && origin !== new URL(siteUrl).origin)) {
    return settingsRedirect("request_invalid");
  }

  try {
    const form = await request.formData();
    const workspaceId = String(form.get("workspaceId") ?? "");
    const redirectPath = String(form.get("redirectPath") ?? "/c/settings");
    const destination = await beginEmailConnection({ workspaceId, provider, redirectPath });
    return NextResponse.redirect(destination, {
      status: 303,
      headers: {
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch {
    return settingsRedirect("start_failed");
  }
}
