import "server-only";

import { cache } from "react";
import Stripe from "stripe";
import { configuredSiteUrl } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  BILLING_POLICY_VERSION,
  COACH_CHECKOUT_DISCLOSURE,
  hasExplicitLegalConfiguration,
  STANDARD_CHECKOUT_DISCLOSURE,
  TERMS_VERSION,
} from "@/lib/legal";
import {
  coachBillingAccess,
  isCoachSubscriptionStatus,
  type CoachBillingAccess,
  type CoachBillingRecord,
  type CoachSubscriptionStatus,
} from "@/lib/coach-billing-state";

const COACH_PRICE_CENTS = 9_900;
const FIRST_SEASON_DISCOUNT_CENTS = 5_000;
const FIRST_SEASON_TOTAL_CENTS = COACH_PRICE_CENTS - FIRST_SEASON_DISCOUNT_CENTS;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CHECKOUT_SESSION_ID = /^cs_(?:test_|live_)?[A-Za-z0-9_]{8,240}$/;

export type CoachCheckoutOffer = "first_annual_term" | "annual_renewal";

export function coachCheckoutDisclosure(offer: CoachCheckoutOffer): string {
  const offerTerms = offer === "first_annual_term"
    ? COACH_CHECKOUT_DISCLOSURE
    : STANDARD_CHECKOUT_DISCLOSURE;
  return `${offerTerms} Cancel online at any time; cancellation takes effect at the end of the current paid term.`;
}

export function coachCheckoutConsentStatement(offer: CoachCheckoutOffer): string {
  return offer === "first_annual_term"
    ? "I expressly agree to the automatic-renewal terms above and authorize SwimAhead to charge $49 USD plus applicable taxes today and $99 USD plus applicable taxes every 12 months thereafter unless I cancel."
    : "I expressly agree to the automatic-renewal terms above and authorize SwimAhead to charge $99 USD plus applicable taxes today and every 12 months thereafter unless I cancel.";
}

type AdminClient = ReturnType<typeof createAdminClient>;

type CoachBillingRow = {
  user_id: string;
  access_kind: "subscription" | "lifetime";
  subscription_status: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  price_verified: boolean;
  purchase_consent_verified: boolean;
  latest_invoice_id: string | null;
  latest_invoice_paid: boolean;
  subscription_conflict: boolean;
  payment_reversed: boolean;
  payment_reversal_reason: "refunded" | "disputed" | null;
  first_season_redeemed_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  cancel_at: string | null;
};

type CheckoutConfig = {
  secretKey: string;
  priceId: string;
  firstSeasonCouponId: string;
  siteUrl: string;
  automaticTaxEnabled: boolean;
};

export type CoachCheckoutResult = {
  destination: string;
  kind: "checkout" | "workspace";
};

export type CoachCheckoutReconciliation = {
  paid: boolean;
  entitled: boolean;
};

export type FreshCoachBillingAccess = {
  access: CoachBillingAccess;
  stripeStatusVerified: boolean;
};

export type CoachBillingErrorCode =
  | "configuration"
  | "catalog"
  | "customer"
  | "not_available"
  | "payment_required"
  | "request_invalid";

export class CoachBillingError extends Error {
  constructor(
    public readonly code: CoachBillingErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CoachBillingError";
  }
}

let stripeClient: Stripe | null = null;
let stripeClientKey: string | null = null;

function envValue(name: string): string | null {
  const value = process.env[name]?.trim();
  return value || null;
}

function envFlag(name: string): boolean {
  return envValue(name)?.toLowerCase() === "true";
}

function requireStripeSecret(): string {
  const secretKey = envValue("STRIPE_SECRET_KEY");
  if (!secretKey) {
    throw new CoachBillingError("configuration", "Stripe billing is not configured.");
  }
  return secretKey;
}

function stripe(): Stripe {
  const secretKey = requireStripeSecret();
  if (!stripeClient || stripeClientKey !== secretKey) {
    stripeClient = new Stripe(secretKey, {
      appInfo: { name: "SwimAhead coach billing", version: "1.0.0" },
      maxNetworkRetries: 2,
    });
    stripeClientKey = secretKey;
  }
  return stripeClient;
}

function requireCheckoutConfig(): CheckoutConfig {
  const priceId = envValue("STRIPE_COACH_PRICE_ID");
  const firstSeasonCouponId = envValue("STRIPE_FIRST_SEASON_COUPON_ID");
  const siteUrl = configuredSiteUrl();
  const productionLaunchReady = process.env.NODE_ENV !== "production" || (
    hasExplicitLegalConfiguration() && envFlag("STRIPE_BILLING_ACKNOWLEDGMENT_CONFIRMED")
  );
  if (!priceId || !firstSeasonCouponId || !siteUrl || !envValue("STRIPE_WEBHOOK_SECRET") || !productionLaunchReady) {
    throw new CoachBillingError("configuration", "Coach checkout is not configured.");
  }
  return {
    secretKey: requireStripeSecret(),
    priceId,
    firstSeasonCouponId,
    siteUrl,
    automaticTaxEnabled: envFlag("STRIPE_AUTOMATIC_TAX_ENABLED"),
  };
}

export function isCoachCheckoutConfigured(): boolean {
  const productionLaunchReady = process.env.NODE_ENV !== "production" || (
    hasExplicitLegalConfiguration() && envFlag("STRIPE_BILLING_ACKNOWLEDGMENT_CONFIRMED")
  );
  return Boolean(
    envValue("STRIPE_SECRET_KEY") &&
    envValue("STRIPE_COACH_PRICE_ID") &&
    envValue("STRIPE_FIRST_SEASON_COUPON_ID") &&
    envValue("STRIPE_WEBHOOK_SECRET") &&
    configuredSiteUrl() &&
    productionLaunchReady,
  );
}

export function expectedCoachPriceId(): string | null {
  return envValue("STRIPE_COACH_PRICE_ID");
}

function recordFromRow(row: CoachBillingRow): CoachBillingRecord {
  return {
    userId: row.user_id,
    accessKind: row.access_kind,
    subscriptionStatus: isCoachSubscriptionStatus(row.subscription_status)
      ? row.subscription_status
      : null,
    stripeCustomerId: row.stripe_customer_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    stripePriceId: row.stripe_price_id,
    priceVerified: row.price_verified,
    purchaseConsentVerified: row.purchase_consent_verified,
    latestInvoiceId: row.latest_invoice_id,
    latestInvoicePaid: row.latest_invoice_paid,
    subscriptionConflict: row.subscription_conflict,
    paymentReversed: row.payment_reversed,
    paymentReversalReason: row.payment_reversal_reason,
    firstSeasonRedeemedAt: row.first_season_redeemed_at,
    currentPeriodStart: row.current_period_start,
    currentPeriodEnd: row.current_period_end,
    cancelAtPeriodEnd: row.cancel_at_period_end,
    cancelAt: row.cancel_at,
  };
}

async function billingRecord(admin: AdminClient, userId: string): Promise<CoachBillingRecord | null> {
  const { data, error } = await admin
    .from("coach_billing_accounts")
    .select(
      "user_id,access_kind,subscription_status,stripe_customer_id,stripe_subscription_id,stripe_price_id,price_verified,purchase_consent_verified,latest_invoice_id,latest_invoice_paid,subscription_conflict,payment_reversed,payment_reversal_reason,first_season_redeemed_at,current_period_start,current_period_end,cancel_at_period_end,cancel_at",
    )
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data ? recordFromRow(data as CoachBillingRow) : null;
}

async function assertCoachAccount(admin: AdminClient, userId: string): Promise<void> {
  const { data, error } = await admin
    .from("accounts")
    .select("user_id")
    .eq("user_id", userId)
    .eq("account_type", "coach")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new CoachBillingError("not_available", "A coach account is required.");
}

async function ensureBillingRecord(admin: AdminClient, userId: string): Promise<CoachBillingRecord> {
  const existing = await billingRecord(admin, userId);
  if (existing) return existing;

  await assertCoachAccount(admin, userId);
  const { error } = await admin
    .from("coach_billing_accounts")
    .insert({
      user_id: userId,
      access_kind: "subscription",
      subscription_status: null,
    });
  if (error && error.code !== "23505") throw error;

  const created = await billingRecord(admin, userId);
  if (!created) throw new CoachBillingError("not_available", "Coach billing could not be initialized.");
  return created;
}

export const getCoachBillingAccess = cache(async (userId: string): Promise<CoachBillingAccess> => {
  const record = await billingRecord(createAdminClient(), userId);
  return coachBillingAccess(record, expectedCoachPriceId());
});

function safeStripeRefreshError(error: unknown): Record<string, string | number> {
  if (!error || typeof error !== "object") return { name: "UnknownError" };
  const value = error as { name?: unknown; code?: unknown; statusCode?: unknown };
  return {
    name: typeof value.name === "string" ? value.name : "Error",
    ...(typeof value.code === "string" ? { code: value.code } : {}),
    ...(typeof value.statusCode === "number" ? { statusCode: value.statusCode } : {}),
  };
}

export async function getFreshCoachBillingAccess(userId: string): Promise<FreshCoachBillingAccess> {
  const admin = createAdminClient();
  const stored = await billingRecord(admin, userId);
  const storedAccess = coachBillingAccess(stored, expectedCoachPriceId());

  if (!stored || stored.accessKind === "lifetime") {
    return { access: storedAccess, stripeStatusVerified: true };
  }
  if (!stored.stripeSubscriptionId) {
    return {
      access: storedAccess,
      stripeStatusVerified: stored.subscriptionStatus !== "active",
    };
  }

  try {
    const subscription = await stripe().subscriptions.retrieve(stored.stripeSubscriptionId, {
      expand: ["latest_invoice"],
    });
    const subscriptionUserId = await billingUserIdForSubscription(admin, subscription);
    if (subscriptionUserId !== userId) {
      throw new CoachBillingError("request_invalid", "The Stripe subscription does not belong to this coach.");
    }
    await syncCoachSubscriptionState(subscription, false);
    const refreshed = await billingRecord(admin, userId);
    return {
      access: coachBillingAccess(refreshed, expectedCoachPriceId()),
      stripeStatusVerified: true,
    };
  } catch (error) {
    console.error("Coach billing status refresh failed", safeStripeRefreshError(error));
    return { access: storedAccess, stripeStatusVerified: false };
  }
}

async function validateCatalog(client: Stripe, config: CheckoutConfig): Promise<void> {
  const [price, coupon] = await Promise.all([
    client.prices.retrieve(config.priceId),
    client.coupons.retrieve(config.firstSeasonCouponId),
  ]);

  const validPrice = price.active &&
    price.currency === "usd" &&
    price.unit_amount === COACH_PRICE_CENTS &&
    price.recurring?.interval === "year" &&
    price.recurring.interval_count === 1;
  const couponDeleted = "deleted" in coupon && coupon.deleted;
  const validCoupon = !couponDeleted &&
    coupon.valid &&
    coupon.currency === "usd" &&
    coupon.amount_off === FIRST_SEASON_DISCOUNT_CENTS &&
    coupon.duration === "once";

  if (!validPrice || !validCoupon) {
    throw new CoachBillingError(
      "catalog",
      "The coach price must be $99 USD yearly and the first-season coupon must be $50 USD off once.",
    );
  }
}

async function stripeCustomerId(
  admin: AdminClient,
  record: CoachBillingRecord,
  input: { email: string; displayName: string },
): Promise<string> {
  const predecessorCustomerId = record.stripeCustomerId;
  if (predecessorCustomerId) {
    const existing = await stripe().customers.retrieve(predecessorCustomerId);
    const deleted = "deleted" in existing && existing.deleted;
    if (!deleted) return existing.id;
  }

  const customer = await stripe().customers.create(
    {
      email: input.email || undefined,
      name: input.displayName || undefined,
      metadata: {
        swimahead_billing: "coach",
        swimahead_user_id: record.userId,
      },
    },
    {
      idempotencyKey: `coach-customer-v2-${record.userId}-${predecessorCustomerId ?? "initial"}`,
    },
  );
  const { error } = await admin
    .from("coach_billing_accounts")
    .update({ stripe_customer_id: customer.id })
    .eq("user_id", record.userId);
  if (error) throw error;
  return customer.id;
}

function checkoutAttemptKey(
  record: CoachBillingRecord,
  customerId: string,
  offer: CoachCheckoutOffer,
  predecessorSessionId?: string,
): string {
  const predecessor = predecessorSessionId?.replace(/[^A-Za-z0-9_-]/g, "") || "initial";
  const policy = `${TERMS_VERSION}-${BILLING_POLICY_VERSION}`.replace(/[^A-Za-z0-9_-]/g, "");
  return `coach-checkout-v4-${policy}-${offer}-${record.userId}-${customerId}-${predecessor}`;
}

function isNonterminalCoachSubscription(subscription: Stripe.Subscription): boolean {
  return subscription.metadata.swimahead_billing === "coach" &&
    subscription.status !== "canceled" &&
    subscription.status !== "incomplete_expired";
}

async function listNonterminalCoachSubscriptions(
  client: Stripe,
  customerId: string,
): Promise<{ subscriptions: Stripe.Subscription[]; hasMore: boolean }> {
  const statuses = ["active", "trialing", "past_due", "unpaid", "paused", "incomplete"] as const;
  const results = await Promise.all(statuses.map((status) => client.subscriptions.list({
    customer: customerId,
    status,
    limit: 100,
    expand: ["data.latest_invoice"],
  })));
  return {
    subscriptions: results.flatMap((result) => result.data).filter(isNonterminalCoachSubscription),
    hasMore: results.some((result) => result.has_more),
  };
}

function checkoutAmountBeforeTax(session: Stripe.Checkout.Session): number | null {
  if (session.amount_total == null) return null;
  return session.amount_total - (session.total_details?.amount_tax ?? 0);
}

function checkoutSessionMatches(input: {
  session: Stripe.Checkout.Session;
  userId: string;
  customerId: string;
  offer: CoachCheckoutOffer;
  expectedSubtotal: number;
}): boolean {
  const { session } = input;
  return session.status === "open" &&
    Boolean(session.url) &&
    session.mode === "subscription" &&
    session.client_reference_id === input.userId &&
    stripeId(session.customer) === input.customerId &&
    session.currency === "usd" &&
    checkoutAmountBeforeTax(session) === input.expectedSubtotal &&
    session.metadata?.swimahead_billing === "coach" &&
    session.metadata.swimahead_user_id === input.userId &&
    session.metadata.swimahead_offer === input.offer &&
    session.metadata.swimahead_terms_version === TERMS_VERSION &&
    session.metadata.swimahead_billing_policy_version === BILLING_POLICY_VERSION;
}

async function matchingConsentRecord(
  admin: AdminClient,
  input: {
    sessionId: string;
    userId: string;
    offer: CoachCheckoutOffer;
    expectedSubtotal: number;
    disclosure: string;
  },
): Promise<boolean> {
  const existing = await admin
    .from("coach_subscription_consents")
    .select("user_id,offer_kind,currency,subtotal_due_now,renewal_amount,renewal_interval,terms_version,billing_policy_version,disclosure_text,consent_statement_text")
    .eq("stripe_checkout_session_id", input.sessionId)
    .maybeSingle();
  return !existing.error &&
    existing.data?.user_id === input.userId &&
    existing.data.offer_kind === input.offer &&
    existing.data.currency === "usd" &&
    existing.data.subtotal_due_now === input.expectedSubtotal &&
    existing.data.renewal_amount === COACH_PRICE_CENTS &&
    existing.data.renewal_interval === "year" &&
    existing.data.terms_version === TERMS_VERSION &&
    existing.data.billing_policy_version === BILLING_POLICY_VERSION &&
    existing.data.disclosure_text === input.disclosure &&
    existing.data.consent_statement_text === coachCheckoutConsentStatement(input.offer);
}

async function recordPrecheckoutConsent(
  admin: AdminClient,
  input: {
    sessionId: string;
    userId: string;
    offer: CoachCheckoutOffer;
    expectedSubtotal: number;
    disclosure: string;
  },
): Promise<void> {
  const { error } = await admin
    .from("coach_subscription_consents")
    .insert({
      user_id: input.userId,
      stripe_checkout_session_id: input.sessionId,
      offer_kind: input.offer,
      currency: "usd",
      subtotal_due_now: input.expectedSubtotal,
      renewal_amount: COACH_PRICE_CENTS,
      renewal_interval: "year",
      terms_version: TERMS_VERSION,
      billing_policy_version: BILLING_POLICY_VERSION,
      disclosure_text: input.disclosure,
      consent_statement_text: coachCheckoutConsentStatement(input.offer),
      affirmative_consent_at: new Date().toISOString(),
    });
  if (error?.code !== "23505" && error) throw error;
  if (error?.code === "23505" && !await matchingConsentRecord(admin, input)) {
    throw new CoachBillingError("not_available", "The billing consent could not be verified.");
  }
}

export async function createCoachCheckout(input: {
  userId: string;
  email: string;
  displayName: string;
  offer: CoachCheckoutOffer;
  affirmativeConsent: true;
}): Promise<CoachCheckoutResult> {
  const config = requireCheckoutConfig();
  const client = stripe();
  const admin = createAdminClient();
  const record = await ensureBillingRecord(admin, input.userId);
  const access = coachBillingAccess(record, config.priceId);
  if (access.entitled) {
    return { destination: `${config.siteUrl}/c`, kind: "workspace" };
  }

  await validateCatalog(client, config);
  const customer = await stripeCustomerId(admin, record, input);

  const currentSubscriptions = await listNonterminalCoachSubscriptions(client, customer);
  if (currentSubscriptions.hasMore || currentSubscriptions.subscriptions.length > 0) {
    if (currentSubscriptions.subscriptions[0]) {
      await syncCoachSubscription(currentSubscriptions.subscriptions[0]);
    }
    const refreshed = await billingRecord(admin, input.userId);
    if (coachBillingAccess(refreshed, config.priceId).entitled) {
      return { destination: `${config.siteUrl}/c`, kind: "workspace" };
    }
    throw new CoachBillingError(
      "payment_required",
      "An existing coach subscription must be resolved before starting another checkout.",
    );
  }

  const firstSeason = access.firstSeasonEligible;
  const offer: CoachCheckoutOffer = firstSeason ? "first_annual_term" : "annual_renewal";
  if (!input.affirmativeConsent || input.offer !== offer) {
    throw new CoachBillingError("request_invalid", "The billing offer changed. Review it and agree again.");
  }
  const expectedTotal = firstSeason ? FIRST_SEASON_TOTAL_CENTS : COACH_PRICE_CENTS;
  const disclosure = coachCheckoutDisclosure(offer);
  const metadata = {
    swimahead_billing: "coach",
    swimahead_user_id: input.userId,
    swimahead_first_season: firstSeason ? "true" : "false",
    swimahead_offer: offer,
    swimahead_terms_version: TERMS_VERSION,
    swimahead_billing_policy_version: BILLING_POLICY_VERSION,
  };

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    customer,
    client_reference_id: input.userId,
    line_items: [{ price: config.priceId, quantity: 1 }],
    discounts: firstSeason ? [{ coupon: config.firstSeasonCouponId }] : undefined,
    payment_method_types: ["card"],
    payment_method_collection: "always",
    billing_address_collection: "required",
    customer_update: { address: "auto", name: "auto" },
    automatic_tax: config.automaticTaxEnabled ? { enabled: true } : undefined,
    consent_collection: { terms_of_service: "required" },
    custom_text: { submit: { message: disclosure } },
    metadata,
    subscription_data: { metadata },
    success_url: `${config.siteUrl}/api/billing/checkout/complete?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${config.siteUrl}/subscribe?billing=cancelled`,
  };
  const evidence = {
    userId: input.userId,
    offer,
    expectedSubtotal: expectedTotal,
    disclosure,
  };

  const openSessions = await client.checkout.sessions.list({
    customer,
    status: "open",
    limit: 100,
  });
  for (const openSession of openSessions.data) {
    if (
      openSession.metadata?.swimahead_billing !== "coach" ||
      openSession.metadata.swimahead_user_id !== input.userId
    ) continue;
    if (checkoutSessionMatches({
      session: openSession,
      userId: input.userId,
      customerId: customer,
      offer,
      expectedSubtotal: expectedTotal,
    })) {
      try {
        await recordPrecheckoutConsent(admin, { sessionId: openSession.id, ...evidence });
      } catch (error) {
        await client.checkout.sessions.expire(openSession.id);
        throw error;
      }
      return { destination: openSession.url!, kind: "checkout" };
    }
    await client.checkout.sessions.expire(openSession.id);
  }
  if (openSessions.has_more) {
    throw new CoachBillingError("not_available", "Too many open coach checkouts require support review.");
  }

  const expiredSessions = await client.checkout.sessions.list({
    customer,
    status: "expired",
    limit: 100,
  });
  const newestExpiredSession = expiredSessions.data
    .filter((session) => {
      return session.metadata?.swimahead_billing === "coach" &&
      session.metadata.swimahead_user_id === input.userId &&
      session.metadata.swimahead_offer === offer &&
      session.metadata.swimahead_terms_version === TERMS_VERSION &&
      session.metadata.swimahead_billing_policy_version === BILLING_POLICY_VERSION;
    })
    .sort((left, right) => right.created - left.created)[0];

  let predecessorSessionId = newestExpiredSession?.id;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const session = await client.checkout.sessions.create(
      sessionParams,
      { idempotencyKey: checkoutAttemptKey(record, customer, offer, predecessorSessionId) },
    );
    if (checkoutSessionMatches({
      session,
      userId: input.userId,
      customerId: customer,
      offer,
      expectedSubtotal: expectedTotal,
    })) {
      try {
        await recordPrecheckoutConsent(admin, { sessionId: session.id, ...evidence });
      } catch (error) {
        await client.checkout.sessions.expire(session.id);
        throw error;
      }
      return { destination: session.url!, kind: "checkout" };
    }

    if (session.status === "complete" && session.payment_status === "paid") {
      if (!await matchingConsentRecord(admin, { sessionId: session.id, ...evidence })) {
        throw new CoachBillingError("not_available", "The completed checkout has no matching prior consent.");
      }
      const subscription = await subscriptionFromSession(session);
      if (subscription && subscription.status === "active") {
        await recordAcceptedCheckout(session, input.userId, subscription.id);
        await syncCoachSubscription(subscription);
        const completedAccess = await getCoachBillingAccess(input.userId);
        if (completedAccess.entitled) {
          return { destination: `${config.siteUrl}/c`, kind: "workspace" };
        }
      }
      throw new CoachBillingError("payment_required", "The existing checkout is still being reconciled.");
    }

    if (session.status === "open") await client.checkout.sessions.expire(session.id);
    predecessorSessionId = session.id;
  }

  throw new CoachBillingError("not_available", "Stripe could not create a usable coach checkout.");
}

function stripeId(value: string | { id: string } | null): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

function periodIso(value: number | null | undefined): string | null {
  if (!value || !Number.isFinite(value)) return null;
  return new Date(value * 1_000).toISOString();
}

async function latestInvoiceState(
  subscription: Stripe.Subscription,
): Promise<{ id: string | null; paid: boolean }> {
  if (!subscription.latest_invoice) return { id: null, paid: false };
  const invoice = typeof subscription.latest_invoice === "string"
    ? await stripe().invoices.retrieve(subscription.latest_invoice)
    : subscription.latest_invoice;
  return { id: invoice.id, paid: invoice.status === "paid" };
}

async function billingUserIdForSubscription(
  admin: AdminClient,
  subscription: Stripe.Subscription,
): Promise<string | null> {
  const metadataUserId = subscription.metadata.swimahead_user_id;
  if (metadataUserId && UUID.test(metadataUserId)) return metadataUserId;

  const customerId = stripeId(subscription.customer);
  const bySubscription = await admin
    .from("coach_billing_accounts")
    .select("user_id")
    .eq("stripe_subscription_id", subscription.id)
    .maybeSingle();
  if (bySubscription.error) throw bySubscription.error;
  if (bySubscription.data?.user_id) return String(bySubscription.data.user_id);
  if (!customerId) return null;

  const byCustomer = await admin
    .from("coach_billing_accounts")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  if (byCustomer.error) throw byCustomer.error;
  return byCustomer.data?.user_id ? String(byCustomer.data.user_id) : null;
}

async function hasVerifiedPurchaseConsent(
  admin: AdminClient,
  userId: string,
  subscriptionId: string,
): Promise<boolean> {
  const { data, error } = await admin
    .from("coach_subscription_consents")
    .select("id")
    .eq("user_id", userId)
    .eq("stripe_subscription_id", subscriptionId)
    .not("stripe_terms_accepted_at", "is", null)
    .not("checkout_completed_at", "is", null)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function syncCoachSubscription(subscription: Stripe.Subscription): Promise<void> {
  await syncCoachSubscriptionState(subscription, true);
}

async function syncCoachSubscriptionState(
  subscription: Stripe.Subscription,
  verifyCustomerSubscriptions: boolean,
): Promise<void> {
  if (subscription.metadata.swimahead_billing !== "coach") return;

  const admin = createAdminClient();
  const userId = await billingUserIdForSubscription(admin, subscription);
  if (!userId) return;
  await assertCoachAccount(admin, userId);

  const existing = await ensureBillingRecord(admin, userId);
  const customerId = stripeId(subscription.customer);
  if (customerId && verifyCustomerSubscriptions) {
    const current = await listNonterminalCoachSubscriptions(stripe(), customerId);
    if (current.hasMore || current.subscriptions.length > 1) {
      const { error } = await admin
        .from("coach_billing_accounts")
        .update({
          stripe_customer_id: customerId,
          subscription_conflict: true,
        })
        .eq("user_id", userId);
      if (error) throw error;
      return;
    }

    const soleCurrent = current.subscriptions[0];
    if (soleCurrent && soleCurrent.id !== subscription.id) {
      await syncCoachSubscription(soleCurrent);
      return;
    }

    if (
      !soleCurrent &&
      existing.stripeSubscriptionId &&
      existing.stripeSubscriptionId !== subscription.id
    ) {
      const storedSubscription = await stripe().subscriptions.retrieve(
        existing.stripeSubscriptionId,
        { expand: ["latest_invoice"] },
      );
      await syncCoachSubscription(storedSubscription);
      return;
    }
  }

  const expectedPrice = expectedCoachPriceId();
  const item = subscription.items.data.find((candidate) => candidate.price.id === expectedPrice) ??
    subscription.items.data[0];
  const status: CoachSubscriptionStatus = isCoachSubscriptionStatus(subscription.status)
    ? subscription.status
    : "incomplete";
  const invoice = await latestInvoiceState(subscription);
  const purchaseConsentVerified = await hasVerifiedPurchaseConsent(admin, userId, subscription.id);
  const laterPaidInvoice = Boolean(
    invoice.paid &&
    invoice.id &&
    invoice.id !== existing.latestInvoiceId,
  );
  const firstSeasonPaid = status === "active" &&
    invoice.paid &&
    purchaseConsentVerified &&
    subscription.metadata.swimahead_first_season === "true";
  const update = {
    subscription_status: status,
    stripe_customer_id: stripeId(subscription.customer),
    stripe_subscription_id: subscription.id,
    stripe_price_id: item?.price.id ?? null,
    price_verified: Boolean(expectedPrice && item?.price.id === expectedPrice),
    purchase_consent_verified: purchaseConsentVerified,
    latest_invoice_id: invoice.id,
    latest_invoice_paid: invoice.paid,
    subscription_conflict: verifyCustomerSubscriptions ? false : existing.subscriptionConflict,
    payment_reversed: laterPaidInvoice ? false : existing.paymentReversed,
    payment_reversal_reason: laterPaidInvoice ? null : existing.paymentReversalReason,
    current_period_start: periodIso(item?.current_period_start),
    current_period_end: periodIso(item?.current_period_end),
    cancel_at_period_end: subscription.cancel_at_period_end,
    cancel_at: periodIso(subscription.cancel_at),
    first_season_redeemed_at: existing.firstSeasonRedeemedAt ??
      (firstSeasonPaid ? new Date().toISOString() : null),
  };
  const { error } = await admin
    .from("coach_billing_accounts")
    .update(update)
    .eq("user_id", userId);
  if (error) throw error;
}

async function subscriptionFromSession(session: Stripe.Checkout.Session): Promise<Stripe.Subscription | null> {
  if (!session.subscription) return null;
  if (typeof session.subscription !== "string") return session.subscription;
  return stripe().subscriptions.retrieve(session.subscription, { expand: ["latest_invoice"] });
}

async function recordAcceptedCheckout(
  session: Stripe.Checkout.Session,
  userId: string,
  subscriptionId: string,
): Promise<void> {
  if (session.consent?.terms_of_service !== "accepted") {
    throw new CoachBillingError("request_invalid", "The Terms were not accepted in Checkout.");
  }
  const acceptedAt = new Date().toISOString();
  const amountTax = session.total_details?.amount_tax ?? 0;
  const amountTotal = session.amount_total;
  const amountBeforeTax = amountTotal == null ? null : amountTotal - amountTax;
  if (
    session.currency !== "usd" ||
    amountTotal == null ||
    (amountBeforeTax !== FIRST_SEASON_TOTAL_CENTS && amountBeforeTax !== COACH_PRICE_CENTS)
  ) {
    throw new CoachBillingError("catalog", "The completed coach checkout amount is invalid.");
  }
  const admin = createAdminClient();
  const { data, error } = await admin
    .rpc("record_coach_checkout_completion", {
      p_checkout_session_id: session.id,
      p_user_id: userId,
      p_subscription_id: subscriptionId,
      p_stripe_terms_accepted_at: acceptedAt,
      p_checkout_completed_at: acceptedAt,
      p_amount_before_tax: amountBeforeTax,
      p_amount_tax: amountTax,
      p_amount_total: amountTotal,
    });
  if (error) throw error;
  if (!data) {
    throw new CoachBillingError("request_invalid", "The billing consent record is missing.");
  }
}

function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  return stripeId(invoice.parent?.subscription_details?.subscription ?? null);
}

async function syncInvoiceEvent(invoice: Stripe.Invoice): Promise<void> {
  const subscriptionId = invoiceSubscriptionId(invoice);
  if (!subscriptionId) return;
  const subscription = await stripe().subscriptions.retrieve(subscriptionId, {
    expand: ["latest_invoice"],
  });
  await syncCoachSubscription(subscription);
}

async function invoiceIdForCharge(charge: Stripe.Charge): Promise<string | null> {
  const paymentIntentId = stripeId(charge.payment_intent);
  if (!paymentIntentId) return null;
  const payments = await stripe().invoicePayments.list({
    payment: { type: "payment_intent", payment_intent: paymentIntentId },
    limit: 10,
  });
  const payment = payments.data.find((candidate) => {
    return stripeId(candidate.payment.payment_intent ?? null) === paymentIntentId;
  });
  return payment ? stripeId(payment.invoice) : null;
}

async function setChargeReversalState(
  charge: Stripe.Charge,
  reversed: boolean,
  reason: "refunded" | "disputed" | null,
): Promise<void> {
  const invoiceId = await invoiceIdForCharge(charge);
  if (!invoiceId) return;
  const invoice = await stripe().invoices.retrieve(invoiceId);
  const subscriptionId = invoiceSubscriptionId(invoice);
  if (!subscriptionId) return;
  const subscription = await stripe().subscriptions.retrieve(subscriptionId, {
    expand: ["latest_invoice"],
  });
  if (subscription.metadata.swimahead_billing !== "coach") return;

  await syncCoachSubscription(subscription);
  if (stripeId(subscription.latest_invoice) !== invoiceId) return;

  const { data, error } = await createAdminClient()
    .from("coach_billing_accounts")
    .update({
      payment_reversed: reversed,
      payment_reversal_reason: reversed ? reason : null,
    })
    .eq("latest_invoice_id", invoiceId)
    .eq("stripe_subscription_id", subscriptionId)
    .select("user_id");
  if (error) throw error;
  if (!data || data.length !== 1) {
    throw new CoachBillingError("not_available", "The reversed coach payment could not be recorded.");
  }
}

async function syncDisputeEvent(dispute: Stripe.Dispute): Promise<void> {
  const currentDispute = await stripe().disputes.retrieve(dispute.id);
  const chargeId = stripeId(currentDispute.charge);
  if (!chargeId) return;
  const charge = await stripe().charges.retrieve(chargeId);
  const disputeStillReversesPayment = currentDispute.status !== "won" &&
    currentDispute.status !== "warning_closed" &&
    currentDispute.status !== "prevented";
  const fullyRefunded = charge.refunded || charge.amount_refunded >= charge.amount;
  await setChargeReversalState(
    charge,
    disputeStillReversesPayment || fullyRefunded,
    fullyRefunded ? "refunded" : disputeStillReversesPayment ? "disputed" : null,
  );
}

async function syncRefundedChargeEvent(charge: Stripe.Charge): Promise<void> {
  const currentCharge = await stripe().charges.retrieve(charge.id);
  if (!currentCharge.refunded && currentCharge.amount_refunded < currentCharge.amount) return;
  await setChargeReversalState(currentCharge, true, "refunded");
}

export async function reconcileCoachCheckout(
  userId: string,
  sessionId: string,
): Promise<CoachCheckoutReconciliation> {
  if (!CHECKOUT_SESSION_ID.test(sessionId)) {
    throw new CoachBillingError("request_invalid", "The checkout session is invalid.");
  }
  const session = await stripe().checkout.sessions.retrieve(sessionId, {
    expand: ["subscription.latest_invoice"],
  });
  const belongsToUser = session.mode === "subscription" &&
    session.client_reference_id === userId &&
    session.metadata?.swimahead_billing === "coach" &&
    session.metadata.swimahead_user_id === userId;
  if (!belongsToUser) {
    throw new CoachBillingError("request_invalid", "The checkout session does not belong to this coach.");
  }
  if (session.payment_status !== "paid") return { paid: false, entitled: false };

  const subscription = await subscriptionFromSession(session);
  if (!subscription || subscription.status !== "active") {
    return { paid: true, entitled: false };
  }
  await recordAcceptedCheckout(session, userId, subscription.id);
  await syncCoachSubscription(subscription);
  const access = await getCoachBillingAccess(userId);
  return { paid: true, entitled: access.entitled };
}

export async function createCoachBillingPortal(userId: string): Promise<string> {
  const siteUrl = configuredSiteUrl();
  if (!siteUrl) throw new CoachBillingError("configuration", "The site URL is not configured.");
  const record = await billingRecord(createAdminClient(), userId);
  if (!record?.stripeCustomerId) {
    throw new CoachBillingError("customer", "This coach does not have a Stripe customer yet.");
  }
  const session = await stripe().billingPortal.sessions.create({
    customer: record.stripeCustomerId,
    return_url: `${siteUrl}/subscribe`,
  });
  return session.url;
}

function webhookSecret(): string {
  const value = envValue("STRIPE_WEBHOOK_SECRET");
  if (!value) throw new CoachBillingError("configuration", "The Stripe webhook is not configured.");
  return value;
}

export function constructCoachBillingEvent(rawBody: string, signature: string): Stripe.Event {
  if (!signature) throw new CoachBillingError("request_invalid", "The Stripe signature is missing.");
  return stripe().webhooks.constructEvent(rawBody, signature, webhookSecret());
}

async function alreadyProcessed(admin: AdminClient, eventId: string): Promise<boolean> {
  const { data, error } = await admin
    .from("stripe_webhook_events")
    .select("stripe_event_id")
    .eq("stripe_event_id", eventId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

async function recordProcessed(admin: AdminClient, event: Stripe.Event): Promise<void> {
  const { error } = await admin
    .from("stripe_webhook_events")
    .insert({
      stripe_event_id: event.id,
      event_type: event.type,
      livemode: event.livemode,
      event_created_at: new Date(event.created * 1_000).toISOString(),
    });
  if (error && error.code !== "23505") throw error;
}

async function syncCheckoutEvent(session: Stripe.Checkout.Session): Promise<void> {
  if (
    session.mode !== "subscription" ||
    session.payment_status !== "paid" ||
    session.metadata?.swimahead_billing !== "coach"
  ) {
    return;
  }
  const subscription = await subscriptionFromSession(session);
  const userId = session.metadata?.swimahead_user_id;
  if (!subscription || !userId || !UUID.test(userId)) return;
  await recordAcceptedCheckout(session, userId, subscription.id);
  await syncCoachSubscription(subscription);
}

export async function processCoachBillingEvent(event: Stripe.Event): Promise<void> {
  const admin = createAdminClient();
  if (await alreadyProcessed(admin, event.id)) return;

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      await syncCheckoutEvent(event.data.object);
      break;
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.paused":
    case "customer.subscription.resumed": {
      const current = await stripe().subscriptions.retrieve(event.data.object.id, {
        expand: ["latest_invoice"],
      });
      await syncCoachSubscription(current);
      break;
    }
    case "customer.subscription.deleted":
      await syncCoachSubscription(event.data.object);
      break;
    case "invoice.paid":
    case "invoice.payment_failed":
    case "invoice.payment_action_required":
    case "invoice.finalization_failed":
    case "invoice.marked_uncollectible":
    case "invoice.voided":
      await syncInvoiceEvent(event.data.object);
      break;
    case "charge.refunded":
      await syncRefundedChargeEvent(event.data.object);
      break;
    case "charge.dispute.created":
    case "charge.dispute.closed":
      await syncDisputeEvent(event.data.object);
      break;
    default:
      break;
  }

  await recordProcessed(admin, event);
}
