import type { RosterAnalysis, EventStrength } from "@/lib/coach-roster-analysis";

export function StrengthsPanel({ analysis }: { analysis: RosterAnalysis }) {
  const maxGroupScore = Math.max(1, ...analysis.groups.map((g) => g.bestScore ?? 0));

  return (
    <div className="space-y-4">
      <div className="wr-card p-4">
        <h2 className="text-base font-semibold">Roster strengths</h2>
        <p className="mt-0.5 text-xs text-ink-3">
          Best College Index score per stroke group, with roster depth (swimmers contributing at the college level).
        </p>
        <ul className="mt-3 space-y-2">
          {analysis.groups.map((g) => (
            <li key={g.group} className="grid grid-cols-[7rem_1fr_auto] items-center gap-3 text-sm">
              <span className="text-ink-2">{g.label}</span>
              <span className="h-2 rounded bg-[var(--sunken)]">
                <span
                  className="block h-2 rounded bg-[var(--accent,#3b82f6)]"
                  style={{ width: `${Math.round(((g.bestScore ?? 0) / maxGroupScore) * 100)}%` }}
                />
              </span>
              <span className="tabular-nums text-ink-3">
                {g.bestScore != null ? `${g.bestScore} · ${g.depth} deep` : "Not scored"}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="wr-card p-4">
          <h3 className="text-sm font-semibold">Top events</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {analysis.strengths.length === 0 ? (
              <li className="text-ink-3">No scored times yet.</li>
            ) : (
              analysis.strengths.map((e) => <EventLine key={e.event} e={e} />)
            )}
          </ul>
        </div>
        <div className="wr-card p-4">
          <h3 className="text-sm font-semibold">
            Gaps to recruit <span className="font-normal text-ink-3">(relay legs first)</span>
          </h3>
          <ul className="mt-2 space-y-1 text-sm">
            {analysis.gaps.length === 0 ? (
              <li className="text-ink-3">Balanced across events.</li>
            ) : (
              analysis.gaps.map((e) => <EventLine key={e.event} e={e} gap />)
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

function EventLine({ e, gap }: { e: EventStrength; gap?: boolean }) {
  return (
    <li className="flex items-center justify-between gap-2">
      <span>
        {e.label}
        {e.isRelayLeg ? <span className="ml-1 text-[10px] uppercase tracking-wide text-ink-3">relay</span> : null}
      </span>
      <span className="tabular-nums text-ink-3">
        {gap
          ? e.topScore == null
            ? "none"
            : `thin · ${e.topScore}`
          : `${e.topScore} · ${e.topSwimmer ?? ""}`}
      </span>
    </li>
  );
}
