import Link from "./app-link";
import { cache, Suspense } from "react";
import { MobileDock, MobileNav, NavLinks } from "./shell-client";
import { CommandK, type CmdItem } from "./command-k";
import { getOptionalAuthContext } from "@/lib/auth";
import { signOutAction } from "@/app/auth/actions";
import { Skel } from "./skeleton";
import { ImmediateNavigationSkeleton } from "./navigation-feedback";
import { LegalFooter } from "./legal";

export const COACH_NAV_PRIMARY = [
  { href: "/c", label: "Overview" },
  { href: "/c/roster", label: "Roster" },
  { href: "/c/campaigns", label: "Recruiting" },
  { href: "/c/questionnaires", label: "Questionnaires" },
  { href: "/c/outreach", label: "Outreach" },
  { href: "/c/settings", label: "Settings" },
] as const;

export const COACH_NAV_SECONDARY = [
  { href: "/s/about", label: "About" },
] as const;

export const SWIMMER_NAV_PRIMARY = [
  { href: "/s", label: "Home" },
  { href: "/s/times", label: "My times" },
  { href: "/s/explore", label: "Find programs" },
  { href: "/s/board", label: "My programs" },
  { href: "/s/outreach/campaigns", label: "Outreach" },
] as const;

export const SWIMMER_NAV_SECONDARY = [
  { href: "/s/plan", label: "Recruiting dates" },
  { href: "/s/profile", label: "Profile" },
  { href: "/s/about", label: "About" },
] as const;

export const SWIMMER_PUBLIC_NAV = [
  { href: "/", label: "Search" },
  { href: "/s/about", label: "About" },
] as const;

export function BrandLockup({ href = "/" }: { compact?: boolean; href?: string }) {
  return (
    <Link href={href} className="brand-lockup" aria-label="SwimAhead home">
      <span className="brand-mark" aria-hidden />
      <span className="brand-name">
        <span className="brand-name-a">Swim</span><span className="brand-name-b">Ahead</span>
      </span>
    </Link>
  );
}

export function Shell({
  persona,
  children,
  subtitle,
}: {
  persona: "coach" | "swimmer";
  subtitle: React.ReactNode;
  children: React.ReactNode;
}) {
  const home = persona === "coach" ? "/c" : "/s";
  const fallbackWorkspaceName = persona === "coach" ? "Coach portal" : "Workspace";

  return (
    <div className="app-shell">
      <a className="skip-link" href="#workspace">Skip to workspace</a>

      <aside className="app-rail" aria-label={`${persona} workspace navigation`}>
        <div className="rail-head"><BrandLockup href={home} /></div>
        <Suspense fallback={<div className="rail-context">{fallbackWorkspaceName}</div>}>
          <ShellWorkspaceName persona={persona} />
        </Suspense>
        <nav className="rail-nav" aria-label="Primary navigation">
          <Suspense fallback={<DefaultNav persona={persona} />}>
            <ShellNav persona={persona} variant="rail" />
          </Suspense>
        </nav>
        <div className="rail-tools">
          <div className="command-key"><span>Quick search</span><kbd>⌘ K</kbd></div>
          <Suspense fallback={<AccountSkeleton />}>
            <ShellAccount persona={persona} variant="rail" />
          </Suspense>
        </div>
      </aside>

      <div className="app-body">
        <Suspense fallback={null}>
          <ShellDesktopHeader persona={persona} subtitle={subtitle} />
        </Suspense>

        <header className="mobile-head">
          <div className="mobile-bar">
            <BrandLockup compact href={home} />
            <Suspense fallback={<span className="mobile-workspace">{fallbackWorkspaceName}</span>}>
              <ShellWorkspaceName persona={persona} as="mobile-workspace" />
            </Suspense>
            {persona === "swimmer" ? (
              <Link href="/for-coaches" className="pub-nav-coach mobile-coach-link">For coaches</Link>
            ) : null}
            <Suspense fallback={<span className="mobile-sign-in" aria-hidden><Skel w={44} h={12} /></span>}>
              <ShellAccount persona={persona} variant="mobile" />
            </Suspense>
            <Suspense fallback={<span className="mobile-menu-button" aria-hidden>Menu</span>}>
              <ShellMobileNav persona={persona} />
            </Suspense>
          </div>
        </header>

        <Suspense fallback={null}>
          <ImmediateNavigationSkeleton />
        </Suspense>
        <main id="workspace" className="app-main">{children}</main>
        <LegalFooter />
      </div>
      {persona === "swimmer" && (
        <Suspense fallback={null}>
          <ShellMobileDock />
        </Suspense>
      )}
      <Suspense fallback={<CommandK items={[]} />}>
        <ShellCommandK persona={persona} />
      </Suspense>
    </div>
  );
}


const shellState = cache(async (persona: "coach" | "swimmer") => {
  const auth = await getOptionalAuthContext();
  const ownsWorkspace = auth?.accountType === persona && auth.onboardingCompleted;
  const primaryNav = persona === "coach"
    ? [...COACH_NAV_PRIMARY]
    : ownsWorkspace
      ? [...SWIMMER_NAV_PRIMARY]
      : [...SWIMMER_PUBLIC_NAV];
  const secondaryNav = persona === "coach"
    ? [...COACH_NAV_SECONDARY]
    : ownsWorkspace
      ? [...SWIMMER_NAV_SECONDARY]
      : [];
  const workspaceName = persona === "coach"
    ? "Coach portal"
    : ownsWorkspace ? "Swimmer workspace" : "College search";
  const home = persona === "coach" ? "/c" : "/s";
  const accountHref = auth
    ? auth.accountType === "coach" ? "/c" : "/s/profile"
    : `/sign-in?next=${encodeURIComponent(home)}`;
  const accountLabel = auth
    ? auth.accountType === "coach" && persona === "swimmer"
      ? "Coach portal"
      : auth.displayName || auth.email || "Account"
    : "Sign in";
  return { auth, ownsWorkspace, primaryNav, secondaryNav, workspaceName, accountHref, accountLabel };
});

async function ShellWorkspaceName({
  persona,
  as = "rail-context",
}: {
  persona: "coach" | "swimmer";
  as?: string;
}) {
  const { workspaceName } = await shellState(persona);
  return <div className={as}>{workspaceName}</div>;
}

async function ShellDesktopHeader({
  persona,
  subtitle,
}: {
  persona: "coach" | "swimmer";
  subtitle: React.ReactNode;
}) {
  const { auth, workspaceName, accountHref, accountLabel } = await shellState(persona);
  if (auth) return null;

  return (
    <header className="workspace-head">
      <div className="min-w-0">
        <div className="workspace-head-label">{workspaceName}</div>
        <div className="workspace-head-name">{subtitle}</div>
      </div>
      <div className="workspace-account-actions">
        {persona === "swimmer" && <Link href="/for-coaches" className="pub-nav-coach">For coaches</Link>}
        <Link href={accountHref} className="sign-in-link">{accountLabel}</Link>
      </div>
    </header>
  );
}

async function ShellNav({ persona, variant }: { persona: "coach" | "swimmer"; variant: "rail" }) {
  const { primaryNav, secondaryNav } = await shellState(persona);
  void variant;
  return (
    <>
      <NavLinks items={primaryNav} />
      {secondaryNav.length > 0 && <div className="rail-section-label">Tools</div>}
      <NavLinks items={secondaryNav} />
    </>
  );
}

async function ShellMobileNav({ persona }: { persona: "coach" | "swimmer" }) {
  const { primaryNav, secondaryNav } = await shellState(persona);
  return <MobileNav primaryItems={primaryNav} secondaryItems={secondaryNav} />;
}

async function ShellAccount({
  persona,
  variant,
}: {
  persona: "coach" | "swimmer";
  variant: "rail" | "mobile";
}) {
  const { auth, accountHref, accountLabel } = await shellState(persona);

  if (variant === "mobile") {
    return (
      <Link href={accountHref} className="mobile-sign-in">
        {auth ? (auth.accountType === "coach" ? "Coach" : "Account") : "Sign in"}
      </Link>
    );
  }

  return (
    <>
      <Link href={accountHref} className="sign-in-link">
        <span>{accountLabel}</span><span>{auth ? "Open" : "Account"}</span>
      </Link>
      {auth && (
        <form action={signOutAction}>
          <button type="submit" className="rail-sign-out">Sign out</button>
        </form>
      )}
    </>
  );
}

async function ShellCommandK({ persona }: { persona: "coach" | "swimmer" }) {
  const { primaryNav, secondaryNav } = await shellState(persona);
  const nav = [...primaryNav, ...secondaryNav];
  const commandItems: CmdItem[] = nav.map((item) => ({
    group: persona === "coach" ? "Coach" : "Swimmer",
    label: item.label,
    href: item.href,
  }));
  return <CommandK items={commandItems} />;
}

async function ShellMobileDock() {
  const { ownsWorkspace } = await shellState("swimmer");
  if (!ownsWorkspace) return null;
  return (
    <MobileDock items={[
      { href: "/s", label: "Overview", shortLabel: "Home" },
      { href: "/s/times", label: "Times" },
      { href: "/s/explore", label: "Programs", shortLabel: "Search" },
      { href: "/s/board", label: "My programs", shortLabel: "Saved" },
      { href: "/s/outreach/campaigns", label: "Outreach" },
    ]} />
  );
}


function DefaultNav({ persona }: { persona: "coach" | "swimmer" }) {
  const items = persona === "coach" ? [...COACH_NAV_PRIMARY] : [...SWIMMER_PUBLIC_NAV];
  return <NavLinks items={items} />;
}

function AccountSkeleton() {
  return (
    <span className="sign-in-link" aria-hidden>
      <Skel w="60%" h={12} /><Skel w={28} h={10} />
    </span>
  );
}
