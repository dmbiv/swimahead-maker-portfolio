import { NextResponse } from "next/server";
import {
  transactionalEmailEventRow,
  verifyEmailWebhook,
} from "@/lib/email/webhook";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_BODY_BYTES = 262_144;

export async function POST(request: Request) {
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large." }, { status: 413 });
  }

  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large." }, { status: 413 });
  }

  try {
    const verified = verifyEmailWebhook(rawBody, request.headers);
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("transactional_email_events")
      .upsert(transactionalEmailEventRow(verified), {
        onConflict: "webhook_event_id",
        ignoreDuplicates: true,
      });
    if (error) {
      return NextResponse.json({ error: "Event could not be stored." }, { status: 503 });
    }
    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ error: "Invalid webhook." }, { status: 400 });
  }
}
