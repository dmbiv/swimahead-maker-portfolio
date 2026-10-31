import type { Metadata } from "next";
import Link from "@/components/app-link";
import {
  LegalNotice,
  LegalPageFrame,
  LegalSection,
  legalLinkClassName,
  legalListClassName,
  legalOrderedListClassName,
} from "@/components/legal";
import {
  BILLING_POLICY_VERSION,
  COACH_AUTO_RENEW_DISCLOSURE,
  FIRST_TERM_DISCLOSURE,
  PUBLIC_LEGAL_CONTACT,
  mailto,
} from "@/lib/legal";

export const metadata: Metadata = {
  title: "Billing, Cancellation, and Refund Policy",
  description: "SwimAhead coach subscription price, automatic renewal, cancellation, and refund terms.",
};

export default function BillingPolicyPage() {
  return (
    <LegalPageFrame
      current="/billing-policy"
      title="Billing, Cancellation, and Refund Policy"
      description="The complete price, renewal, cancellation, payment-failure, and refund rules for paid SwimAhead coach access."
    >
      <LegalNotice>
        <strong className="text-ink">{FIRST_TERM_DISCLOSURE}</strong> {COACH_AUTO_RENEW_DISCLOSURE}
      </LegalNotice>

      <LegalSection id="plan" title="1. Coach plan">
        <div className="overflow-x-auto border border-line bg-surface">
          <table className="w-full min-w-[560px] border-collapse text-left text-sm">
            <thead className="bg-sunken text-xs uppercase tracking-wide text-ink-3">
              <tr>
                <th className="border-b border-line px-4 py-3 font-semibold">Term</th>
                <th className="border-b border-line px-4 py-3 font-semibold">Charge</th>
                <th className="border-b border-line px-4 py-3 font-semibold">When charged</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              <tr>
                <td className="px-4 py-3 font-semibold text-ink">First 12-month term</td>
                <td className="px-4 py-3">$49 USD</td>
                <td className="px-4 py-3">Immediately when checkout succeeds</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-semibold text-ink">Each later 12-month term</td>
                <td className="px-4 py-3">$99 USD</td>
                <td className="px-4 py-3">Automatically on the annual renewal date unless canceled beforehand</td>
              </tr>
            </tbody>
          </table>
        </div>
        <ul className={legalListClassName}>
          <li>There is no free trial, free-to-paid conversion, or delayed first charge.</li>
          <li>The $49 price is a $50 introductory discount from the standard $99 annual price and applies only to an eligible coach's first paid 12-month term.</li>
          <li>Prices are stated in United States dollars. Applicable taxes may be added when legally required and will be shown at checkout.</li>
          <li>The subscription begins when Stripe confirms successful payment and SwimAhead records an active subscription.</li>
          <li>A "season" in product copy means the applicable 12-month subscription term. It is not tied to a school competition calendar.</li>
        </ul>
      </LegalSection>

      <LegalSection id="renewal" title="2. Automatic renewal authorization">
        <p>
          By purchasing paid coach access, you expressly authorize Stripe and SwimAhead to charge $49 USD plus applicable taxes for the first 12-month term and, unless you cancel before renewal, $99 USD plus applicable taxes for each later 12-month term using the payment method associated with the subscription.
        </p>
        <p>
          The renewal date is based on the date and time the subscription begins and appears in Checkout, receipts, account billing information, or the Stripe customer portal. Calendar differences, including leap years, may affect the displayed date.
        </p>
        <p>
          SwimAhead will provide renewal, material-change, or price-change notices when required by applicable law. Keep the account and Stripe customer email current, and review notices promptly. A notice does not replace the user's ability to cancel at any time before renewal.
        </p>
      </LegalSection>

      <LegalSection id="eligibility" title="3. First-term discount eligibility">
        <p>The introductory price is intended to let a newly paid coach account purchase its first 12-month term for $49 USD. It may be redeemed only once per eligible coach account and customer.</p>
        <p>
          Creating another account, using another email, changing institutions, or asking another person to purchase in order to repeat the introductory discount is prohibited. A failed or abandoned Checkout Session does not by itself redeem the discount; a successfully activated first discounted subscription does.
        </p>
        <p>
          Certain accounts that existed before paid coach billing was introduced have separately granted lifetime billing status. That status has no paid term or renewal and does not require a Stripe subscription for the life of the account and Service. It is personal to the account; access remains subject to Service availability and may be restricted for fraud, unlawful use, a serious security issue, or a material violation of the Terms.
        </p>
      </LegalSection>

      <LegalSection id="payment" title="4. Payment processing">
        <p>
          Stripe hosts the payment form and processes cards, payment authentication, subscription invoices, retries, refunds, and the customer portal. SwimAhead receives billing identifiers, price, amount, currency, status, and term dates, but not the full card number.
        </p>
        <p>
          You authorize Stripe to store the selected payment method for renewal and other subscription charges described here. Stripe's own terms and privacy policy apply to its processing. The card statement descriptor and receipt will identify SwimAhead or the descriptor displayed during checkout.
        </p>
        <p>
          Do not test the live site with a fake or unauthorized card. Use only a payment method you are authorized to use.
        </p>
      </LegalSection>

      <LegalSection id="cancellation" title="5. How to cancel">
        <p>You can cancel automatic renewal at any time. The most direct online method is:</p>
        <ol className={legalOrderedListClassName}>
          <li>Sign in to the paid coach account.</li>
          <li>Open coach settings or the subscription page.</li>
          <li>Select the button to manage billing in Stripe.</li>
          <li>In the Stripe customer portal, choose cancellation and confirm cancellation at the end of the current term.</li>
          <li>Confirm that the portal shows the subscription as scheduled to cancel.</li>
        </ol>
        <p>
          If you cannot sign in or authenticate, send an email from the subscription's account email to {" "}
          <a className={legalLinkClassName} href={mailto(PUBLIC_LEGAL_CONTACT.billingEmail, "Cancel SwimAhead coach subscription")}>
            {PUBLIC_LEGAL_CONTACT.billingEmail}
          </a>
          {" "}with the subject "Cancel coach subscription" and identify the coach account. We may verify control of the account before making a billing change.
        </p>
        <p>
          Cancellation must be completed or received before the renewal charge to prevent that charge. Deleting an app account, disconnecting a mailbox, stopping use, removing a college, or sending a message to a different address does not cancel a Stripe subscription.
        </p>
      </LegalSection>

      <LegalSection id="effect" title="6. Effect of cancellation">
        <ul className={legalListClassName}>
          <li>Cancellation ordinarily takes effect at the end of the already paid 12-month term.</li>
          <li>The account retains paid access through the displayed period end while the subscription remains active and in good standing.</li>
          <li>No later renewal charge will be made after a valid end-of-term cancellation unless the account holder reactivates or buys a new subscription.</li>
          <li>Cancellation does not erase account, recruiting, payment, or consent records. Account deletion is a separate privacy request.</li>
          <li>You may reverse an end-of-term cancellation before the period ends if Stripe's portal offers that option.</li>
        </ul>
      </LegalSection>

      <LegalSection id="refunds" title="7. Refund policy">
        <p>
          Access to the digital Service begins after successful payment. Because there is no trial and access is delivered immediately, charges are final and nonrefundable except as stated below or required by law.
        </p>
        <p>SwimAhead will review a refund or correction request involving:</p>
        <ul className={legalListClassName}>
          <li>A duplicate or incorrect SwimAhead charge.</li>
          <li>A renewal charged after a cancellation was validly completed or received before the renewal.</li>
          <li>An unauthorized charge after reasonable account and payment verification.</li>
          <li>A refund required by applicable law.</li>
          <li>SwimAhead permanently discontinuing paid coach access, or terminating it without user breach, before the paid term ends. In that case a prorated refund for the unused portion may be provided.</li>
        </ul>
        <p>Refunds are not ordinarily provided for:</p>
        <ul className={legalListClassName}>
          <li>Canceling or ceasing use partway through a paid term.</li>
          <li>Failing to use the Service, changing jobs or teams, or no longer needing recruiting tools.</li>
          <li>Dissatisfaction with a match, recruit, roster result, recruiting outcome, or third-party data source.</li>
          <li>A feature change that does not remove the core paid coach workspace.</li>
          <li>Suspension or termination caused by fraud, abuse, unlawful conduct, nonpayment, or a material violation of the Terms.</li>
        </ul>
        <p>
          To request review, email {" "}
          <a className={legalLinkClassName} href={mailto(PUBLIC_LEGAL_CONTACT.billingEmail, "SwimAhead refund review")}>
            {PUBLIC_LEGAL_CONTACT.billingEmail}
          </a>
          {" "}with the account email, charge date, amount, and reason. Do not send a full card number. If approved, a refund is issued to the original payment method; bank processing time is outside SwimAhead's control.
        </p>
      </LegalSection>

      <LegalSection id="failed-payments" title="8. Failed, disputed, or reversed payments">
        <p>
          If an initial payment is incomplete or unpaid, coach access is not activated. If a renewal fails or is reversed, Stripe may retry the payment and send a payment-update link. SwimAhead may suspend access while a subscription is past due, unpaid, disputed, canceled, associated with an unverified price, or otherwise not active.
        </p>
        <p>
          Update the payment method through the authenticated Stripe portal. Restoring a payment method does not guarantee access until Stripe confirms payment and the subscription returns to an eligible active status.
        </p>
        <p>
          Contact billing support promptly if a charge appears wrong. This request process does not limit rights available through a card issuer or applicable law. Fraudulent disputes or chargeback abuse may lead to account restriction and collection of amounts lawfully owed.
        </p>
      </LegalSection>

      <LegalSection id="price-changes" title="9. Price and term changes">
        <p>
          SwimAhead will not increase the subscription price during an already paid term. If the standard renewal price or other material renewal term changes, affected subscribers will receive advance notice and cancellation instructions as required by law before the change applies.
        </p>
        <p>
          Continuing the subscription after a properly disclosed change takes effect authorizes the changed renewal charge only to the extent allowed by law. Cancel before the applicable renewal to reject a future changed term.
        </p>
      </LegalSection>

      <LegalSection id="receipts" title="10. Receipts and billing notices">
        <p>
          Stripe or SwimAhead will send a post-purchase acknowledgment and legally required billing disclosures to the customer email. Stripe or SwimAhead may also send receipts, payment-failure messages, upcoming-renewal notices, cancellation confirmations, and refund notices. These are service communications, not marketing.
        </p>
        <p>
          Save the initial acknowledgment and cancellation confirmation. You can also review invoices, term dates, payment methods, and subscription status through the Stripe customer portal.
        </p>
      </LegalSection>

      <LegalSection id="contact" title="11. Billing contact">
        <p>
          Billing, cancellation, or refund questions: {" "}
          <a className={legalLinkClassName} href={mailto(PUBLIC_LEGAL_CONTACT.billingEmail, "SwimAhead billing question")}>
            {PUBLIC_LEGAL_CONTACT.billingEmail}
          </a>
        </p>
        <p>
          This Policy is part of the {" "}<Link className={legalLinkClassName} href="/terms">Terms of Service</Link>. Personal information used for billing is described in the {" "}<Link className={legalLinkClassName} href="/privacy">Privacy Policy</Link>.
        </p>
        <p className="font-data text-xs text-ink-3">Billing policy version: {BILLING_POLICY_VERSION}</p>
        {PUBLIC_LEGAL_CONTACT.postalAddress ? (
          <address className="not-italic">Postal address: {PUBLIC_LEGAL_CONTACT.postalAddress}</address>
        ) : null}
      </LegalSection>
    </LegalPageFrame>
  );
}
