import { NextResponse } from "next/server";
import {
  constructCoachBillingEvent,
  processCoachBillingEvent,
} from "@/lib/coach-billing";

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

  let event;
  try {
    event = constructCoachBillingEvent(
      rawBody,
      request.headers.get("stripe-signature") ?? "",
    );
  } catch {
    return NextResponse.json(
      { error: "Invalid webhook." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    await processCoachBillingEvent(event);
    return NextResponse.json(
      { received: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const safeError = error instanceof Error
      ? { name: error.name, message: error.message.slice(0, 500) }
      : { name: "UnknownError", message: "Unknown webhook processing failure" };
    console.error("Stripe coach billing webhook failed", {
      eventId: event.id,
      eventType: event.type,
      error: safeError,
    });
    return NextResponse.json(
      { error: "Webhook processing failed." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
