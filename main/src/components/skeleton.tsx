import type { CSSProperties, ReactNode } from "react";


export function Skel({
  w,
  h = 14,
  className = "",
  radius,
}: {
  w?: number | string;
  h?: number | string;
  className?: string;
  radius?: number | string;
}) {
  const style: CSSProperties = {
    width: typeof w === "number" ? `${w}px` : w,
    height: typeof h === "number" ? `${h}px` : h,
  };
  if (radius !== undefined) style.borderRadius = typeof radius === "number" ? `${radius}px` : radius;
  return <span className={`wr-skel ${className}`} style={style} aria-hidden />;
}

export function SkelHeading({ subtitle = false }: { subtitle?: boolean }) {
  return (
    <div className="space-y-2">
      <Skel w="min(240px, 55%)" h={22} />
      {subtitle && <Skel w="min(360px, 80%)" h={13} />}
    </div>
  );
}

export function SkelCard({ lines = 3, className = "" }: { lines?: number; className?: string }) {
  return (
    <div className={`wr-card space-y-2.5 p-4 sm:p-5 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skel key={i} w={i === lines - 1 ? "60%" : "100%"} h={13} />
      ))}
    </div>
  );
}

export function SkelCoachHeader({ titleWidth = "min(300px, 62%)" }: { titleWidth?: string }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-2">
        <Skel w={titleWidth} h={26} />
        <Skel w="min(240px, 48%)" h={13} />
      </div>
      <Skel w={186} h={30} radius="var(--radius)" />
    </div>
  );
}

export function SkelList({ rows = 5 }: { rows?: number }) {
  return (
    <div className="wr-card p-0 divide-y divide-line/60">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2.5">
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skel w={`${55 + ((i * 7) % 35)}%`} h={13} />
            <Skel w={`${30 + ((i * 5) % 25)}%`} h={11} />
          </div>
          <Skel w={64} h={24} radius="var(--radius)" />
        </div>
      ))}
    </div>
  );
}

export function SkelTable({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="wr-card p-0 overflow-hidden">
      <div className="flex gap-4 border-b border-line px-3 py-2">
        {Array.from({ length: cols }).map((_, i) => (
          <Skel key={i} w={`${100 / cols}%`} h={11} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 border-b border-line/60 px-3 py-2.5">
          {Array.from({ length: cols }).map((_, c) => (
            <Skel key={c} w={`${100 / cols}%`} h={13} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function WorkspaceLoadingSurface({
  children,
  label = "Loading page",
  immediate = false,
}: {
  children: ReactNode;
  label?: string;
  immediate?: boolean;
}) {
  return (
    <div
      className="workspace-loading-surface"
      role="status"
      aria-live="polite"
      aria-label={label}
      data-navigation-skeleton={immediate ? true : undefined}
    >
      <span className="sr-only">{label}…</span>
      <div className="workspace-loading-surface-inner" aria-hidden>{children}</div>
    </div>
  );
}
