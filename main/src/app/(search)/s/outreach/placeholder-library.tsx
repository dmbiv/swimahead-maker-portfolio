"use client";

import {
  OUTREACH_PLACEHOLDERS,
  OUTREACH_PLACEHOLDER_GROUP_LABELS,
  OUTREACH_PLACEHOLDER_GROUPS,
  type OutreachPlaceholder,
} from "@/lib/swimmer-outreach";

export function PlaceholderLibrary({ onInsert, allowResults = true }: { onInsert: (key: OutreachPlaceholder) => void; allowResults?: boolean }) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-xs font-semibold">Merge fields</h3>
        <p className="mt-0.5 text-[11px] leading-5 text-ink-3">Insert a field at the cursor in the last focused box.</p>
      </div>
      {OUTREACH_PLACEHOLDER_GROUPS.map((group) => {
        const placeholders = OUTREACH_PLACEHOLDERS.filter((placeholder) => placeholder.group === group && (allowResults || placeholder.key !== "best_times"));
        if (placeholders.length === 0) return null;
        return <div key={group}>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-3">{OUTREACH_PLACEHOLDER_GROUP_LABELS[group]}</p>
          <div className="flex flex-wrap gap-1.5">
            {placeholders.map((placeholder) => (
              <button
                key={placeholder.key}
                type="button"
                title={placeholder.description}
                onClick={() => onInsert(placeholder.key)}
                className={`rounded-full border px-2.5 py-1 text-[10px] font-medium transition-colors hover:border-accent hover:text-accent ${placeholder.key === "best_times" ? "border-accent-2/40 bg-accent-2/5 text-accent-2" : "border-line bg-surface text-ink-2"}`}
              >
                {placeholder.label}
              </button>
            ))}
          </div>
        </div>;
      })}
    </div>
  );
}
