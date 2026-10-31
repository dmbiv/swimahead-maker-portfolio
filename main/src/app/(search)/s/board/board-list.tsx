"use client";

import * as FormControl from "@/components/form-control";
import Link from "@/components/app-link";
import { useDeferredValue, useMemo, useState, useTransition } from "react";
import { Badge, EmptyState } from "@/components/ui";
import { CsvDownload } from "@/components/csv-download";
import { clearCollegeStatus, clearCollegeStatuses, setCollegeStatus } from "@/lib/swimmer-actions";

export interface BoardRow {
  programId: string;
  status: "saved" | "ruled_out";
  reason: string;
  name: string;
  location: string;
  squad: "men" | "women" | "coed" | null;
  division: string | null;
  conference: string | null;
  createdAt: string;
}

type View = "all" | "saved" | "ruled-out";
const INITIAL_RENDER_COUNT = 48;
const RENDER_INCREMENT = 48;

function squadLabel(squad: BoardRow["squad"]): string {
  if (squad === "men") return "Men’s swimming";
  if (squad === "women") return "Women’s swimming";
  if (squad === "coed") return "Coed swimming";
  return "Swimming";
}

function detailHref(row: BoardRow): string {
  const params = new URLSearchParams({ q: row.name });
  if (row.squad) params.set("squad", row.squad);
  if (row.status === "ruled_out") params.set("showRuledOut", "1");
  return `/s/explore?${params.toString()}#program-${encodeURIComponent(row.programId)}`;
}

export function ProgramsBoard({ rows, initialView = "saved" }: { rows: BoardRow[]; initialView?: View }) {
  const [items, setItems] = useState(rows);
  const [view, setView] = useState<View>(initialView);
  const [query, setQuery] = useState("");
  const [conference, setConference] = useState("all");
  const [sort, setSort] = useState<"recent" | "name" | "conference">("recent");
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmRestoreAll, setConfirmRestoreAll] = useState(false);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [editingReasonId, setEditingReasonId] = useState<string | null>(null);
  const [reasonDraft, setReasonDraft] = useState("");
  const [renderCount, setRenderCount] = useState(INITIAL_RENDER_COUNT);
  const [pending, startTransition] = useTransition();
  const deferredQuery = useDeferredValue(query);

  const { savedCount, ruledOutCount } = useMemo(() => {
    let saved = 0;
    let ruledOut = 0;
    for (const item of items) {
      if (item.status === "saved") saved += 1;
      else ruledOut += 1;
    }
    return { savedCount: saved, ruledOutCount: ruledOut };
  }, [items]);
  const conferences = useMemo(() => [...new Set(items.map((item) => item.conference).filter((value): value is string => Boolean(value)))].sort(), [items]);
  const visible = useMemo(() => {
    const term = deferredQuery.trim().toLocaleLowerCase();
    return items
      .filter((item) => view === "all" || (view === "saved" ? item.status === "saved" : item.status === "ruled_out"))
      .filter((item) => conference === "all" || item.conference === conference)
      .filter((item) => !term || `${item.name} ${item.location} ${item.reason} ${squadLabel(item.squad)} ${item.division ?? ""} ${item.conference ?? ""}`.toLocaleLowerCase().includes(term))
      .sort((a, b) => {
        if (sort === "name") return a.name.localeCompare(b.name);
        if (sort === "conference") return (a.conference ?? "\uffff").localeCompare(b.conference ?? "\uffff") || a.name.localeCompare(b.name);
        return b.createdAt.localeCompare(a.createdAt);
      });
  }, [conference, deferredQuery, items, sort, view]);
  const renderedRows = visible.slice(0, renderCount);
  const csvRows = useMemo(() => [
    ["College", "Squad", "Division", "Conference", "Location", "Status", "Reason", "Added"],
    ...visible.map((item) => [
      item.name,
      squadLabel(item.squad),
      item.division ?? "",
      item.conference ?? "",
      item.location,
      item.status === "saved" ? "Saved" : "Ruled out",
      item.reason,
      item.createdAt.slice(0, 10),
    ]),
  ], [visible]);

  const changeView = (nextView: View) => {
    setView(nextView);
    setRenderCount(INITIAL_RENDER_COUNT);
    const href = nextView === "saved" ? "/s/board" : `/s/board?view=${nextView}`;
    window.history.replaceState(window.history.state, "", href);
  };

  const markPending = (id: string, value: boolean) => {
    setPendingIds((current) => {
      const next = new Set(current);
      if (value) next.add(id); else next.delete(id);
      return next;
    });
  };

  const changeStatus = (row: BoardRow, next: "saved" | "ruled_out" | undefined, reason = "") => {
    const previous = items;
    setNotice(null);
    setConfirmRemoveId(null);
    setItems((current) => next
      ? current.map((item) => item.programId === row.programId ? { ...item, status: next, reason } : item)
      : current.filter((item) => item.programId !== row.programId));
    markPending(row.programId, true);
    startTransition(async () => {
      const result = next
        ? await setCollegeStatus(row.programId, next, reason)
        : await clearCollegeStatus(row.programId);
      if (!result.ok) {
        setItems(previous);
        setNotice(`Couldn’t update ${row.name}. Your previous selection was restored.`);
      } else {
        setNotice(next === "saved" ? `${row.name} moved to Saved.` : next === "ruled_out" ? `${row.name} ruled out.` : `${row.name} restored to your search.`);
      }
      markPending(row.programId, false);
    });
  };

  const saveReason = (row: BoardRow) => {
    const reason = reasonDraft.trim();
    const previous = items;
    setItems((current) => current.map((item) => item.programId === row.programId ? { ...item, reason } : item));
    markPending(row.programId, true);
    startTransition(async () => {
      const result = await setCollegeStatus(row.programId, "ruled_out", reason);
      if (!result.ok) {
        setItems(previous);
        setNotice(`Couldn’t save the note for ${row.name}.`);
      } else {
        setNotice(reason ? `Reason saved for ${row.name}.` : `Reason removed from ${row.name}.`);
        setEditingReasonId(null);
      }
      markPending(row.programId, false);
    });
  };

  const restoreAll = () => {
    const previous = items;
    const count = ruledOutCount;
    setItems((current) => current.filter((item) => item.status !== "ruled_out"));
    setConfirmRestoreAll(false);
    startTransition(async () => {
      const result = await clearCollegeStatuses("ruled_out");
      if (!result.ok) {
        setItems(previous);
        setNotice("Couldn’t restore the ruled-out programs. Nothing was changed.");
      } else {
        setNotice(`${count} ${count === 1 ? "program" : "programs"} restored to search results.`);
      }
    });
  };

  if (items.length === 0) {
    return (
      <EmptyState title="No programs in your list" hint="Save promising colleges or rule out poor fits while you search. You can change either choice later.">
        <Link href="/s/explore" className="wr-btn wr-btn--primary">Explore programs</Link>
      </EmptyState>
    );
  }

  return (
    <div className="space-y-4">
      <div className="wr-card program-board-toolbar p-3 sm:p-4">
        <div className="grid gap-3">
          <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-center">
            <div className="segmented-control shrink-0" aria-label="Program list view">
              {([
                ["saved", "Saved", savedCount],
                ["ruled-out", "Ruled out", ruledOutCount],
                ["all", "All", items.length],
              ] as const).map(([value, label, count]) => (
                <button key={value} type="button" onClick={() => changeView(value)} aria-pressed={view === value}>
                  {label} <span className="font-data opacity-60">{count}</span>
                </button>
              ))}
            </div>
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">Search your programs</span>
              <FormControl.Input className="wr-control" type="search" value={query} onChange={(event) => { setQuery(event.target.value); setRenderCount(INITIAL_RENDER_COUNT); }} placeholder="Search schools or conferences" />
            </label>
            <div className="shrink-0 md:self-center">
              <CsvDownload
                rows={csvRows}
                filename="my-college-list"
                label="Download list"
                title={`Download ${visible.length} visible programs as CSV`}
              />
            </div>
          </div>
          <div className="grid min-w-0 gap-2 sm:grid-cols-2 lg:max-w-2xl">
            <label className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2 text-xs text-ink-2">
              <span>Conference</span>
              <FormControl.Select className="wr-control" value={conference} onChange={(event) => { setConference(event.target.value); setRenderCount(INITIAL_RENDER_COUNT); }}>
                <option value="all">All conferences</option>
                {conferences.map((option) => <option key={option} value={option}>{option}</option>)}
              </FormControl.Select>
            </label>
            <label className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2 text-xs text-ink-2">
              <span>Sort</span>
              <FormControl.Select className="wr-control" value={sort} onChange={(event) => { setSort(event.target.value as typeof sort); setRenderCount(INITIAL_RENDER_COUNT); }}>
                <option value="recent">Recently added</option>
                <option value="name">College name</option>
                <option value="conference">Conference</option>
              </FormControl.Select>
            </label>
          </div>
        </div>

        {ruledOutCount > 0 && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
            <p className="text-xs text-ink-3">Ruled-out programs stay hidden in search unless you choose to show them.</p>
            {!confirmRestoreAll ? (
              <button type="button" className="wr-btn wr-btn--ghost wr-btn--small" onClick={() => setConfirmRestoreAll(true)}>Restore all ruled-out</button>
            ) : (
              <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius)] bg-sunken px-2 py-1.5">
                <span className="text-xs text-ink-2">Restore all {ruledOutCount}? Saved reasons will be removed.</span>
                <button type="button" className="wr-btn wr-btn--neutral wr-btn--small" onClick={() => setConfirmRestoreAll(false)}>Cancel</button>
                <button type="button" className="wr-btn wr-btn--primary wr-btn--small" disabled={pending} onClick={restoreAll}>Restore all</button>
              </div>
            )}
          </div>
        )}
      </div>

      <div aria-live="polite" className="min-h-5 text-xs text-ink-2">
        {pending ? "Saving changes…" : notice}
      </div>

      {visible.length ? (
        <>
          <div className="grid gap-3 xl:grid-cols-2">
          {renderedRows.map((row) => {
            const rowPending = pendingIds.has(row.programId);
            const editingReason = editingReasonId === row.programId;
            return (
              <article key={row.programId} className={`wr-card program-list-card p-4 ${row.status === "ruled_out" ? "program-list-card--muted" : ""}`}>
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-sm font-semibold">{row.name}</h2>
                      <Badge tone="neutral">{squadLabel(row.squad)}</Badge>
                      <Badge tone={row.status === "saved" ? "accent" : "neutral"}>{row.status === "saved" ? "Saved" : "Ruled out"}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-ink-3">{[row.location || "Location not reported", row.division].filter(Boolean).join(" · ")}</p>
                    <p className="mt-1 text-xs text-ink-2"><span className="font-semibold">Conference:</span> {row.conference ?? "Not reported"}</p>
                    {row.status === "ruled_out" && row.reason && !editingReason && <p className="mt-2 text-xs text-ink-2">Reason: {row.reason}</p>}
                  </div>
                  {rowPending && <span className="text-xs text-accent" aria-label="Saving">Saving…</span>}
                </div>

                {editingReason && (
                  <div className="mt-3 rounded-[var(--radius)] border border-line bg-paper p-3">
                    <label className="block">
                      <span className="wr-field-label block">Why isn’t this program a fit? (optional)</span>
                      <FormControl.Textarea className="wr-control" rows={2} maxLength={300} value={reasonDraft} onChange={(event) => setReasonDraft(event.target.value)} autoFocus />
                    </label>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="font-data text-[10px] text-ink-3">{reasonDraft.length}/300</span>
                      <div className="flex gap-2">
                        <button type="button" className="wr-btn wr-btn--ghost wr-btn--small" onClick={() => setEditingReasonId(null)}>Cancel</button>
                        <button type="button" className="wr-btn wr-btn--primary wr-btn--small" disabled={rowPending} onClick={() => saveReason(row)}>Save reason</button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">
                  <Link href={detailHref(row)} prefetch={false} className="wr-btn wr-btn--neutral wr-btn--small">View details</Link>
                  {row.status === "saved" && <Link href={`/s/outreach/drafts/new?program=${encodeURIComponent(row.programId)}`} prefetch={false} className="wr-btn wr-btn--neutral wr-btn--small">Draft email</Link>}
                  {row.status === "saved" ? (
                    <button type="button" className="wr-btn wr-btn--ghost wr-btn--small" disabled={rowPending} onClick={() => changeStatus(row, "ruled_out")}>Rule out</button>
                  ) : (
                    <>
                      <button type="button" className="wr-btn wr-btn--neutral wr-btn--small" disabled={rowPending} onClick={() => changeStatus(row, "saved")}>Move to saved</button>
                      <button type="button" className="wr-btn wr-btn--ghost wr-btn--small" onClick={() => { setEditingReasonId(row.programId); setReasonDraft(row.reason); }}>{row.reason ? "Edit reason" : "Add reason"}</button>
                    </>
                  )}
                  <div className="ml-auto flex items-center gap-2">
                    {confirmRemoveId === row.programId ? (
                      <>
                        <span className="text-xs text-ink-3">Remove?</span>
                        <button type="button" className="text-xs font-medium text-ink-2 hover:text-ink" onClick={() => setConfirmRemoveId(null)}>Cancel</button>
                        <button type="button" className="text-xs font-semibold text-bad hover:underline" disabled={rowPending} onClick={() => changeStatus(row, undefined)}>{row.status === "ruled_out" ? "Restore" : "Remove"}</button>
                      </>
                    ) : (
                      <button type="button" className="text-xs text-ink-3 hover:text-bad" onClick={() => setConfirmRemoveId(row.programId)}>{row.status === "ruled_out" ? "Restore to search" : "Remove"}</button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
          </div>
          {renderedRows.length < visible.length && (
            <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
              <span className="text-xs text-ink-3">Showing {renderedRows.length} of {visible.length}</span>
              <button
                type="button"
                className="wr-btn wr-btn--neutral wr-btn--small"
                onClick={() => setRenderCount((current) => Math.min(current + RENDER_INCREMENT, visible.length))}
              >
                Show more
              </button>
            </div>
          )}
        </>
      ) : (
        <EmptyState title="No programs match this view" hint={query || conference !== "all" ? "Try a different school, conference, or list view." : "There are no programs in this section."}>
          {(query || conference !== "all") && <button type="button" className="wr-btn wr-btn--neutral" onClick={() => { setQuery(""); setConference("all"); setRenderCount(INITIAL_RENDER_COUNT); }}>Clear filters</button>}
          <Link href="/s/explore" className="wr-btn wr-btn--primary">Explore programs</Link>
        </EmptyState>
      )}
    </div>
  );
}
