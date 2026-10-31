import type { Metadata } from "next";
import Link from "@/components/app-link";
import { Suspense } from "react";
import { getOptionalAuthContext } from "@/lib/auth";
import { getCoachBillingAccess } from "@/lib/coach-billing";
import { LegalFooter } from "@/components/legal";

export const metadata: Metadata = {
  title: "College Swim Coach Recruiting Software",
  description: "SwimAhead gives college swimming coaches one recruiting workspace to find swimmers, plan roster needs, manage campaigns, send outreach, and collect questionnaires.",
  alternates: { canonical: "/for-coaches" },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/for-coaches",
    siteName: "SwimAhead",
    title: "SwimAhead Coach | College Swimming Recruiting Software",
    description: "Find swimmers, plan recruiting classes, manage outreach, and collect questionnaires in one college swim coach workspace.",
  },
  twitter: {
    card: "summary",
    title: "SwimAhead Coach | College Swimming Recruiting Software",
    description: "Find swimmers, plan recruiting classes, manage outreach, and collect questionnaires in one college swim coach workspace.",
  },
};

async function CoachAccountAction() {
  const context = await getOptionalAuthContext();
  if (context?.accountType === "coach" && context.onboardingCompleted) {
    if (context.memberships.length === 0) {
      return <Link href="/onboarding" className="wr-btn wr-btn--primary">Finish coach setup</Link>;
    }
    const access = await getCoachBillingAccess(context.userId);
    return access.entitled
      ? <Link href="/c" className="wr-btn wr-btn--primary">Open coach workspace</Link>
      : <Link href="/subscribe" className="wr-btn wr-btn--primary">Start coach season</Link>;
  }
  if (context && !context.accountType) {
    return <Link href="/onboarding?role=coach" className="wr-btn wr-btn--primary">Finish coach setup</Link>;
  }
  if (context) return <Link href="/s" className="wr-btn wr-btn--primary">Open swimmer workspace</Link>;
  return <Link href="/sign-in?next=%2Fonboarding%3Frole%3Dcoach" className="wr-btn wr-btn--primary">Continue with Google</Link>;
}

export default function ForCoachesPage() {
  return (
    <div className="min-h-screen bg-[var(--paper)]">
      <header className="pub-nav">
        <Link href="/" className="pub-nav-name brand-name" aria-label="SwimAhead swimmer search">
          <span className="brand-name-a">Swim</span><span className="brand-name-b">Ahead</span>
        </Link>
        <div className="pub-nav-actions">
          <Link href="/sign-in?next=/c" className="pub-nav-link">Sign in</Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-20">
        <section className="grid items-center gap-10 lg:grid-cols-[1.3fr_0.7fr]">
          <div>
            <h1
              className="mt-5 max-w-3xl leading-tight"
              style={{ fontSize: "clamp(1.875rem, 1.35rem + 2.2vw, 3rem)" }}
            >
              One place to find, compare, and manage your next recruiting class.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-ink-2">
              Use SwimAhead to match recruits, plan roster needs, run campaigns, manage outreach, and collect questionnaires in one coach workspace.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Suspense fallback={<span className="wr-btn wr-btn--primary opacity-60">Create coach account</span>}>
                <CoachAccountAction />
              </Suspense>
              <span className="text-sm text-ink-3">$49 USD plus tax for the first 12 months · then $99 USD plus tax every 12 months</span>
            </div>
          </div>

          <aside className="wr-card p-6 sm:p-7">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-3">Coach plan</p>
            <div className="mt-3 flex items-end gap-2">
              <span className="text-5xl font-semibold tracking-tight">$49</span>
              <span className="pb-1 text-sm text-ink-2">USD plus tax, first 12 months</span>
            </div>
            <p className="mt-1 text-sm leading-6 text-ink-2">
              Renews automatically at $99 USD plus applicable tax every 12 months. Cancel before renewal in Stripe’s billing portal.
            </p>
            <p className="mt-3 text-xs leading-5 text-ink-3">
              No free trial. See the <Link href="/billing-policy" className="font-semibold text-accent-2 underline">billing, cancellation, and refund policy</Link>.
            </p>
          </aside>
        </section>

        <section className="mt-16 border-t border-line pt-10">
          <h2 className="text-2xl">Built around an actual recruiting workflow</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[
              ["Find the right swimmers", "Search over 40,000 recruits and compare prospects against your program and roster needs."],
              ["Plan each class", "Organize recruiting campaigns by class, squad, stage, priority, and next action."],
              ["Keep outreach together", "Build reviewed messages, connect your own mailbox, and track outreach. Create email templates and apply them to hundreds of recruits at once."],
              ["Collect better responses", "Publish recruit questionnaires and move promising submissions into your ledger."],
            ].map(([title, description]) => (
              <article key={title} className="wr-card p-5">
                <h3 className="text-base font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-ink-2">{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-12 wr-card flex flex-col items-start justify-between gap-5 p-6 sm:flex-row sm:items-center sm:p-8">
          <div>
            <h2 className="text-xl">Start your first 12 months for $49 USD plus applicable tax.</h2>
            <p className="mt-1 text-sm text-ink-2">Create a coach account, finish the short setup, and pay securely through Stripe.</p>
          </div>
          <Suspense fallback={<span className="wr-btn wr-btn--primary opacity-60">Get started</span>}>
            <CoachAccountAction />
          </Suspense>
        </section>
      </main>
      <LegalFooter />
    </div>
  );
}
