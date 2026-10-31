"use client";

import * as FormControl from "@/components/form-control";
import Link from "@/components/app-link";
import { memo, useMemo, useState } from "react";
import { PerformanceScoreValue } from "@/components/performance-score";
import { Badge, Select } from "@/components/ui";
import { performanceScore } from "@/lib/performance-points";
import {
  outreachEventLabel,
  renderOutreachTimes,
  type OutreachTimeConfig,
  type OutreachTimeEntry,
} from "@/lib/swimmer-outreach";
import { fmtClock, fmtDate } from "@/lib/time";
import type { Gender } from "@/lib/types";

function exactEventKey(entry: OutreachTimeEntry): string {
  return `${entry.event.trim().toUpperCase()}:${entry.course}`;
}

function resultOptionLabel(entry: OutreachTimeEntry, gender: Gender, personalBest: boolean): string {
  const score = performanceScore(entry, gender);
  return [
    outreachEventLabel(entry.event),
    `${fmtClock(entry.seconds)} ${entry.course}`,
    score ? `${score.value} ${score.shortLabel}` : "",
    personalBest ? "PB" : "",
    entry.date ? fmtDate(entry.date) : "",
    entry.meet,
  ].filter(Boolean).join(" | ");
}

function ResultIdentity({ entry, gender, personalBest }: {
  entry: OutreachTimeEntry;
  gender: Gender;
  personalBest: boolean;
}) {
  const score = performanceScore(entry, gender);
  return (
    <span className="min-w-0">
      <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <strong className="text-xs">{outreachEventLabel(entry.event)}</strong>
        <span className="font-data text-sm font-semibold">{fmtClock(entry.seconds)}</span>
        <Badge tone="neutral">{entry.course}</Badge>
        {personalBest && <Badge tone="good">PB</Badge>}
        <PerformanceScoreValue score={score} />
      </span>
      <span className="mt-0.5 block truncate text-[10px] text-ink-3">{[entry.date ? fmtDate(entry.date) : "", entry.meet].filter(Boolean).join(" | ")}</span>
    </span>
  );
}

export const ResultsBuilder = memo(function ResultsBuilder({ config, availableTimes, gender, onChange }: {
  config: OutreachTimeConfig;
  availableTimes: OutreachTimeEntry[];
  gender: Gender;
  onChange: (next: OutreachTimeConfig) => void;
}) {
  const [candidateId, setCandidateId] = useState("");
  const selectedIds = useMemo(() => new Set(config.entries.map((entry) => entry.timeId)), [config.entries]);
  const bestIds = useMemo(() => {
    const best = new Map<string, OutreachTimeEntry>();
    for (const entry of availableTimes) {
      const key = exactEventKey(entry);
      const current = best.get(key);
      if (!current || entry.seconds < current.seconds) best.set(key, entry);
    }
    return new Set([...best.values()].map((entry) => entry.timeId));
  }, [availableTimes]);
  const optionLabels = useMemo(() => new Map(availableTimes.map((entry) => [
    entry.timeId,
    resultOptionLabel(entry, gender, bestIds.has(entry.timeId)),
  ])), [availableTimes, bestIds, gender]);
  const remaining = useMemo(() => availableTimes
    .filter((entry) => !selectedIds.has(entry.timeId))
    .sort((left, right) => (
      Number(bestIds.has(right.timeId)) - Number(bestIds.has(left.timeId))
      || right.date.localeCompare(left.date)
      || left.course.localeCompare(right.course)
      || left.event.localeCompare(right.event)
      || left.seconds - right.seconds
    )), [availableTimes, bestIds, selectedIds]);
  const candidate = remaining.find((entry) => entry.timeId === candidateId) ?? remaining[0];

  const add = () => {
    if (!candidate || config.entries.length >= 8) return;
    onChange({ ...config, entries: [...config.entries, candidate] });
    setCandidateId("");
  };
  const remove = (timeId: string) => onChange({ ...config, entries: config.entries.filter((entry) => entry.timeId !== timeId) });
  const move = (index: number, offset: -1 | 1) => {
    const target = index + offset;
    if (target < 0 || target >= config.entries.length) return;
    const entries = [...config.entries];
    [entries[index], entries[target]] = [entries[target], entries[index]];
    onChange({ ...config, entries });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-xs font-semibold">Selected results <span className="font-data font-normal text-ink-3">{config.entries.length}/8</span></h3>
          <p className="mt-0.5 text-[11px] text-ink-3">Choose any logged swim, not only a personal best.</p>
        </div>
        <Link href="/s/times" className="text-[11px] font-semibold text-accent-2 hover:underline">Manage results</Link>
      </div>

      {config.entries.length > 0 && (
        <ol className="divide-y divide-line rounded-[var(--radius)] border border-line bg-surface">
          {config.entries.map((entry, index) => (
            <li key={entry.timeId} className="flex min-w-0 items-center gap-2 px-2.5 py-1.5">
              <span className="font-data w-4 shrink-0 text-[10px] text-ink-3">{index + 1}</span>
              <span className="min-w-0 flex-1"><ResultIdentity entry={entry} gender={gender} personalBest={bestIds.has(entry.timeId)} /></span>
              <span className="flex shrink-0 items-center gap-0.5">
                <button type="button" className="grid size-6 place-items-center rounded-[var(--radius)] text-xs text-ink-2 hover:bg-sunken disabled:opacity-25" disabled={index === 0} onClick={() => move(index, -1)} aria-label={`Move ${outreachEventLabel(entry.event)} up`}>↑</button>
                <button type="button" className="grid size-6 place-items-center rounded-[var(--radius)] text-xs text-ink-2 hover:bg-sunken disabled:opacity-25" disabled={index === config.entries.length - 1} onClick={() => move(index, 1)} aria-label={`Move ${outreachEventLabel(entry.event)} down`}>↓</button>
                <button type="button" className="px-1.5 py-1 text-[10px] text-bad hover:underline" onClick={() => remove(entry.timeId)}>Remove</button>
              </span>
            </li>
          ))}
        </ol>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Result to add</span>
          <Select className="!w-full min-w-0 text-xs" value={candidate?.timeId ?? ""} disabled={!candidate || config.entries.length >= 8} onChange={(event) => setCandidateId(event.target.value)}>
            {remaining.length === 0 && <option value="">{availableTimes.length ? "All available results selected" : "No results in My Times"}</option>}
            {remaining.map((entry) => <option key={entry.timeId} value={entry.timeId}>{optionLabels.get(entry.timeId)}</option>)}
          </Select>
        </label>
        <button type="button" className="wr-btn wr-btn--neutral wr-btn--small" disabled={!candidate || config.entries.length >= 8} onClick={add}>Add result</button>
      </div>

      <div className="flex flex-wrap items-end gap-x-4 gap-y-2 rounded-[var(--radius)] bg-sunken/45 px-3 py-2">
        <label className="min-w-44">
          <span className="wr-field-label block">Format</span>
          <Select className="!w-full !py-1.5 text-xs" value={config.layout} onChange={(event) => onChange({ ...config, layout: event.target.value as OutreachTimeConfig["layout"] })}>
            <option value="lines">One per line</option>
            <option value="inline">Single line</option>
          </Select>
        </label>
        <label className="flex items-center gap-1.5 pb-1 text-xs"><FormControl.Input type="checkbox" checked={config.includeMeet} onChange={(event) => onChange({ ...config, includeMeet: event.target.checked })} /> Meet</label>
        <label className="flex items-center gap-1.5 pb-1 text-xs"><FormControl.Input type="checkbox" checked={config.includeDate} onChange={(event) => onChange({ ...config, includeDate: event.target.checked })} /> Date</label>
      </div>

      {config.entries.length > 0 && (
        <pre className="whitespace-pre-wrap rounded-[var(--radius)] border border-line bg-paper px-3 py-2 font-sans text-[11px] leading-5 text-ink-2">{renderOutreachTimes(config)}</pre>
      )}
    </div>
  );
});
