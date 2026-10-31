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
import { PUBLIC_LEGAL_CONTACT, mailto } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms governing SwimAhead accounts and recruiting tools.",
};

export default function TermsPage() {
  return (
    <LegalPageFrame
      current="/terms"
      title="Terms of Service"
      description="These Terms govern access to SwimAhead's swimmer and coach recruiting tools."
    >
      <LegalNotice>
        Read these Terms before creating an account. If you are a swimmer under 18, a parent or legal guardian must review and authorize your use of SwimAhead. Coach accounts are limited to authorized adults.
      </LegalNotice>

      <LegalSection id="agreement" title="1. Agreement to these Terms">
        <p>
          These Terms of Service form an agreement between you and {PUBLIC_LEGAL_CONTACT.operatorName} concerning the SwimAhead website, accounts, applications, communications, and related services, collectively the Service. By creating an account, accessing a restricted part of the Service, submitting information, or purchasing a subscription, you agree to these Terms and the {" "}
          <Link className={legalLinkClassName} href="/privacy">Privacy Policy</Link>.
        </p>
        <p>
          If you use the Service for a school, college, team, club, or other organization, you represent that you are authorized to act for that organization. In that case, "you" includes both you and that organization where the context requires it.
        </p>
        <p>If you do not agree, do not create an account, submit personal information, connect a mailbox, or purchase the Service.</p>
      </LegalSection>

      <LegalSection id="eligibility" title="2. Eligibility and authority">
        <ul className={legalListClassName}>
          <li><strong className="text-ink">Swimmers must be at least 13.</strong> SwimAhead is not offered to children under 13. Do not create an account for a child under 13 or provide that child's personal information through the Service.</li>
          <li><strong className="text-ink">Minor swimmers need guardian authorization.</strong> If a swimmer is under 18, a parent or legal guardian must review these Terms and authorize the swimmer's account, use, questionnaire submissions, and requested sharing. The guardian is responsible for supervising the minor's use.</li>
          <li><strong className="text-ink">Coaches must be adults.</strong> A coach account holder must be at least 18 and must be authorized to perform recruiting work for every team, school, or organization selected in the account.</li>
          <li><strong className="text-ink">Information must be accurate.</strong> You may not misstate your age, identity, role, team affiliation, authority, or relationship to a swimmer.</li>
        </ul>
        <p>
          SwimAhead may request information reasonably needed to verify eligibility or authority. Account creation or workspace access does not mean that SwimAhead has independently verified a person's identity, employment, authority, or background.
        </p>
      </LegalSection>

      <LegalSection id="service" title="3. What the Service does">
        <p>
          SwimAhead provides research, matching, planning, communication, questionnaire, roster-analysis, and recruiting-workflow tools for college swimming. Features may estimate whether an athlete's performance and stated preferences are in range for a program, or whether a recruit may fit a team's stated needs.
        </p>
        <p>
          The Service is a decision-support tool, not a recruiting agency, admissions office, eligibility authority, scholarship service, talent evaluator, or legal or compliance adviser. SwimAhead does not make recruiting, admissions, roster, scholarship, financial-aid, or eligibility decisions.
        </p>
        <p>
          We may add, change, limit, or discontinue features. We will not retroactively increase a paid subscription price during its current paid term. Material subscription changes receive any notice required by applicable law.
        </p>
      </LegalSection>

      <LegalSection id="accuracy" title="4. Recruiting estimates and data accuracy">
        <ul className={legalListClassName}>
          <li>Matches, performance ranges, roster needs, scholarship estimates, contact dates, and other outputs are estimates based on available data and assumptions. They may be incomplete, delayed, outdated, or wrong.</li>
          <li>Times, academics, contact details, roster information, costs, admissions data, staff lists, rules, and program offerings can change. Verify important information with the athlete, school, governing body, or original source before acting.</li>
          <li>No listing, score, recommendation, message draft, or match guarantees coach contact, admission, eligibility, a roster position, playing time, aid, or a scholarship.</li>
          <li>Users remain responsible for judgment and for compliance with NCAA, NAIA, conference, institutional, safeguarding, anti-discrimination, privacy, and communication requirements that apply to them.</li>
        </ul>
      </LegalSection>

      <LegalSection id="accounts" title="5. Accounts and security">
        <p>You must provide current information, keep credentials confidential, use reasonable security practices, and promptly report suspected unauthorized access. You are responsible for activity performed through your account unless applicable law provides otherwise.</p>
        <p>
          Do not share a coach login among staff members. Each person should use an individual authorized account and workspace membership. You may not sell, rent, transfer, or provide account access to another person without SwimAhead's written permission.
        </p>
        <p>
          Notify {" "}
          <a className={legalLinkClassName} href={mailto(PUBLIC_LEGAL_CONTACT.supportEmail, "SwimAhead account security")}>
            {PUBLIC_LEGAL_CONTACT.supportEmail}
          </a>
          {" "}if you believe an account or connected mailbox has been compromised.
        </p>
      </LegalSection>

      <LegalSection id="content" title="6. User content and recruiting records">
        <p>
          "User Content" includes profiles, times, files, links, preferences, notes, questionnaires, answers, recruit records, templates, emails, images, and other material submitted through the Service. You retain ownership of User Content you own.
        </p>
        <p>
          You grant SwimAhead a nonexclusive, worldwide, royalty-free license to host, copy, format, process, transmit, display, and otherwise use User Content only as reasonably necessary to operate, secure, support, and improve the Service and to provide the sharing or communication you request. This license includes allowing service providers to process the content for those purposes. It ends when the content is deleted from active systems, subject to recipients' copies, legal retention, security records, and backup cycles.
        </p>
        <p>You represent that you have the rights and permissions needed to submit User Content and direct its use. Coaches must have a lawful recruiting purpose for records about athletes and may not import, reveal, or use sensitive information without authorization.</p>
        <p>
          Images uploaded for use inside outgoing emails are hosted at publicly retrievable URLs so recipients' email clients can display them. Do not upload confidential, medical, financial, or otherwise sensitive images to that feature.
        </p>
      </LegalSection>

      <LegalSection id="sharing" title="7. Profile visibility and sharing">
        <p>
          Swimmer information is shared according to the feature used and the permissions recorded in the Service. A swimmer may express interest in a program, submit a program questionnaire, or authorize fuller profile sharing. Those actions can make relevant information available to authorized members of the selected coach workspace.
        </p>
        <p>
          A swimmer under 18 represents that a parent or legal guardian has authorized the account and requested sharing. SwimAhead records the signup or submission attestation but does not independently verify every guardian relationship. A guardian may withdraw authorization prospectively by contacting the privacy address below. Withdrawal does not retrieve information already received, exported, copied, or lawfully retained by another person.
        </p>
        <p>
          Recruiting data obtained from public, user-provided, or authorized third-party sources about athletes who do not hold SwimAhead accounts may also appear in coach search results. A claim or removal request may be submitted under the {" "}
          <Link className={legalLinkClassName} href="/privacy#rights">Privacy Policy</Link>.
        </p>
      </LegalSection>

      <LegalSection id="email" title="8. Email and outreach">
        <p>
          SwimAhead may let a user draft messages, open a message in a local mail client, or connect a Google or Microsoft mailbox for sending. The user selects recipients, reviews content, chooses whether to send, and is responsible for the message and its legal basis.
        </p>
        <p>When using outreach features, you must:</p>
        <ol className={legalOrderedListClassName}>
          <li>Use accurate sender information and nondeceptive subject lines.</li>
          <li>Contact people only for a legitimate, lawful recruiting purpose.</li>
          <li>Honor opt-outs and suppression records and include legally required identification, contact, and unsubscribe information.</li>
          <li>Comply with recruiting contact periods, school rules, CAN-SPAM, privacy law, and other requirements applicable to the sender and recipient.</li>
          <li>Never send harassment, discrimination, fraud, malware, purchased-list spam, or messages that endanger a minor.</li>
        </ol>
        <p>SwimAhead may block a delivery or suspend email features to protect recipients, connected providers, the Service, or its reputation.</p>
      </LegalSection>

      <LegalSection id="acceptable-use" title="9. Acceptable use">
        <p>You may not, directly or through another person:</p>
        <ul className={legalListClassName}>
          <li>Scrape, harvest, crawl, bulk-download, resell, broker, or build an independent database from the Service except through an export feature expressly provided for your own authorized data.</li>
          <li>Access another account, workspace, athlete profile, questionnaire response, mailbox, or system without authorization.</li>
          <li>Probe security, bypass access controls or billing, introduce malicious code, overload infrastructure, automate abusive requests, or interfere with another user's use.</li>
          <li>Impersonate a swimmer, guardian, coach, college, team, or SwimAhead representative.</li>
          <li>Use recruiting data to stalk, harass, exploit, discriminate unlawfully, or make contact prohibited by recruiting or safeguarding rules.</li>
          <li>Publish private workspace data, credentials, access tokens, or personal information outside its intended recruiting purpose.</li>
          <li>Upload unlawful, infringing, deceptive, defamatory, sexually exploitative, or harmful content.</li>
          <li>Create additional accounts to evade a restriction, obtain the first-season discount more than once, or avoid amounts owed.</li>
          <li>Reverse engineer or copy nonpublic portions of the Service except where a restriction is prohibited by law.</li>
        </ul>
      </LegalSection>

      <LegalSection id="third-parties" title="10. Third-party services and independence">
        <p>
          The Service can link to or interact with Stripe, Supabase, Resend, Google, Microsoft, USA Swimming Data Hub, college websites, government education data, SwimCloud links supplied by users, and other third-party sources or services. Their terms and privacy practices govern their systems.
        </p>
        <p>
          SwimAhead is an independent product and is not endorsed by or affiliated with SwimCloud, USA Swimming, NCAA, NAIA, any conference, any college, Google, Microsoft, Stripe, or another listed service unless a relationship is expressly stated. SwimAhead does not currently fetch or scrape SwimCloud athlete pages; users may provide SwimCloud links or paste information they are authorized to use.
        </p>
        <p>We are not responsible for a third party's availability, content, decisions, or handling of information. Links do not imply endorsement.</p>
      </LegalSection>

      <LegalSection id="billing" title="11. Coach subscriptions and payment">
        <LegalNotice>
          First 12-month term: $49 USD plus applicable taxes due at purchase. No free trial. After that term, the subscription automatically renews every 12 months at $99 USD plus applicable taxes unless canceled before renewal.
        </LegalNotice>
        <ul className={legalListClassName}>
          <li>Stripe processes payment details. By purchasing, you authorize the initial charge and recurring renewal charges shown before checkout, plus applicable taxes if required.</li>
          <li>The first-season discount is limited to one eligible first paid term per coach account and customer. It may not be recreated by opening duplicate accounts.</li>
          <li>Cancel online through the billing portal linked from coach settings before the renewal date to prevent the next charge. Cancellation ordinarily takes effect at the end of the paid term.</li>
          <li>Fees and refunds are governed by the {" "}<Link className={legalLinkClassName} href="/billing-policy">Billing, Cancellation, and Refund Policy</Link>, which is part of these Terms.</li>
          <li>Access may be withheld or suspended when payment is incomplete, past due, unpaid, reversed, disputed, or associated with the wrong price.</li>
          <li>Certain legacy accounts have separately granted lifetime access. Those accounts do not renew or incur a subscription charge unless their holder separately purchases a subscription.</li>
        </ul>
      </LegalSection>

      <LegalSection id="termination" title="12. Suspension, termination, and removal">
        <p>
          You may stop using the Service at any time. Cancellation of a paid subscription is different from deletion of an account. Canceling prevents future renewal but does not automatically delete account or recruiting records.
        </p>
        <p>
          SwimAhead may restrict or suspend access when reasonably necessary to address nonpayment, a security risk, unlawful conduct, misuse, harm to a minor, infringement, repeated complaints, or a material breach of these Terms. When practical, we will provide notice and an opportunity to correct the issue.
        </p>
        <p>
          To request account deletion or removal of content you posted, contact {" "}
          <a className={legalLinkClassName} href={mailto(PUBLIC_LEGAL_CONTACT.privacyEmail, "SwimAhead deletion request")}>
            {PUBLIC_LEGAL_CONTACT.privacyEmail}
          </a>.
          {" "}Deletion is subject to authentication, legal retention, safety and fraud records, recipient copies, and backup cycles as described in the Privacy Policy.
        </p>
      </LegalSection>

      <LegalSection id="intellectual-property" title="13. SwimAhead property">
        <p>
          The Service, its software, design, original text, scoring methods, compilations, and SwimAhead branding are owned by SwimAhead or its licensors and are protected by applicable law. These Terms give you a limited, personal, revocable, nonexclusive, nontransferable right to use the Service for its intended purpose during the period you are eligible and authorized.
        </p>
        <p>
          Feedback may be used without restriction or compensation, but SwimAhead will not publicly identify you as its source without permission. Nothing transfers ownership of your User Content to SwimAhead.
        </p>
      </LegalSection>

      <LegalSection id="disclaimers" title="14. Disclaimers">
        <p>
          To the maximum extent permitted by law, the Service is provided "as is" and "as available." SwimAhead disclaims implied warranties of merchantability, fitness for a particular purpose, title, noninfringement, and any warranty arising from course of dealing or usage of trade.
        </p>
        <p>
          SwimAhead does not warrant uninterrupted availability, error-free data, successful email delivery, a particular recruiting outcome, or that every user is who they claim to be. You are responsible for backups of exports or information you need independently of the Service.
        </p>
        <p>Some jurisdictions do not allow particular warranty exclusions, so those exclusions apply only to the extent allowed.</p>
      </LegalSection>

      <LegalSection id="liability" title="15. Limitation of liability">
        <p>
          To the maximum extent permitted by law, SwimAhead and the people who operate it will not be liable for indirect, incidental, special, consequential, exemplary, or punitive damages, or for lost opportunities, scholarships, revenue, data, goodwill, or expected savings arising from the Service.
        </p>
        <p>
          To the maximum extent permitted by law, aggregate liability for claims arising from the Service will not exceed the greater of $100 USD or the amount you paid SwimAhead during the 12 months before the event giving rise to the claim.
        </p>
        <p>
          These limitations do not limit liability that cannot lawfully be limited, and do not limit your nonwaivable consumer rights. Different rules may apply in some jurisdictions.
        </p>
      </LegalSection>

      <LegalSection id="indemnity" title="16. Responsibility for misuse">
        <p>
          To the extent permitted by law, an adult user or organization agrees to defend and indemnify SwimAhead against third-party claims, losses, and reasonable costs arising from that user's unlawful conduct, User Content submitted without required rights, misuse of recruiting or personal data, messages the user directs, or material violation of these Terms. This provision does not require indemnification for SwimAhead's own unlawful conduct.
        </p>
      </LegalSection>

      <LegalSection id="changes" title="17. Changes to these Terms">
        <p>
          SwimAhead may update these Terms to reflect product, legal, security, or operational changes. The effective date and version appear at the top. For a material change, we will provide notice reasonably designed to reach affected account holders before the change takes effect when required. Continued use after the effective date constitutes acceptance only to the extent permitted by law.
        </p>
        <p>Changes to recurring prices or renewal terms receive the separate notice required by applicable law and do not alter an already paid term retroactively.</p>
      </LegalSection>

      <LegalSection id="general" title="18. General terms">
        <p>
          If part of these Terms is unenforceable, it will be limited to the minimum extent necessary and the remainder stays effective. Failure to enforce a term once is not a waiver. You may not assign your account or these Terms without written permission; SwimAhead may assign them as part of a lawful reorganization or transfer of the Service, subject to the Privacy Policy.
        </p>
        <p>
          These Terms, the Privacy Policy, the Billing Policy, and any checkout disclosures are the agreement concerning the Service. Applicable law determines governing law and a court's jurisdiction. Nothing in these Terms prevents either party from seeking appropriate relief in a court that has jurisdiction or from contacting a regulator.
        </p>
      </LegalSection>

      <LegalSection id="contact" title="19. Contact">
        <p>
          Questions about these Terms may be sent to {" "}
          <a className={legalLinkClassName} href={mailto(PUBLIC_LEGAL_CONTACT.supportEmail, "SwimAhead Terms question")}>
            {PUBLIC_LEGAL_CONTACT.supportEmail}
          </a>.
        </p>
        {PUBLIC_LEGAL_CONTACT.postalAddress ? (
          <address className="not-italic">Postal address: {PUBLIC_LEGAL_CONTACT.postalAddress}</address>
        ) : null}
      </LegalSection>
    </LegalPageFrame>
  );
}
