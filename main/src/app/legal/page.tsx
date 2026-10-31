import type { Metadata } from "next";
import Link from "@/components/app-link";
import {
  LegalNotice,
  LegalPageFrame,
  LegalSection,
  legalLinkClassName,
  legalListClassName,
} from "@/components/legal";
import { PUBLIC_LEGAL_CONTACT, mailto } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Legal center",
  description: "SwimAhead terms, privacy, billing, cancellation, and refund policies.",
};

const policies = [
  {
    href: "/terms",
    title: "Terms of Service",
    description: "Eligibility, account rules, recruiting responsibilities, content, acceptable use, and service limitations.",
  },
  {
    href: "/privacy",
    title: "Privacy Policy",
    description: "What SwimAhead collects, where it comes from, how it is used and shared, and the choices available to users and families.",
  },
  {
    href: "/billing-policy",
    title: "Billing, Cancellation, and Refund Policy",
    description: "The $49 first annual term, $99 annual renewals, cancellation, failed payments, and refund rules.",
  },
] as const;

export default function LegalCenterPage() {
  return (
    <LegalPageFrame
      current="/legal"
      title="Legal center"
      description="The rules and disclosures that govern SwimAhead accounts, recruiting data, and paid coach subscriptions."
    >
      <LegalNotice>
        Paid coach access has no free trial. A new coach subscription costs $49 USD plus applicable taxes for its first 12-month term and automatically renews for $99 USD plus applicable taxes every 12 months unless canceled before renewal.
      </LegalNotice>

      <LegalSection id="policies" title="Policies">
        <div className="grid gap-3">
          {policies.map((policy) => (
            <Link
              key={policy.href}
              href={policy.href}
              className="wr-card block p-5 no-underline transition-colors hover:border-line-strong"
            >
              <h3 className="text-base font-semibold text-ink">{policy.title}</h3>
              <p className="mt-2 text-sm leading-6 text-ink-2">{policy.description}</p>
              <p className="mt-3 text-xs font-semibold text-accent-2">Read policy</p>
            </Link>
          ))}
        </div>
      </LegalSection>

      <LegalSection id="account-basics" title="Account basics">
        <ul className={legalListClassName}>
          <li>Swimmer accounts are for people age 13 or older. A swimmer under 18 must have a parent or legal guardian review and authorize the account and data sharing.</li>
          <li>Coach accounts are for people age 18 or older who are authorized to act for the team or organization they identify.</li>
          <li>SwimAhead provides recruiting research and workflow tools. It does not promise admission, recruiting contact, a roster position, financial aid, or a scholarship.</li>
          <li>Users control the recruiting information they enter and are responsible for checking its accuracy before relying on it or sending it to someone else.</li>
        </ul>
      </LegalSection>

      <LegalSection id="contact" title="Contact">
        <p>
          General and account questions: {" "}
          <a className={legalLinkClassName} href={mailto(PUBLIC_LEGAL_CONTACT.supportEmail, "SwimAhead support")}>
            {PUBLIC_LEGAL_CONTACT.supportEmail}
          </a>
        </p>
        <p>
          Privacy, access, correction, deletion, or minor-content removal requests: {" "}
          <a className={legalLinkClassName} href={mailto(PUBLIC_LEGAL_CONTACT.privacyEmail, "SwimAhead privacy request")}>
            {PUBLIC_LEGAL_CONTACT.privacyEmail}
          </a>
        </p>
        <p>
          Billing, cancellation, or charge questions: {" "}
          <a className={legalLinkClassName} href={mailto(PUBLIC_LEGAL_CONTACT.billingEmail, "SwimAhead billing question")}>
            {PUBLIC_LEGAL_CONTACT.billingEmail}
          </a>
        </p>
        {PUBLIC_LEGAL_CONTACT.postalAddress ? (
          <address className="not-italic">
            Postal address: {PUBLIC_LEGAL_CONTACT.postalAddress}
          </address>
        ) : null}
      </LegalSection>
    </LegalPageFrame>
  );
}
