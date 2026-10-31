import { NextResponse } from "next/server";
import {
  completeEmailConnection,
  consumeEmailConnectionState,
} from "@/lib/email/connections";
import { configuredSiteUrl } from "@/lib/env";
import { isEmailOAuthProvider } from "@/lib/email/oauth";

function callbackRedirect(path: string, code: string): NextResponse {
  const base = configuredSiteUrl() ?? "http://localhost";
  const url = new URL(path, base);
  url.searchParams.set("mailbox", code);
  return NextResponse.redirect(url, {
    status: 303,
    headers: {
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ provider: string }> },
) {
  const { provider } = await context.params;
  if (!isEmailOAuthProvider(provider)) return callbackRedirect("/c/settings", "provider_invalid");
  const url = new URL(request.url);
  const state = url.searchParams.get("state") ?? "";

  try {
    const stateRow = await consumeEmailConnectionState({ provider, state });
    if (url.searchParams.has("error")) {
      return callbackRedirect(stateRow.redirect_path, "cancelled");
    }
    const result = await completeEmailConnection({
      provider,
      code: url.searchParams.get("code") ?? "",
      stateRow,
    });
    return callbackRedirect(result.redirectPath, "connected");
  } catch {
    return callbackRedirect("/c/settings", "callback_failed");
  }
}
