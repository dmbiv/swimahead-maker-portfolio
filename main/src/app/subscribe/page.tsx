import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "@/components/app-link";
import { BrandLockup } from "@/components/shell";
import { Badge } from "@/components/ui";
import { signOutAction } from "@/app/auth/actions";
import { requireAccountType } from "@/lib/auth";
import {
  coachCheckoutConsentStatement,
  coachCheckoutDisclosure,
  getFreshCoachBillingAccess,
  isCoachCheckoutConfigured,
  type CoachCheckoutOffer,
} from "@/lib/coach-billing";
import { coachCancellation } from "@/lib/coach-billing-state";
import {
  openCoachBillingPortalAction,
} from "./actions";
import { CheckoutConsentForm } from "./checkout-consent-form";
import { LegalLinks } from "@/components/legal";

export const metadata: Metadata = {
  title: "Coach access",
  description: "Start or manage a SwimAhead coach season.",
};

const billingMessages: Record<string, { tone: "neutral" | "warn" | "bad"; text: string }> = {
  cancelled: { tone: "neutral", text: "Checkout was cancelled. You have not been charged." },
  processing: { tone: "warn", text: "Stripe received the payment, but access is still being confirmed. Refresh in a moment." },
  payment_required: { tone: "warn", text: "Payment was not completed, so coach access remains locked." },
  verification_failed: { tone: "bad", text: "We could not verify that checkout. No access was granted." },
  configuration: { tone: "bad", text: "Coach billing has not been fully configured on this deployment." },
  catalog: { tone: "bad", text: "Checkout is paused because the Stripe price does not match SwimAhead’s published price." },
  customer: { tone: "bad", text: "No Stripe billing profile is connected to this account yet." },
  unavailable: { tone: "bad", text: "Billing is temporarily unavailable. Please try again." },
  consent_required: { tone: "warn", text: "Review and accept the automatic-renewal terms before continuing." },
};

function dateLabel(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return null;
  return new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(date);
}

function PageFrame({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[var(--paper)] px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between gap-4">
          <BrandLockup href="/" />
          <form action={signOutAction}>
            <button type="submit" className="wr-btn wr-btn--ghost wr-btn--small">Sign out</button>
          </form>
        </div>
        <div className="mt-10">{children}</div>
        <LegalLinks className="mt-8 flex flex-wrap gap-x-5 gap-y-2 border-t border-line pt-5" />
      </div>
    </main>
  );
}

export default async function CoachSubscriptionPage({
  searchParams,
}: {
  searchParams: Promise<{ billing?: string }>;
}) {
  const context = await requireAccountType("coach", "/subscribe");
  if (context.memberships.length === 0) redirect("/onboarding");
  const [{ billing }, billingSnapshot] = await Promise.all([
    searchParams,
    getFreshCoachBillingAccess(context.userId),
  ]);
  const { access, stripeStatusVerified } = billingSnapshot;
  const message = billing ? billingMessages[billing] : null;
  const record = access.record;
  const periodEnd = dateLabel(record?.currentPeriodEnd ?? null);
  const cancellation = coachCancellation(record);

  if (record?.accessKind === "lifetime") {
    return (
      <PageFrame>
        <div className="wr-card p-6 sm:p-8">
          <Badge tone="good">Lifetime access</Badge>
          <h1 className="mt-4 text-3xl">You’re covered for life.</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-ink-2">
            Your founding coach account has complimentary access with no billing term, renewal, or Stripe subscription for the life of this account and Service. Access remains subject to the Terms of Service.
          </p>
          <div className="mt-6">
            <Link href="/c" className="wr-btn wr-btn--primary">Enter coach workspace</Link>
          </div>
        </div>
      </PageFrame>
    );
  }

  if (access.entitled) {
    const cancellationConfirmed = stripeStatusVerified && cancellation.scheduled;
    const accessEnd = dateLabel(cancellation.endsAt) ?? periodEnd;
    return (
      <PageFrame>
        <div className="wr-card p-6 sm:p-8">
          <Badge tone={cancellation.scheduled || !stripeStatusVerified ? "warn" : "good"}>
            {cancellationConfirmed
              ? "Cancellation scheduled"
              : stripeStatusVerified ? "Coach access active" : "Billing status needs confirmation"}
          </Badge>
          <h1 className="mt-4 text-3xl">
            {cancellation.scheduled ? "Your subscription will not renew." : "Your season is active."}
          </h1>
          <p className="mt-3 text-sm leading-6 text-ink-2">
            {!stripeStatusVerified
              ? "Coach access is active, but SwimAhead could not refresh the renewal or cancellation status from Stripe just now. Refresh this page or use Manage billing before relying on a renewal date."
              : cancellationConfirmed
              ? `Cancellation is confirmed and automatic renewal is off. Access continues through ${accessEnd ?? "the end of the paid season"}, then stops. You will not be charged another renewal unless you reactivate the subscription.`
              : `Your next $99 plus applicable tax renewal is ${periodEnd ? `on ${periodEnd}` : "at the end of this season"}.`}
          </p>
          {message ? <div className="mt-4"><Badge tone={message.tone}>{message.text}</Badge></div> : null}
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/c" className="wr-btn wr-btn--primary">Enter coach workspace</Link>
            {record?.stripeCustomerId ? (
              <form action={openCoachBillingPortalAction}>
                <button type="submit" className="wr-btn wr-btn--neutral">Manage billing</button>
              </form>
            ) : null}
          </div>
        </div>
      </PageFrame>
    );
  }

  const checkoutConfigured = isCoachCheckoutConfigured();
  const needsBillingRepair = record?.subscriptionConflict ||
    record?.subscriptionStatus === "active" ||
    record?.subscriptionStatus === "trialing" ||
    record?.subscriptionStatus === "incomplete" ||
    record?.subscriptionStatus === "past_due" ||
    record?.subscriptionStatus === "unpaid" ||
    record?.subscriptionStatus === "paused";
  const firstSeason = access.firstSeasonEligible;
  const offer: CoachCheckoutOffer = firstSeason ? "first_annual_term" : "annual_renewal";
  const price: 49 | 99 = firstSeason ? 49 : 99;

  return (
    <PageFrame>
      <div className="wr-card overflow-hidden">
        <div className="border-b border-line bg-[var(--sunken)] p-6 sm:p-8">
          <Badge tone="accent">Coach season</Badge>
          <h1 className="mt-4 text-3xl">Run recruiting from one workspace.</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-ink-2">
            Search and match recruits, manage your roster and recruiting board, send outreach, and collect questionnaires in SwimAhead.
          </p>
        </div>

        <div className="p-6 sm:p-8">
          {message ? <div className="mb-5"><Badge tone={message.tone}>{message.text}</Badge></div> : null}
          {stripeStatusVerified && record?.subscriptionStatus === "canceled" ? (
            <div className="mb-5 rounded-[var(--radius)] border border-line bg-[var(--sunken)] p-4">
              <Badge tone="neutral">Subscription canceled</Badge>
              <p className="mt-2 text-sm leading-6 text-ink-2">
                Your previous subscription is canceled and will not renew. Starting another season requires a new purchase below.
              </p>
            </div>
          ) : null}
          <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
            <span className="text-5xl font-semibold tracking-tight text-ink-1">${firstSeason ? "49" : "99"}</span>
            <span className="pb-1 text-sm text-ink-2">USD plus applicable tax for {firstSeason ? "your first 12 months" : "12 months"}. Charged today.</span>
          </div>
          <ul className="mt-6 grid gap-2 text-sm text-ink-2 sm:grid-cols-2">
            <li>Recruit search and smart matching</li>
            <li>Recruiting board and campaigns</li>
            <li>Roster needs and class planning</li>
            <li>Outreach and questionnaires</li>
          </ul>

          <div className="mt-7">
            {needsBillingRepair && record?.stripeCustomerId ? (
              <form action={openCoachBillingPortalAction}>
                <button type="submit" className="wr-btn wr-btn--primary">
                  {record.subscriptionConflict ? "Resolve subscriptions in Stripe" : "Fix payment in Stripe"}
                </button>
              </form>
            ) : (
              <CheckoutConsentForm
                offer={offer}
                price={price}
                disclosure={coachCheckoutDisclosure(offer)}
                consentStatement={coachCheckoutConsentStatement(offer)}
                disabled={!checkoutConfigured}
              />
            )}
            <div className="mt-4">
              <Link href="/for-coaches" className="wr-btn wr-btn--neutral">See coach features</Link>
            </div>
          </div>
          {!checkoutConfigured ? (
            <p className="mt-3 text-xs text-danger">Checkout is unavailable until the deployment’s Stripe settings are completed.</p>
          ) : null}
          <p className="mt-5 text-xs leading-5 text-ink-3">
            Secure checkout and recurring billing are handled by Stripe. Access starts only after the initial payment succeeds.
          </p>
        </div>
      </div>
    </PageFrame>
  );
}
