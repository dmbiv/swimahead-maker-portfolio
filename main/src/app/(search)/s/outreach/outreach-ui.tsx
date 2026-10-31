import Link from "@/components/app-link";

export function FolderMark({ className = "" }: { className?: string }) {
  return (
    <span className={`relative block h-9 w-11 rounded-[6px] rounded-tl-[3px] bg-accent/15 text-accent ${className}`} aria-hidden>
      <span className="absolute -top-1 left-1 h-2 w-5 rounded-t-[4px] bg-accent/15" />
      <span className="absolute inset-x-2 bottom-2 h-px bg-accent/40" />
    </span>
  );
}

export function FileMark({ className = "" }: { className?: string }) {
  return (
    <span className={`relative block h-10 w-8 rounded-[4px] border border-line-strong bg-surface ${className}`} aria-hidden>
      <span className="absolute inset-x-1.5 top-3 h-px bg-line-strong" />
      <span className="absolute inset-x-1.5 top-5 h-px bg-line" />
      <span className="absolute inset-x-1.5 top-7 h-px bg-line" />
    </span>
  );
}

export function OutreachBreadcrumbs({ items }: {
  items: Array<{ label: string; href?: string }>;
}) {
  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-ink-3">
      <Link href="/s/outreach/campaigns" className="hover:text-accent">Campaigns</Link>
      {items.map((item) => (
        <span key={`${item.href ?? "current"}:${item.label}`} className="flex min-w-0 items-center gap-1.5">
          <span aria-hidden>/</span>
          {item.href ? <Link href={item.href} className="truncate hover:text-accent">{item.label}</Link> : <span className="truncate text-ink-2">{item.label}</span>}
        </span>
      ))}
    </nav>
  );
}
