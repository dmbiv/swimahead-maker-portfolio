"use client";

import Link from "./app-link";
import { useEffect, useState } from "react";
import { useOptimisticPathname } from "./navigation-feedback";

function isActivePath(path: string, href: string) {
  if (href === "/") {
    return path === "/" || path === "/s/explore" || path.startsWith("/s/explore/") || path.startsWith("/s/programs/");
  }
  return path === href ||
    (href !== "/c" && href !== "/s" && path.startsWith(href)) ||
    (href === "/s/explore" && path.startsWith("/s/programs/")) ||
    (href === "/c/pipeline" && path.startsWith("/c/recruits/"));
}

export function NavLinks({
  items,
  onNavigate,
}: {
  items: { href: string; label: string }[];
  onNavigate?: () => void;
}) {
  const path = useOptimisticPathname();
  return (
    <>
      {items.map((it) => {
        const active = isActivePath(path, it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            className="nav-link whitespace-nowrap"
            data-active={active}
            aria-current={active ? "page" : undefined}
            onClick={onNavigate}
          >
            {it.label}
          </Link>
        );
      })}
    </>
  );
}

export function MobileNav({
  primaryItems,
  secondaryItems,
}: {
  primaryItems: { href: string; label: string }[];
  secondaryItems: { href: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);
  return (
    <>
      <button
        type="button"
        className="mobile-menu-button"
        aria-expanded={open}
        aria-controls="mobile-primary-nav"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? "Close" : "Menu"}
      </button>
      {open && <button type="button" className="mobile-nav-backdrop" aria-label="Close navigation" onClick={() => setOpen(false)} />}
      <nav id="mobile-primary-nav" className="mobile-nav wr-scroll" aria-label="Primary navigation" hidden={!open}>
        <NavLinks items={primaryItems} onNavigate={() => setOpen(false)} />
        {secondaryItems.length > 0 && <div className="mobile-nav-section">Tools</div>}
        {secondaryItems.length > 0 && <NavLinks items={secondaryItems} onNavigate={() => setOpen(false)} />}
      </nav>
    </>
  );
}

export function MobileDock({ items }: { items: { href: string; label: string; shortLabel?: string }[] }) {
  const path = useOptimisticPathname();
  return (
    <nav className="mobile-dock" aria-label="Swimmer shortcuts">
      {items.map((item) => {
        const active = isActivePath(path, item.href);
        return (
          <Link key={item.href} href={item.href} className="mobile-dock-link" data-active={active} aria-current={active ? "page" : undefined}>
            <span className="mobile-dock-indicator" aria-hidden />
            <span>{item.shortLabel ?? item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
