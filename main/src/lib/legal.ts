export const TERMS_VERSION = "2026-07-23";
export const PRIVACY_VERSION = "2026-07-24";
export const BILLING_POLICY_VERSION = "2026-07-23";
export const LEGAL_VERSION = PRIVACY_VERSION;
export const TERMS_EFFECTIVE_DATE = "July 23, 2026";
export const PRIVACY_EFFECTIVE_DATE = "July 24, 2026";
export const BILLING_POLICY_EFFECTIVE_DATE = "July 23, 2026";
export const LEGAL_EFFECTIVE_DATE = PRIVACY_EFFECTIVE_DATE;
export const LEGAL_EFFECTIVE_DATE_ISO = PRIVACY_VERSION;

const DEFAULT_CONTACT_EMAIL = "db4atgm@gmail.com";

function configuredValue(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  return value || fallback;
}

function configuredEmail(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  return value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
    ? value.toLowerCase()
    : fallback;
}

function optionalValue(name: string): string | null {
  return process.env[name]?.trim() || null;
}

const supportEmail = configuredEmail(
  "NEXT_PUBLIC_SUPPORT_EMAIL",
  DEFAULT_CONTACT_EMAIL,
);

export const PUBLIC_LEGAL_CONTACT = Object.freeze({
  operatorName: configuredValue("NEXT_PUBLIC_LEGAL_OPERATOR_NAME", "SwimAhead"),
  supportEmail,
  privacyEmail: configuredEmail("NEXT_PUBLIC_PRIVACY_EMAIL", supportEmail),
  billingEmail: configuredEmail("NEXT_PUBLIC_BILLING_EMAIL", supportEmail),
  postalAddress: optionalValue("NEXT_PUBLIC_LEGAL_POSTAL_ADDRESS"),
});

export const SUPPORT_EMAIL = PUBLIC_LEGAL_CONTACT.supportEmail;
export const PRIVACY_EMAIL = PUBLIC_LEGAL_CONTACT.privacyEmail;
export const BILLING_EMAIL = PUBLIC_LEGAL_CONTACT.billingEmail;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isLaunchPlaceholder(value: string): boolean {
  return /(^|\b)(your|placeholder|todo|tbd)(\b|[-_])/i.test(value) || /\.example$/i.test(value);
}

export function hasExplicitLegalConfiguration(
  environment: Record<string, string | undefined> = process.env,
): boolean {
  const operator = environment.NEXT_PUBLIC_LEGAL_OPERATOR_NAME?.trim() ?? "";
  const address = environment.NEXT_PUBLIC_LEGAL_POSTAL_ADDRESS?.trim() ?? "";
  const emails = [
    environment.NEXT_PUBLIC_SUPPORT_EMAIL,
    environment.NEXT_PUBLIC_PRIVACY_EMAIL,
    environment.NEXT_PUBLIC_BILLING_EMAIL,
  ].map((value) => value?.trim() ?? "");
  return operator.length >= 2 &&
    address.length >= 12 &&
    !isLaunchPlaceholder(operator) &&
    !isLaunchPlaceholder(address) &&
    emails.every((email) => EMAIL_PATTERN.test(email) && !isLaunchPlaceholder(email));
}

export function isPersonalDataCollectionConfigured(
  environment: Record<string, string | undefined> = process.env,
): boolean {
  return environment.NODE_ENV !== "production" || hasExplicitLegalConfiguration(environment);
}

export const COACH_BILLING_TERMS = Object.freeze({
  currency: "USD",
  firstTermMonths: 12,
  firstTermPrice: 49,
  renewalTermMonths: 12,
  renewalPrice: 99,
  hasFreeTrial: false,
});

export const FIRST_TERM_DISCLOSURE =
  "First 12-month term: $49 USD plus applicable taxes due today. No free trial.";
export const COACH_AUTO_RENEW_DISCLOSURE =
  "After the first 12-month term, the subscription automatically renews every 12 months at $99 USD plus applicable taxes unless canceled before renewal.";
export const COACH_CHECKOUT_DISCLOSURE =
  `${FIRST_TERM_DISCLOSURE} ${COACH_AUTO_RENEW_DISCLOSURE}`;
export const STANDARD_TERM_DISCLOSURE =
  "12-month subscription: $99 USD plus applicable taxes due today. No free trial.";
export const STANDARD_AUTO_RENEW_DISCLOSURE =
  "The subscription automatically renews every 12 months at $99 USD plus applicable taxes unless canceled before renewal.";
export const STANDARD_CHECKOUT_DISCLOSURE =
  `${STANDARD_TERM_DISCLOSURE} ${STANDARD_AUTO_RENEW_DISCLOSURE}`;

export function mailto(email: string, subject?: string): string {
  const query = subject ? `?subject=${encodeURIComponent(subject)}` : "";
  return `mailto:${email}${query}`;
}
