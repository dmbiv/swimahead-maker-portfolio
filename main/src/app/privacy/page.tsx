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
  title: "Privacy Policy",
  description: "How SwimAhead collects, uses, shares, retains, and protects personal information.",
};

export default function PrivacyPage() {
  return (
    <LegalPageFrame
      current="/privacy"
      title="Privacy Policy"
      description="This Policy explains how SwimAhead handles personal information about swimmers, guardians, coaches, recruits, questionnaire respondents, and site visitors."
    >
      <LegalNotice>
        SwimAhead does not sell private information submitted through swimmer accounts or questionnaires, and it does not use or share personal information for cross-context behavioral advertising. Paid coach tools can display limited recruiting facts compiled from public or properly licensed sources, as explained below. Swimmer account information is not made public by default.
      </LegalNotice>

      <LegalSection id="scope" title="1. Scope and operator">
        <p>
          This Privacy Policy applies to the SwimAhead website, accounts, recruiting workspaces, questionnaires, email tools, billing features, and support interactions, collectively the Service. {PUBLIC_LEGAL_CONTACT.operatorName} is responsible for the practices described here.
        </p>
        <p>
          This Policy covers information SwimAhead sends to a provider, directs a provider to collect for SwimAhead, receives from a provider, or can access through an integration. Third-party websites and services also have their own privacy practices for their independent processing. Their policies govern a college site, USA Swimming Data Hub, SwimCloud, Stripe-hosted pages, Google, Microsoft, or another third-party page that you visit or authorize.
        </p>
      </LegalSection>

      <LegalSection id="information" title="2. Information we collect">
        <p>The information collected depends on the account and features used.</p>
        <div className="overflow-x-auto border border-line bg-surface">
          <table className="w-full min-w-[620px] border-collapse text-left text-sm">
            <thead className="bg-sunken text-xs uppercase tracking-wide text-ink-3">
              <tr>
                <th className="border-b border-line px-4 py-3 font-semibold">Category</th>
                <th className="border-b border-line px-4 py-3 font-semibold">Examples</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line align-top">
              <tr>
                <td className="px-4 py-3 font-semibold text-ink">Account and identity</td>
                <td className="px-4 py-3">Google account name, verified email, provider identity identifier, Supabase authentication and session records, account type, display name, age-eligibility and user-provided guardian-authorization attestations, job title, user ID, and account dates. Legacy records may include password-related authentication records, date of birth, guardian relationship information, or direct guardian records.</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-semibold text-ink">Swimmer profile</td>
                <td className="px-4 py-3">Name, recruiting category, graduation year, club or school, city and state, email, phone, GPA, SAT or ACT, academic interests, budget preference, biography, race-video link, and profile-sharing choices.</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-semibold text-ink">Swimming performance</td>
                <td className="px-4 py-3">Events, courses, times, meet and date, source or proof link, uploaded or pasted results, USA Swimming member identifiers, club, LSC, age-related data, and SwimCloud links supplied by users.</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-semibold text-ink">Coach and organization</td>
                <td className="px-4 py-3">Team, school, role, institutional email, workspace membership, college selections, roster information, recruiting settings, scholarship-planning inputs, and program-access information.</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-semibold text-ink">Recruiting activity and content</td>
                <td className="px-4 py-3">Favorites, ruled-out choices, boards, stages, ratings, tags, notes, tasks, campaigns, templates, questionnaire questions and responses, recruit records, contact history, outreach drafts, sent-message content, and uploaded email images.</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-semibold text-ink">Mailbox connection</td>
                <td className="px-4 py-3">Connected Google or Microsoft account ID, sender name and email, provider, granted scopes, token expiration, encrypted access and refresh credentials, connection status, delivery records, recipient, subject, message body, and provider receipt or error.</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-semibold text-ink">Billing</td>
                <td className="px-4 py-3">Billing name, email, address, tax status or tax ID if enabled, Stripe customer, Checkout Session, subscription, price, invoice, charge, refund, and dispute identifiers, subscription status, paid-term dates, amounts, currency, tax, discount eligibility, cancellation status, fraud or dispute events, internal user-ID metadata, and limited payment-method details Stripe makes available such as brand and last four digits. SwimAhead does not receive or store full card numbers.</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-semibold text-ink">Technical and support</td>
                <td className="px-4 py-3">IP address, browser and device information, request and security logs, cookie or session identifiers, approximate location inferred from IP, timestamps, errors, support messages, and records of privacy or billing requests.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>Please do not submit Social Security numbers, payment-card numbers, medical records, financial-account credentials, or other information that a feature does not request.</p>
      </LegalSection>

      <LegalSection id="sources" title="3. Sources of information">
        <ul className={legalListClassName}>
          <li><strong className="text-ink">You.</strong> Information entered at signup, onboarding, profile editing, imports, forms, support, billing, and mailbox connection.</li>
          <li><strong className="text-ink">Other users and organizations.</strong> A coach may create a recruit record; a workspace member may add notes; a user may attest that a guardian authorized use; a guardian may later contact SwimAhead to withdraw or correct that authorization; and a questionnaire respondent may submit information to a program.</li>
          <li><strong className="text-ink">Public and third-party sources.</strong> USA Swimming results and member-search data, government college datasets such as College Scorecard, college and athletics websites, competition results, and other recruiting sources. SwimAhead's right to use a source depends on applicable law, the source's terms, and any authorization required for that source.</li>
          <li><strong className="text-ink">User-directed third parties.</strong> Google returns the basic identity used to sign in; Stripe collects the billing contact, address, payment method, and any configured tax information and returns billing, invoice, tax, payment, refund, and dispute details; Google or Microsoft can separately return a connected-mailbox identity and send receipts when a coach connects outreach; Supabase provides authentication records; and email providers return delivery events.</li>
          <li><strong className="text-ink">Automatic collection.</strong> Browsers, servers, security systems, and hosting infrastructure generate session, request, device, and diagnostic data.</li>
        </ul>
        <p>
          SwimAhead does not currently use a general SwimCloud athlete API or scrape SwimCloud. Users can provide a SwimCloud link and can paste or upload athlete-owned results. SwimCloud's own terms and privacy policy govern its site.
        </p>
      </LegalSection>

      <LegalSection id="uses" title="4. How we use information">
        <ul className={legalListClassName}>
          <li>Create, authenticate, secure, and support accounts and workspaces.</li>
          <li>Build swimmer profiles, store times, calculate performance comparisons, and personalize program or recruit matching.</li>
          <li>Provide boards, roster planning, campaigns, questionnaires, recruit records, notes, tasks, and other requested workflows.</li>
          <li>Apply a swimmer's sharing choices and record age and guardian-authorization attestations where the Service collects them.</li>
          <li>Create, preview, transmit, and record outreach that an authorized user directs.</li>
          <li>Process coach subscriptions, determine access, send receipts or billing notices, prevent repeated introductory discounts, and address charge questions.</li>
          <li>Respond to support, access, correction, deletion, consent, removal, security, and legal requests.</li>
          <li>Detect abuse, enforce access controls, troubleshoot failures, maintain service integrity, prevent fraud, and protect users.</li>
          <li>Evaluate and improve features using aggregate, deidentified, or appropriately restricted operational data.</li>
          <li>Comply with law, preserve evidence, establish or defend legal claims, and enforce the Terms.</li>
        </ul>
      </LegalSection>

      <LegalSection id="matching" title="5. Matching and automated analysis">
        <p>
          SwimAhead uses software rules and calculations to compare swimmer times, competition categories, class years, academic preferences, costs, locations, roster performance, and coach-selected needs. The resulting match, fit, benchmark, or recommendation is an estimate intended to organize research.
        </p>
        <p>
          SwimAhead does not make a decision that admits, recruits, rejects, ranks for eligibility, awards aid to, or removes a person from a team. Coaches, schools, swimmers, and families make their own decisions and should verify underlying information.
        </p>
      </LegalSection>

      <LegalSection id="visibility" title="6. Visibility and sharing within SwimAhead">
        <ul className={legalListClassName}>
          <li><strong className="text-ink">Swimmer accounts.</strong> An owned swimmer profile is not public by default. Expressing interest may share limited identifying and recruiting information with the selected program. Full-profile sharing can include contact, academics, times, biography, and video information.</li>
          <li><strong className="text-ink">Minor swimmers.</strong> A user under 18 must attest that a parent or legal guardian authorized the account, submission, and requested sharing. SwimAhead does not independently verify every guardian relationship. A verified withdrawal request stops future sharing controlled by SwimAhead but cannot retrieve copies already received or independently held by others.</li>
          <li><strong className="text-ink">Coach workspaces.</strong> Recruit records, notes, tasks, questionnaires, campaigns, roster data, and delivery history are available to authorized members of the applicable workspace according to their role.</li>
          <li><strong className="text-ink">Questionnaires.</strong> A person using a program's questionnaire link sends the response to that program's coach workspace. Do not submit to a program unless you intend that program to receive it.</li>
          <li><strong className="text-ink">Public-source recruits.</strong> Coach search results may contain limited recruiting facts compiled from public or licensed sources even if the athlete does not have a SwimAhead account.</li>
          <li><strong className="text-ink">Email recipients.</strong> Content sent through an outreach feature is disclosed to the selected recipient and the connected mail provider. Recipients may retain, forward, or copy it.</li>
          <li><strong className="text-ink">Email images.</strong> An image uploaded for an outgoing rich email is stored at a public URL so email clients can retrieve it. Anyone with that URL may be able to view it.</li>
        </ul>
      </LegalSection>

      <LegalSection id="service-providers" title="7. Service providers and other disclosures">
        <p>SwimAhead discloses information only as reasonably needed for the purposes described here:</p>
        <ul className={legalListClassName}>
          <li><strong className="text-ink">Supabase</strong> provides authentication, database, server functions, and file storage.</li>
          <li><strong className="text-ink">Stripe</strong> hosts payment entry and the billing portal and processes the billing identity and address, payment method, tax information if configured, customers, subscriptions, invoices, charges, refunds, disputes, and fraud signals. SwimAhead sends the account name, email, and internal user identifier and receives or can access the billing records described above. Stripe also processes payment details under its own privacy policy.</li>
          <li><strong className="text-ink">Resend</strong> may transmit transactional messages and return delivery events when that feature is configured.</li>
          <li><strong className="text-ink">Google</strong> verifies every account sign-in and returns basic profile identity: name, verified email, and provider identifier. SwimAhead does not request Gmail access for account authentication.</li>
          <li><strong className="text-ink">Google or Microsoft mailbox connection</strong> is separate and optional for coaches. If a coach chooses it, the provider receives account-connection and send requests. SwimAhead requests identity information and send permission, not general mailbox-reading permission.</li>
          <li><strong className="text-ink">Hosting, security, and infrastructure providers</strong> process technical data needed to operate and protect the Service.</li>
          <li><strong className="text-ink">Authorities and affected parties</strong> may receive information when reasonably necessary to comply with valid legal process, protect safety or rights, investigate abuse, or address fraud and security incidents.</li>
          <li><strong className="text-ink">A successor or transaction participant</strong> may receive information in a merger, financing, acquisition, reorganization, or transfer of the Service, subject to appropriate confidentiality and notice obligations.</li>
        </ul>
        <p>SwimAhead does not permit a service provider to use personal information for its own targeted advertising on SwimAhead's behalf.</p>
      </LegalSection>

      <LegalSection id="sale" title="8. Public-source recruiting data and no targeted advertising">
        <p>
          SwimAhead does not sell private information submitted through swimmer accounts or questionnaires for money or other valuable consideration. It does not share personal information for cross-context behavioral advertising and does not display targeted advertising based on activity across unrelated sites or services.
        </p>
        <p>
          A paid coach subscription may provide search and matching access to limited athlete recruiting facts compiled from public or properly licensed sources. SwimAhead charges for the software workspace and its features, not a per-person record. Some privacy and data-broker laws define a sale, exchange, or covered data-broker activity broadly, however. Before publicly offering this feature, the operator must obtain a jurisdiction-specific analysis and implement any required license, notice, registration, deletion, access, correction, or opt-out obligations. A person may request removal or object to this use through the privacy contact below.
        </p>
        <p>If these practices change, SwimAhead will update this Policy and provide any required notice and choice before using previously collected information for the new purpose.</p>
      </LegalSection>

      <LegalSection id="cookies" title="9. Cookies, local storage, and Do Not Track">
        <p>
          SwimAhead uses cookies and browser storage that are necessary for authentication, session continuity, security, OAuth state, preferences, and navigation. The Service does not currently use third-party advertising cookies or cross-site behavioral analytics.
        </p>
        <p>
          Blocking necessary cookies can prevent sign-in, billing return flows, mailbox connection, or other features from working. Stripe and other third-party pages may set their own cookies when you visit them.
        </p>
        <p>
          Because browsers do not apply a uniform Do Not Track standard and SwimAhead does not conduct cross-site behavioral advertising, the Service does not change its current practices in response to a browser Do Not Track signal. This does not limit any legally recognized opt-out signal if SwimAhead later engages in a practice to which that signal applies.
        </p>
        <p>
          SwimAhead does not knowingly permit third parties to collect activity on SwimAhead over time and across unrelated websites for advertising. When you leave SwimAhead for Stripe, Google, Microsoft, a college, or another third-party service, that service may collect activity under its own policy.
        </p>
      </LegalSection>

      <LegalSection id="retention" title="10. Retention and deletion">
        <p>SwimAhead keeps information only for as long as reasonably necessary for the purpose collected, considering account status, user instructions, workspace needs, safety, fraud prevention, recordkeeping, legal obligations, disputes, and backup design.</p>
        <ul className={legalListClassName}>
          <li>Account, profile, time, board, and workspace information is generally retained while the account or applicable workspace is active and until it is deleted or no longer needed.</li>
          <li>Connected-mailbox credentials are retained while the connection remains active and are removed from active credential storage when the connection is disconnected. Short-lived OAuth state expires after the connection attempt.</li>
          <li>Outreach drafts, send records, provider events, and related content are retained while reasonably needed for recruiting workflows, complaints, suppression, security, and delivery disputes. SwimAhead does not yet apply one automatic deletion period to every outreach record.</li>
          <li>Opt-out and suppression records may be retained as long as needed to avoid contacting a person again.</li>
          <li>Billing, consent, transaction, security, and legal records may be retained for the period required to demonstrate authorization, comply with law, prevent abuse, resolve disputes, or enforce agreements.</li>
          <li>Public email images and data already exported, sent, copied, or received by someone else may persist after the originating record is removed.</li>
          <li>Deleted information can remain temporarily in restricted backups, logs, or disaster-recovery systems until overwritten under ordinary cycles.</li>
        </ul>
        <p>Where possible, SwimAhead may deidentify information instead of retaining it in identifiable form.</p>
      </LegalSection>

      <LegalSection id="security" title="11. Security">
        <p>
          SwimAhead uses safeguards intended to match the nature of the information, including authenticated access, role and workspace controls, database row-level security, server-only administrative credentials, encrypted storage of connected-mailbox tokens, signed webhook verification, transport encryption, input validation, and Stripe-hosted payment entry.
        </p>
        <p>
          No storage or transmission method is completely secure. Users should protect their Google account with a strong password and two-step verification, sign out of shared devices, limit sensitive notes, and report suspected compromise promptly.
        </p>
      </LegalSection>

      <LegalSection id="minors" title="12. Minors">
        <p><strong className="text-ink">Under 13.</strong> SwimAhead is not offered for direct use by children under 13 and does not knowingly allow them to create accounts or submit questionnaires. If we learn that an under-13 child submitted personal information directly, we will disable the account and delete the information unless retention is legally required. SwimAhead may separately process competition records obtained from public or third-party sources about athletes, including minors; a parent may request review, correction, or removal at the privacy email below.</p>
        <p><strong className="text-ink">Ages 13 through 17.</strong> A minor swimmer must have a parent or legal guardian authorize use. SwimAhead records the user's age-eligibility and guardian-authorization attestation but does not independently verify every relationship. We do not sell private information submitted through a minor's account or questionnaire, and we do not use minors' information for targeted advertising. Public-source recruiting facts are addressed separately in Section 8.</p>
        <p><strong className="text-ink">Removal of a minor's content.</strong> A registered minor may edit information available in profile controls or request removal of content or information the minor posted. Send a request identifying the account and material to {" "}<a className={legalLinkClassName} href={mailto(PUBLIC_LEGAL_CONTACT.privacyEmail, "Minor content removal request")}>{PUBLIC_LEGAL_CONTACT.privacyEmail}</a>. Removal does not ensure complete deletion where another person copied or reposted it, another law requires retention, it has been anonymized, it came from a different person or public source, or it remains in a restricted backup.</p>
        <p>A guardian may ask to review, correct, delete, or stop further collection of a minor's information and may withdraw guardian consent, subject to identity and relationship verification.</p>
      </LegalSection>

      <LegalSection id="rights" title="13. Your choices and requests">
        <p>Depending on your relationship with SwimAhead and applicable law, you can:</p>
        <ul className={legalListClassName}>
          <li>Review and correct editable account, profile, time, board, roster, and workspace information through the Service.</li>
          <li>Revoke an active swimmer-program share or withdraw guardian consent for future sharing.</li>
          <li>Disconnect a Google or Microsoft mailbox and remove its stored credentials from active use.</li>
          <li>Cancel a coach subscription separately from deleting the account.</li>
          <li>Request access to, correction of, a portable copy of, or deletion of personal information associated with you.</li>
          <li>Request removal of minor-posted content or correction of a public-source recruit record.</li>
          <li>Opt out of marketing email without losing necessary account, security, or billing messages.</li>
        </ul>
        <p>
          Send a request to {" "}
          <a className={legalLinkClassName} href={mailto(PUBLIC_LEGAL_CONTACT.privacyEmail, "SwimAhead privacy request")}>
            {PUBLIC_LEGAL_CONTACT.privacyEmail}
          </a>.
          {" "}Describe the request and the email or profile involved. SwimAhead may verify identity, authority, or guardian relationship before disclosing or changing data. We may deny or limit a request where law permits, including to protect another person, preserve security or fraud records, honor legal retention, or retain data that does not identify you.
        </p>
        <p>Authorized agents should identify the person represented and provide proof of authority. You may appeal a denied request by replying with "Privacy appeal" in the subject line.</p>
      </LegalSection>

      <LegalSection id="communications" title="14. Communications">
        <p>
          Service messages can include questionnaire or workflow notices, receipts, payment failures, renewal reminders, policy notices, and security communications. These are not marketing messages and may be necessary to operate an account or subscription.
        </p>
        <p>Marketing messages, if offered, include an unsubscribe method. A user who directs recruiting outreach is responsible for recipient permission and legally required opt-out handling under the Terms.</p>
      </LegalSection>

      <LegalSection id="location" title="15. Processing location">
        <p>
          SwimAhead is designed primarily for United States college recruiting. Its providers can process information in the United States and other locations where they operate. Privacy protections and government-access rules may differ between locations.
        </p>
      </LegalSection>

      <LegalSection id="changes" title="16. Changes to this Policy">
        <p>
          SwimAhead may update this Policy when data practices, providers, features, or legal requirements change. The effective date and version appear at the top. Material changes will be communicated through the Service, email, or another method reasonably designed to reach affected users before they apply where required.
        </p>
      </LegalSection>

      <LegalSection id="contact" title="17. Privacy contact">
        <p>
          Send privacy questions or requests to {" "}
          <a className={legalLinkClassName} href={mailto(PUBLIC_LEGAL_CONTACT.privacyEmail, "SwimAhead privacy request")}>
            {PUBLIC_LEGAL_CONTACT.privacyEmail}
          </a>.
        </p>
        {PUBLIC_LEGAL_CONTACT.postalAddress ? (
          <address className="not-italic">Postal address: {PUBLIC_LEGAL_CONTACT.postalAddress}</address>
        ) : null}
        <p>
          Billing-specific choices are explained in the {" "}
          <Link className={legalLinkClassName} href="/billing-policy">Billing, Cancellation, and Refund Policy</Link>.
        </p>
      </LegalSection>
    </LegalPageFrame>
  );
}
