export const COACH_SUBSCRIPTION_STATUSES = [
  "incomplete",
  "incomplete_expired",
  "trialing",
  "active",
  "past_due",
  "canceled",
  "unpaid",
  "paused",
] as const;

export type CoachSubscriptionStatus = (typeof COACH_SUBSCRIPTION_STATUSES)[number];
export type CoachAccessKind = "subscription" | "lifetime";

export type CoachBillingRecord = {
  userId: string;
  accessKind: CoachAccessKind;
  subscriptionStatus: CoachSubscriptionStatus | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
  priceVerified: boolean;
  purchaseConsentVerified: boolean;
  latestInvoiceId: string | null;
  latestInvoicePaid: boolean;
  subscriptionConflict: boolean;
  paymentReversed: boolean;
  paymentReversalReason: "refunded" | "disputed" | null;
  firstSeasonRedeemedAt: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  cancelAt: string | null;
};

export type CoachBillingAccess = {
  record: CoachBillingRecord | null;
  entitled: boolean;
  firstSeasonEligible: boolean;
};

export type CoachCancellation = {
  scheduled: boolean;
  endsAt: string | null;
};

export function isCoachSubscriptionStatus(value: unknown): value is CoachSubscriptionStatus {
  return typeof value === "string" &&
    (COACH_SUBSCRIPTION_STATUSES as readonly string[]).includes(value);
}

export function hasCoachBillingAccess(
  record: CoachBillingRecord | null,
  expectedPriceId: string | null,
  now = new Date(),
): boolean {
  if (record?.accessKind === "lifetime") return true;
  if (!record || record.subscriptionStatus !== "active") return false;
  if (!record.priceVerified) return false;
  if (
    !record.purchaseConsentVerified ||
    !record.latestInvoicePaid ||
    record.subscriptionConflict ||
    record.paymentReversed
  ) return false;
  if (!expectedPriceId || record.stripePriceId !== expectedPriceId) return false;
  if (!record.currentPeriodEnd) return false;

  const periodEnd = new Date(record.currentPeriodEnd);
  return !Number.isNaN(periodEnd.valueOf()) && periodEnd > now;
}

function timestamp(value: string | null): number | null {
  if (!value) return null;
  const parsed = new Date(value).valueOf();
  return Number.isNaN(parsed) ? null : parsed;
}

export function coachCancellation(record: CoachBillingRecord | null): CoachCancellation {
  if (!record || record.accessKind === "lifetime") return { scheduled: false, endsAt: null };

  const scheduled = record.cancelAtPeriodEnd ||
    record.cancelAt !== null ||
    record.subscriptionStatus === "canceled";
  if (!scheduled) return { scheduled: false, endsAt: null };

  const candidates = [timestamp(record.cancelAt), timestamp(record.currentPeriodEnd)]
    .filter((value): value is number => value !== null);
  const endsAt = candidates.length > 0 ? new Date(Math.min(...candidates)).toISOString() : null;
  return { scheduled: true, endsAt };
}

export function isFirstSeasonEligible(record: CoachBillingRecord | null): boolean {
  return record?.accessKind !== "lifetime" && !record?.firstSeasonRedeemedAt;
}

export function coachBillingAccess(
  record: CoachBillingRecord | null,
  expectedPriceId: string | null,
  now = new Date(),
): CoachBillingAccess {
  return {
    record,
    entitled: hasCoachBillingAccess(record, expectedPriceId, now),
    firstSeasonEligible: isFirstSeasonEligible(record),
  };
}
