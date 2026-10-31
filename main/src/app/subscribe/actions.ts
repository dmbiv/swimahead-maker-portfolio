"use server";

import { redirect } from "next/navigation";
import { requireAccountType } from "@/lib/auth";
import {
  CoachBillingError,
  createCoachBillingPortal,
  createCoachCheckout,
  type CoachCheckoutOffer,
} from "@/lib/coach-billing";

function errorCode(error: unknown): string {
  if (!(error instanceof CoachBillingError)) return "unavailable";
  switch (error.code) {
    case "configuration":
      return "configuration";
    case "catalog":
      return "catalog";
    case "customer":
      return "customer";
    case "payment_required":
      return "payment_required";
    default:
      return "unavailable";
  }
}

function safeBillingErrorDetails(error: unknown): Record<string, string> {
  if (error instanceof CoachBillingError) {
    return { name: error.name, code: error.code, message: error.message };
  }
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }
  return { name: "UnknownError", message: "Unknown checkout failure" };
}

export async function startCoachCheckoutAction(formData: FormData): Promise<void> {
  const context = await requireAccountType("coach", "/subscribe");
  if (context.memberships.length === 0) redirect("/onboarding");
  const offerValue = formData.get("offer");
  const offer: CoachCheckoutOffer | null = offerValue === "first_annual_term" || offerValue === "annual_renewal"
    ? offerValue
    : null;
  if (!offer || formData.get("billingConsent") !== "accepted") {
    redirect("/subscribe?billing=consent_required");
  }
  let destination: string;
  try {
    const result = await createCoachCheckout({
      userId: context.userId,
      email: context.email,
      displayName: context.displayName,
      offer,
      affirmativeConsent: true,
    });
    destination = result.destination;
  } catch (error) {
    console.error("Coach checkout creation failed", safeBillingErrorDetails(error));
    redirect(`/subscribe?billing=${errorCode(error)}`);
  }
  redirect(destination);
}

export async function openCoachBillingPortalAction(): Promise<void> {
  const context = await requireAccountType("coach", "/subscribe");
  if (context.memberships.length === 0) redirect("/onboarding");
  let destination: string;
  try {
    destination = await createCoachBillingPortal(context.userId);
  } catch (error) {
    redirect(`/subscribe?billing=${errorCode(error)}`);
  }
  redirect(destination);
}
