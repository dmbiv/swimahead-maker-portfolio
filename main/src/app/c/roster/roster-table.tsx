"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { removeRosterSwimmer, type RosterSwimmer } from "@/lib/coach-roster";
import { rosterClassDisplay } from "@/lib/roster-season";
import { fmtClock } from "@/lib/time";
import { EVENT_LABELS } from "@/lib/events";
import type { EventCode } from "@/lib/types";

export function RosterTable({ roster }: { roster: RosterSwimmer[] }) {
  const router = useRouter();
  const [exitingIds, setExitingIds] = useState<Set<string>>(new Set());
  const [optimisticallyRemovedIds, setOptimisticallyRemovedIds] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);
  const removalTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const confirmedRemovals = useRef(new Set<string>());
  const visibleRoster = roster.filter((swimmer) => !optimisticallyRemovedIds.has(swimmer.id));

  useEffect(() => () => {
    for (const timer of removalTimers.current.values()) clearTimeout(timer);
    removalTimers.current.clear();
    confirmedRemovals.current.clear();
  }, []);

  function restore(swimmer: RosterSwimmer, error?: string | null) {
    const pendingTimer = removalTimers.current.get(swimmer.id);
    if (pendingTimer) clearTimeout(pendingTimer);
    removalTimers.current.delete(swimmer.id);
    confirmedRemovals.current.delete(swimmer.id);
    setExitingIds((current) => {
      const next = new Set(current);
      next.delete(swimmer.id);
      return next;
    });
    setOptimisticallyRemovedIds((current) => {
      const next = new Set(current);
      next.delete(swimmer.id);
      return next;
    });
    setMessage(error ?? `Couldn’t remove ${swimmer.fullName}. The swimmer was restored.`);
  }

  function remove(swimmer: RosterSwimmer) {
    if (exitingIds.has(swimmer.id) || optimisticallyRemovedIds.has(swimmer.id)) return;
    setMessage(null);
    setExitingIds((current) => new Set(current).add(swimmer.id));

    const timer = setTimeout(() => {
      removalTimers.current.delete(swimmer.id);
      setOptimisticallyRemovedIds((current) => new Set(current).add(swimmer.id));
      setExitingIds((current) => {
        const next = new Set(current);
        next.delete(swimmer.id);
        return next;
      });
      if (confirmedRemovals.current.delete(swimmer.id)) router.refresh();
    }, 140);
    removalTimers.current.set(swimmer.id, timer);

    void removeRosterSwimmer(swimmer.id).then((result) => {
      if (result.ok) {
        if (removalTimers.current.has(swimmer.id)) confirmedRemovals.current.add(swimmer.id);
        else router.refresh();
        return;
      }
      restore(swimmer, result.error);
    }, () => restore(swimmer));
  }

  return (
    <div className="space-y-2">
      <div className="wr-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--line)] text-left text-ink-3">
              <th className="p-3 font-medium">Swimmer</th>
              <th className="p-3 font-medium">Class</th>
              <th className="p-3 font-medium">Top events (SCY)</th>
              <th className="p-3 font-medium text-right">Best</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {visibleRoster.map((swimmer) => (
              <Row
                key={swimmer.id}
                s={swimmer}
                removing={exitingIds.has(swimmer.id)}
                onRemove={() => remove(swimmer)}
              />
            ))}
            {visibleRoster.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-5 text-center text-sm text-ink-3">No swimmers on this roster.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <p className="min-h-5 text-xs text-bad" role={message ? "alert" : undefined} aria-live="polite">{message}</p>
    </div>
  );
}

function Row({ s, removing, onRemove }: { s: RosterSwimmer; removing: boolean; onRemove: () => void }) {
  const scy = s.times.filter((t) => t.course === "SCY").slice(0, 3);
  const year = rosterClassDisplay(s);

  return (
    <tr
      className={`border-b border-[var(--line)] transition-[opacity,transform] duration-150 ease-out last:border-0 motion-reduce:transition-none ${removing ? "translate-x-1 opacity-0" : "translate-x-0 opacity-100"}`}
    >
      <td className="p-3">
        <div className="font-medium">{s.fullName}</div>
        {s.swimcloudUrl ? (
          <a href={s.swimcloudUrl} target="_blank" rel="noreferrer" className="text-xs text-[var(--accent-2)] underline underline-offset-2">
            SwimCloud
          </a>
        ) : null}
      </td>
      <td className="p-3 tabular-nums text-ink-2">
        <div>{year.label}</div>
        {year.detail ? <div className="text-xs text-ink-3">{year.detail}</div> : null}
        {year.stale ? <div className="text-xs text-ink-3">As imported</div> : null}
      </td>
      <td className="p-3 text-ink-2">
        {scy.length === 0 ? (
          <span className="text-ink-3">No SCY times</span>
        ) : (
          <span className="flex flex-wrap gap-x-3 gap-y-0.5">
            {scy.map((t) => (
              <span key={`${t.event}-${t.course}`} className="whitespace-nowrap">
                {EVENT_LABELS[t.event as EventCode] ?? t.event} {fmtClock(t.seconds)}
                {t.score != null ? <span className="ml-1 text-xs text-ink-3">({t.score})</span> : null}
              </span>
            ))}
          </span>
        )}
      </td>
      <td className="p-3 text-right tabular-nums">{s.topScore ?? "Not scored"}</td>
      <td className="p-3 text-right">
        <button
          type="button"
          disabled={removing}
          className="text-xs text-ink-3 underline underline-offset-2 hover:text-ink-1"
          onClick={onRemove}
        >
          {removing ? "Removing…" : "Remove"}
        </button>
      </td>
    </tr>
  );
}
