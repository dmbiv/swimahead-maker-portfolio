import type { ReactNode } from "react";
import Link from "@/components/app-link";
import {
  BILLING_POLICY_EFFECTIVE_DATE,
  BILLING_POLICY_VERSION,
  LEGAL_EFFECTIVE_DATE,
  LEGAL_VERSION,
  PRIVACY_EFFECTIVE_DATE,
  PRIVACY_VERSION,
  PUBLIC_LEGAL_CONTACT,
  TERMS_EFFECTIVE_DATE,
  TERMS_VERSION,
  mailto,
} from "@/lib/legal";

export type LegalRoute = "/legal" | "/terms" | "/privacy" | "/billing-policy";

const LEGAL_LINKS: ReadonlyArray<{ href: LegalRoute; label: string }> = [
  { href: "/legal", label: "Legal center" },
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/billing-policy", label: "Billing" },
];

const LEGAL_DOCUMENT_METADATA: Record<LegalRoute, { effectiveDate: string; version: string }> = {
  "/legal": { effectiveDate: LEGAL_EFFECTIVE_DATE, version: LEGAL_VERSION },
  "/terms": { effectiveDate: TERMS_EFFECTIVE_DATE, version: TERMS_VERSION },
  "/privacy": { effectiveDate: PRIVACY_EFFECTIVE_DATE, version: PRIVACY_VERSION },
  "/billing-policy": {
    effectiveDate: BILLING_POLICY_EFFECTIVE_DATE,
    version: BILLING_POLICY_VERSION,
  },
};

export function LegalLinks({
  current,
  className = "",
}: {
  current?: LegalRoute;
  className?: string;
}) {
  return (
    <nav aria-label="Legal policies" className={className}>
      {LEGAL_LINKS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={current === item.href ? "page" : undefined}
          className="text-sm text-ink-2 underline-offset-4 hover:text-ink hover:underline aria-[current=page]:font-semibold aria-[current=page]:text-accent-2"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export function LegalFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-8 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="font-semibold text-ink">{PUBLIC_LEGAL_CONTACT.operatorName}</p>
          <p className="mt-1 text-xs text-ink-3">
            Questions: {" "}
            <a
              className="text-accent-2 underline underline-offset-2"
              href={mailto(PUBLIC_LEGAL_CONTACT.supportEmail, "SwimAhead support")}
            >
              {PUBLIC_LEGAL_CONTACT.supportEmail}
            </a>
          </p>
        </div>
        <LegalLinks className="flex flex-wrap gap-x-5 gap-y-2" />
      </div>
    </footer>
  );
}

export function LegalPageFrame({
  current,
  title,
  description,
  children,
}: {
  current: LegalRoute;
  title: string;
  description: string;
  children: ReactNode;
}) {
  const documentMetadata = LEGAL_DOCUMENT_METADATA[current];
  return (
    <div className="min-h-screen bg-paper">
      <a className="skip-link" href="#legal-content">Skip to policy</a>
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/" className="brand-name" aria-label="SwimAhead home">
            <span className="brand-name-a">Swim</span><span className="brand-name-b">Ahead</span>
          </Link>
          <nav aria-label="Public navigation" className="flex items-center gap-4">
            <Link className="text-sm font-medium text-accent-2 hover:underline" href="/for-coaches">
              For coaches
            </Link>
            <Link className="text-sm text-ink-2 hover:text-ink" href="/sign-in">
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <main id="legal-content" className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <header className="max-w-3xl border-b border-line pb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent-2">Legal</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-ink-2">{description}</p>
          <p className="mt-4 font-data text-xs text-ink-3">
            Effective {documentMetadata.effectiveDate} · Version {documentMetadata.version}
          </p>
        </header>

        <div className="mt-8 grid gap-10 lg:grid-cols-[190px_minmax(0,760px)] lg:items-start">
          <aside className="lg:sticky lg:top-6">
            <LegalLinks current={current} className="flex flex-wrap gap-x-4 gap-y-3 lg:flex-col" />
          </aside>
          <article className="min-w-0 space-y-9">{children}</article>
        </div>
      </main>

      <LegalFooter />
    </div>
  );
}

export function LegalSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-6 border-t border-line pt-8 first:border-t-0 first:pt-0">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <div className="mt-4 space-y-4 text-sm leading-7 text-ink-2">{children}</div>
    </section>
  );
}

export function LegalNotice({ children }: { children: ReactNode }) {
  return (
    <div className="border-l-2 border-accent bg-accent/5 px-4 py-3 text-sm leading-6 text-ink-2">
      {children}
    </div>
  );
}

export const legalListClassName = "list-disc space-y-2 pl-5 marker:text-ink-3";
export const legalOrderedListClassName = "list-decimal space-y-2 pl-5 marker:font-data marker:text-ink-3";
export const legalLinkClassName = "font-medium text-accent-2 underline underline-offset-2";
