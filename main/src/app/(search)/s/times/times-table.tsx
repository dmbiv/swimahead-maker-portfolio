"use client";

import * as FormControl from "@/components/form-control";
import { useDeferredValue, useMemo, useOptimistic, useState, useTransition } from "react";
import { CsvDownload } from "@/components/csv-download";
import { PerformanceScoreGuide, PerformanceScoreValue } from "@/components/performance-score";
import { Badge, EmptyState } from "@/components/ui";
import { canonicalEvent, eventLabelForCourse, EVENT_ORDER } from "@/lib/events";
import { performanceScore } from "@/lib/performance-points";
import { fmtClock, fmtDate } from "@/lib/time";
import { deleteSwimTime } from "@/lib/swimmer-actions";
import type { Course, Gender } from "@/lib/types";
import {
  INITIAL_TIME_ROW_COUNT,
  nextVisibleTimeRowCount,
  TIME_ROW_BATCH_SIZE,
  visibleTimeRows,
} from "./progressive-rows";

export interface TimeRow {
  id: string;
  event: string;
  course: Course;
  seconds: number;
  date: string;
  meet: string;
  source: string;
}

function eventLabel(row: TimeRow) {
  return eventLabelForCourse(row.event, row.course);
}

function exactEventKey(row: TimeRow): string {
  return `${row.event.trim().toUpperCase()}:${row.course}`;
}

export function TimesTable({ rows, gender }: { rows: TimeRow[]; gender: Gender | null }) {
  const [optimisticRows, removeOptimistic] = useOptimistic(
    rows,
    (current: TimeRow[], removedId: string) => current.filter((row) => row.id !== removedId),
  );
  const [query, setQuery] = useState("");
  const [course, setCourse] = useState<"all" | Course>("all");
  const [scope, setScope] = useState<"all" | "best">("all");
  const [minimumScore, setMinimumScore] = useState(0);
  const [sort, setSort] = useState<"date" | "event" | "time" | "score">("date");
  const [message, setMessage] = useState<string | null>(null);
  const [visibleRowCount, setVisibleRowCount] = useState(INITIAL_TIME_ROW_COUNT);
  const deferredQuery = useDeferredValue(query);

  const scores = useMemo(() => new Map(
    optimisticRows.map((row) => [row.id, performanceScore(row, gender)]),
  ), [gender, optimisticRows]);

  const bestIds = useMemo(() => {
    const best = new Map<string, TimeRow>();
    for (const row of optimisticRows) {
      const key = exactEventKey(row);
      const current = best.get(key);
      if (!current || row.seconds < current.seconds) best.set(key, row);
    }
    return new Set([...best.values()].map((row) => row.id));
  }, [optimisticRows]);

  const visible = useMemo(() => {
    const term = deferredQuery.trim().toLocaleLowerCase();
    return optimisticRows
      .filter((row) => course === "all" || row.course === course)
      .filter((row) => scope === "all" || bestIds.has(row.id))
      .filter((row) => minimumScore === 0 || (scores.get(row.id)?.value ?? -1) >= minimumScore)
      .filter((row) => !term || `${eventLabel(row)} ${row.event} ${row.meet} ${row.source}`.toLocaleLowerCase().includes(term))
      .sort((a, b) => {
        if (sort === "score") return (scores.get(b.id)?.value ?? -1) - (scores.get(a.id)?.value ?? -1) || a.seconds - b.seconds;
        if (sort === "time") return a.seconds - b.seconds || b.date.localeCompare(a.date);
        if (sort === "event") {
          const aCode = canonicalEvent(a.event, a.course);
          const bCode = canonicalEvent(b.event, b.course);
          return (aCode ? EVENT_ORDER.indexOf(aCode) : 999) - (bCode ? EVENT_ORDER.indexOf(bCode) : 999) || a.seconds - b.seconds;
        }
        return b.date.localeCompare(a.date) || a.seconds - b.seconds;
      });
  }, [bestIds, course, deferredQuery, minimumScore, optimisticRows, scope, scores, sort]);

  if (optimisticRows.length === 0) {
    return <EmptyState title="No times yet" hint="Search USA Swimming above for official results, or add a result manually." />;
  }

  const exportRows = [
    ["Event", "Time", "Seconds", "Course", "Performance score", "Scoring method", "Score basis", "Date", "Meet", "Source"],
    ...visible.map((row) => {
      const score = scores.get(row.id);
      return [eventLabel(row), fmtClock(row.seconds), row.seconds, row.course, score?.value ?? "", score?.methodLabel ?? "", score?.version ?? "", row.date, row.meet, row.source];
    }),
  ];
  const renderedRows = visibleTimeRows(visible, visibleRowCount);
  const remainingRowCount = visible.length - renderedRows.length;
  const resetVisibleRows = () => setVisibleRowCount(INITIAL_TIME_ROW_COUNT);

  return (
    <section className="space-y-3" aria-labelledby="time-history-title">
      <PerformanceScoreGuide />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_auto_auto_auto_auto_auto] xl:items-end">
        <div className="min-w-0 sm:col-span-2 xl:col-span-1">
          <h2 id="time-history-title" className="text-sm font-semibold">Time history</h2>
          <p className="mt-0.5 text-xs text-ink-3">{visible.length === optimisticRows.length ? `${optimisticRows.length} total results` : `${visible.length} of ${optimisticRows.length} results`}</p>
          <label className="mt-2 block">
            <span className="sr-only">Search time history</span>
            <FormControl.Input className="wr-control" type="search" value={query} onChange={(event) => { setQuery(event.target.value); resetVisibleRows(); }} placeholder="Search event or meet" />
          </label>
        </div>
        <label>
          <span className="wr-field-label block">Course</span>
          <FormControl.Select className="wr-control" value={course} onChange={(event) => {
            const nextCourse = event.target.value as typeof course;
            setCourse(nextCourse);
            resetVisibleRows();
            if (nextCourse === "all") {
              setMinimumScore(0);
              setSort((current) => current === "score" ? "date" : current);
            }
          }}>
            <option value="all">All courses</option><option value="SCY">SCY</option><option value="SCM">SCM</option><option value="LCM">LCM</option>
          </FormControl.Select>
        </label>
        <label>
          <span className="wr-field-label block">Results</span>
          <FormControl.Select className="wr-control" value={scope} onChange={(event) => { setScope(event.target.value as typeof scope); resetVisibleRows(); }}>
            <option value="all">All history</option><option value="best">Personal bests only</option>
          </FormControl.Select>
        </label>
        <label className={course === "all" ? "opacity-55" : ""}>
          <span className="wr-field-label block">Minimum score</span>
          <FormControl.Select className="wr-control" value={minimumScore} disabled={course === "all"} onChange={(event) => { setMinimumScore(Number(event.target.value)); resetVisibleRows(); }}>
            <option value={0}>Any score</option><option value={400}>400+</option><option value={500}>500+</option><option value={600}>600+</option><option value={700}>700+</option><option value={800}>800+</option>
          </FormControl.Select>
        </label>
        <label>
          <span className="wr-field-label block">Sort by</span>
          <FormControl.Select className="wr-control" value={sort} onChange={(event) => { setSort(event.target.value as typeof sort); resetVisibleRows(); }}>
            <option value="date">Newest first</option><option value="score" disabled={course === "all"}>Highest score (choose course)</option><option value="event">Event order</option><option value="time">Fastest raw time</option>
          </FormControl.Select>
        </label>
        <div className="self-end"><CsvDownload rows={exportRows} filename="my-swim-times" label="Download CSV" title={`Download ${visible.length} visible swim times as CSV`} /></div>
      </div>

      {course === "all" && (
        <p className="text-[11px] text-ink-3">Choose one course to sort or filter by score. College Index and WA Points are separate scales.</p>
      )}

      <div aria-live="polite" className="min-h-5 text-xs text-ink-2">{message}</div>

      {visible.length ? (
        <>
          <div className="wr-card times-table-shell overflow-x-auto p-0">
            <table role="table" className="times-table w-full text-sm" aria-rowcount={visible.length + 1} aria-busy={query !== deferredQuery}>
              <caption className="sr-only">Filtered swim time history</caption>
              <thead role="rowgroup">
                <tr role="row" className="border-b border-line text-left text-xs text-ink-3">
                  <th role="columnheader" id="times-col-event" scope="col" className="px-3 py-2 font-normal">Event</th>
                  <th role="columnheader" id="times-col-time" scope="col" className="px-3 py-2 font-normal">Time</th>
                  <th role="columnheader" id="times-col-course" scope="col" className="px-3 py-2 font-normal">Course</th>
                  <th role="columnheader" id="times-col-score" scope="col" className="px-3 py-2 font-normal">Score</th>
                  <th role="columnheader" id="times-col-date" scope="col" className="px-3 py-2 font-normal">Date</th>
                  <th role="columnheader" id="times-col-meet" scope="col" className="px-3 py-2 font-normal">Meet</th>
                  <th role="columnheader" id="times-col-source" scope="col" className="px-3 py-2 font-normal">Source</th>
                  <th role="columnheader" id="times-col-actions" scope="col" className="px-3 py-2"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody role="rowgroup" id="time-history-rows">
                {renderedRows.map((row, index) => (
                  <tr role="row" key={row.id} className="times-table-row border-b border-line/60 last:border-b-0" aria-rowindex={index + 2}>
                    <td role="cell" headers="times-col-event" className="times-cell-event px-3 py-2 font-medium">{eventLabel(row)} {bestIds.has(row.id) && <Badge tone="good">Best</Badge>}</td>
                    <td role="cell" headers="times-col-time" className="times-cell-time px-3 py-2 font-data font-semibold">{fmtClock(row.seconds)}</td>
                    <td role="cell" headers="times-col-course" className="times-cell-course px-3 py-2 text-ink-3">{row.course}</td>
                    <td role="cell" headers="times-col-score" className="times-cell-score px-3 py-2"><PerformanceScoreValue score={scores.get(row.id) ?? null} /></td>
                    <td role="cell" headers="times-col-date" className="times-cell-date px-3 py-2 text-ink-3">{fmtDate(row.date)}</td>
                    <td role="cell" headers="times-col-meet" className="times-cell-meet max-w-xs truncate px-3 py-2 text-ink-2">{row.meet}</td>
                    <td role="cell" headers="times-col-source" className="times-cell-source px-3 py-2 text-xs capitalize text-ink-3">{row.source === "swims" ? "Official" : row.source}</td>
                    <td role="cell" headers="times-col-actions" className="times-cell-actions px-3 py-2 text-right"><DeleteButton row={row} onRemove={removeOptimistic} onMessage={setMessage} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {remainingRowCount > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius)] border border-line bg-surface px-3 py-2">
              <p className="text-xs text-ink-3">Showing {renderedRows.length} of {visible.length} matching results.</p>
              <button
                type="button"
                className="wr-btn wr-btn--neutral wr-btn--small"
                aria-controls="time-history-rows"
                onClick={() => setVisibleRowCount((current) => nextVisibleTimeRowCount(current, visible.length))}
              >
                Show next {Math.min(TIME_ROW_BATCH_SIZE, remainingRowCount)}
              </button>
            </div>
          )}
        </>
      ) : (
        <EmptyState title="No times match" hint="Try another event, meet, course, result scope, or score range.">
          <button type="button" className="wr-btn wr-btn--neutral" onClick={() => { setQuery(""); setCourse("all"); setScope("all"); setMinimumScore(0); resetVisibleRows(); }}>Clear filters</button>
        </EmptyState>
      )}
    </section>
  );
}

function DeleteButton({ row, onRemove, onMessage }: {
  row: TimeRow;
  onRemove: (id: string) => void;
  onMessage: (message: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  if (!confirming) {
    return <button type="button" className="text-xs text-ink-3 hover:text-bad" onClick={() => setConfirming(true)}>Delete</button>;
  }
  return (
    <span className="inline-flex items-center gap-2 rounded-[var(--radius)] bg-sunken px-2 py-1">
      <button type="button" className="text-xs text-ink-2 hover:text-ink" onClick={() => setConfirming(false)}>Cancel</button>
      <button
        type="button"
        disabled={pending}
        className="text-xs font-semibold text-bad hover:underline disabled:opacity-50"
        onClick={() => startTransition(async () => {
          onRemove(row.id);
          const result = await deleteSwimTime(row.id);
          onMessage(result.ok ? `${eventLabel(row)} from ${fmtDate(row.date)} deleted.` : `Couldn’t delete ${eventLabel(row)}. The result was restored.`);
          if (!result.ok) setConfirming(false);
        })}
      >
        {pending ? "Deleting…" : "Confirm"}
      </button>
    </span>
  );
}
