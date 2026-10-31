"use client";

import { useState } from "react";
import Link from "@/components/app-link";
import * as FormControl from "@/components/form-control";
import type { CoachCheckoutOffer } from "@/lib/coach-billing";
import { startCoachCheckoutAction } from "./actions";

export function CheckoutConsentForm({
  offer,
  price,
  disclosure,
  consentStatement,
  disabled,
}: {
  offer: CoachCheckoutOffer;
  price: 49 | 99;
  disclosure: string;
  consentStatement: string;
  disabled: boolean;
}) {
  const [accepted, setAccepted] = useState(false);

  return (
    <form action={startCoachCheckoutAction} className="max-w-xl space-y-4">
      <FormControl.Input type="hidden" name="offer" value={offer} />
      <div className="border-l-2 border-accent bg-[var(--sunken)] px-4 py-3">
        <p className="text-sm font-medium leading-6 text-ink-1">{disclosure}</p>
        <p className="mt-1 text-xs leading-5 text-ink-3">Applicable taxes, if any, may be added in secure checkout.</p>
      </div>
      <label className="flex items-start gap-2.5 text-xs leading-5 text-ink-2">
        <FormControl.Input
          className="mt-1 size-4 shrink-0 accent-[var(--accent)]"
          type="checkbox"
          name="billingConsent"
          value="accepted"
          checked={accepted}
          required
          disabled={disabled}
          onChange={(event) => setAccepted(event.target.checked)}
        />
        <span>{consentStatement}</span>
      </label>
      <p className="text-xs leading-5 text-ink-3">
        Review the <Link href="/terms" target="_blank" rel="noreferrer" className="font-semibold text-accent-2 underline">Terms of Service</Link>, <Link href="/privacy" target="_blank" rel="noreferrer" className="font-semibold text-accent-2 underline">Privacy Policy</Link>, and <Link href="/billing-policy" target="_blank" rel="noreferrer" className="font-semibold text-accent-2 underline">Billing, Cancellation, and Refund Policy</Link>. Current Terms and Privacy acceptance is recorded separately on the account; the checkbox above records this purchase&apos;s automatic-renewal authorization.
      </p>
      <button type="submit" disabled={disabled || !accepted} className="wr-btn wr-btn--primary">
        Agree and pay ${price}
      </button>
    </form>
  );
}
