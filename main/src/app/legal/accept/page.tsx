import type { Metadata } from "next";
import Link from "@/components/app-link";
import { signOutAction } from "@/app/auth/actions";
import { BrandLockup } from "@/components/shell";
import * as FormControl from "@/components/form-control";
import { requireOnboardedAccount } from "@/lib/auth";
import { safeRedirectPath } from "@/lib/env";
import { acceptCurrentPoliciesAction } from "./actions";

export const metadata: Metadata = { title: "Review current policies" };

const errors: Record<string, string> = {
  required: "Both confirmations are required before you can continue.",
  configuration: "The current policy version is not configured correctly. Contact support.",
  unavailable: "Your acceptance could not be saved. Try again or contact support.",
};

export default async function LegalAcceptancePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const context = await requireOnboardedAccount("/legal/accept");
  const params = await searchParams;
  const fallback = context.accountType === "coach" ? "/c" : "/s";
  const destination = safeRedirectPath(params.next, fallback);
  const error = params.error ? errors[params.error] : null;
  const coach = context.accountType === "coach";

  return (
    <main className="min-h-screen bg-[var(--paper)] px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between gap-4">
          <BrandLockup href="/" />
          <form action={signOutAction}>
            <button type="submit" className="wr-btn wr-btn--ghost wr-btn--small">Sign out</button>
          </form>
        </div>

        <section className="wr-card mt-10 p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent-2">Policy review</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Accept the current SwimAhead policies</h1>
          <p className="mt-3 text-sm leading-6 text-ink-2">
            Before using your {coach ? "coach" : "swimmer"} account, review the current Terms and Privacy Policy. This records your acceptance; it does not change a founding account&apos;s lifetime billing status.
          </p>

          {error ? <p role="alert" className="mt-5 border border-danger/30 bg-danger/5 p-3 text-sm text-danger">{error}</p> : null}

          <form action={acceptCurrentPoliciesAction} className="mt-7 space-y-4">
            <FormControl.Input type="hidden" name="next" value={destination} />
            <label className="flex items-start gap-3 text-sm leading-6 text-ink-2">
              <FormControl.Input className="mt-1 size-4 shrink-0 accent-[var(--accent)]" type="checkbox" name="legalAccepted" value="accepted" required />
              <span>
                I have read and agree to the <Link className="font-semibold text-accent-2 underline" href="/terms" target="_blank">Terms of Service</Link> and acknowledge the <Link className="font-semibold text-accent-2 underline" href="/privacy" target="_blank">Privacy Policy</Link>.
              </span>
            </label>
            <label className="flex items-start gap-3 text-sm leading-6 text-ink-2">
              <FormControl.Input className="mt-1 size-4 shrink-0 accent-[var(--accent)]" type="checkbox" name="eligibilityConfirmed" value="confirmed" required />
              <span>
                {coach
                  ? "I confirm that I am at least 18 and am genuinely authorized to act for each team or organization I identify in SwimAhead."
                  : "I confirm that I am at least 13 and, if I am under 18, my parent or legal guardian has reviewed and authorized my use of SwimAhead."}
              </span>
            </label>
            <button type="submit" className="wr-btn wr-btn--primary">Accept and continue</button>
          </form>

          <p className="mt-5 text-xs leading-5 text-ink-3">
            A coach payment or lifetime billing exception does not verify employment, team authority, identity, or safeguarding eligibility.
          </p>
        </section>
      </div>
    </main>
  );
}
