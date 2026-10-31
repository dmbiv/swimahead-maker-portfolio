"use client";

import * as FormControl from "@/components/form-control";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "@/components/app-link";
import { Badge, EmptyState } from "@/components/ui";
import {
  bulkPromoteQuestionnaireSubmissions,
  deleteQuestionnaireSubmissions,
} from "@/lib/questionnaire-actions";
import type { Submission } from "@/lib/questionnaire-defs";
import { formatAnswer, type QuestionField } from "@/lib/questionnaire-fields";
import {
  filterAndSortSubmissions,
  SUBMISSION_STATUS_LABEL,
  type SubmissionGenderFilter,
  type SubmissionSortKey,
  type SubmissionSortState,
  type SubmissionStatusFilter,
} from "@/lib/questionnaire-submission-view";

type CampaignOption = {
  id: string;
  name: string;
  classYear: number;
  gender: "M" | "F";
};

type Notice = { tone: "success" | "error"; text: string };

const DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/New_York",
});

export function QuestionnaireSubmissionsTable({
  questionnaireId,
  submissions,
  fields,
  campaigns,
  collegeId,
}: {
  questionnaireId: string;
  submissions: Submission[];
  fields: QuestionField[];
  campaigns: CampaignOption[];
  collegeId: string | null;
}) {
  const router = useRouter();
  const selectAllRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<SubmissionStatusFilter>("all");
  const [gradYear, setGradYear] = useState("all");
  const [gender, setGender] = useState<SubmissionGenderFilter>("all");
  const [sort, setSort] = useState<SubmissionSortState>({ key: "submittedAt", direction: "desc" });
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [campaignId, setCampaignId] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, startTransition] = useTransition();

  const years = useMemo(
    () => [...new Set(submissions.map((row) => row.gradYear).filter((year): year is number => year !== null))]
      .sort((a, b) => b - a),
    [submissions],
  );
  const visible = useMemo(
    () => filterAndSortSubmissions(submissions, fields, { query, status, gradYear, gender, sort }),
    [fields, gender, gradYear, query, sort, status, submissions],
  );
  const visibleIds = useMemo(() => visible.map((row) => row.id), [visible]);
  const selectedRows = useMemo(() => submissions.filter((row) => selected.has(row.id)), [selected, submissions]);
  const selectedVisibleCount = visibleIds.filter((id) => selected.has(id)).length;
  const promotableCount = selectedRows.filter((row) => row.status === "new").length;
  const allVisibleSelected = visibleIds.length > 0 && selectedVisibleCount === visibleIds.length;
  const hasFilters = query.trim() !== "" || status !== "all" || gradYear !== "all" || gender !== "all";

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = selectedVisibleCount > 0 && !allVisibleSelected;
    }
  }, [allVisibleSelected, selectedVisibleCount]);

  function changeSort(key: SubmissionSortKey) {
    setSort((current) => current.key === key
      ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
      : { key, direction: key === "submittedAt" ? "desc" : "asc" });
  }

  function toggleVisible(checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      for (const id of visibleIds) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  function toggleRow(id: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function resetFilters() {
    setQuery("");
    setStatus("all");
    setGradYear("all");
    setGender("all");
  }

  function promoteSelected() {
    if (!campaignId || promotableCount === 0) return;
    setNotice(null);
    const ids = [...selected];
    const campaign = campaigns.find((option) => option.id === campaignId);
    startTransition(async () => {
      const result = await bulkPromoteQuestionnaireSubmissions(questionnaireId, ids, campaignId);
      if (!result.ok) {
        setNotice({ tone: "error", text: result.error ?? "Promotion failed." });
        return;
      }
      const skipped = result.skipped > 0 ? ` ${result.skipped} already-reviewed selection${result.skipped === 1 ? " was" : "s were"} skipped.` : "";
      const destination = campaign ? `Class of ${campaign.classYear} · ${campaign.name}` : "the selected campaign";
      setNotice({
        tone: "success",
        text: `Promoted ${result.promoted} ${result.promoted === 1 ? "submission" : "submissions"} to ${destination}.${skipped}`,
      });
      setSelected(new Set());
      router.refresh();
    });
  }

  function deleteSelected() {
    if (selected.size === 0) return;
    const confirmed = window.confirm(
      `Permanently delete ${selected.size} selected ${selected.size === 1 ? "submission" : "submissions"}? `
      + "Promoted recruits will remain in their campaign ledgers. This cannot be undone.",
    );
    if (!confirmed) return;
    setNotice(null);
    const ids = [...selected];
    startTransition(async () => {
      const result = await deleteQuestionnaireSubmissions(questionnaireId, ids);
      if (!result.ok) {
        setNotice({ tone: "error", text: result.error ?? "Deletion failed." });
        return;
      }
      setNotice({
        tone: "success",
        text: `Deleted ${result.deleted} ${result.deleted === 1 ? "submission" : "submissions"}.`,
      });
      setSelected(new Set());
      router.refresh();
    });
  }

  if (submissions.length === 0) {
    return (
      <div className="wr-card">
        <EmptyState title="No submissions yet" hint="Share the questionnaire link with recruits. New responses will appear here." />
      </div>
    );
  }

  const columnCount = 12 + fields.length;

  return (
    <div className="space-y-3">
      <div className="wr-card p-3">
        <div className="grid gap-2 md:grid-cols-[minmax(220px,1fr)_auto_auto_auto]">
          <label>
            <span className="sr-only">Search submissions</span>
            <FormControl.Input
              type="search"
              className="wr-control w-full"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search names, contact info, clubs, times, or answers…"
            />
          </label>
          <label>
            <span className="sr-only">Filter by status</span>
            <FormControl.Select className="wr-control" value={status} onChange={(event) => setStatus(event.target.value as SubmissionStatusFilter)}>
              <option value="all">All statuses</option>
              <option value="new">New</option>
              <option value="promoted">Promoted</option>
              <option value="archived">Archived</option>
            </FormControl.Select>
          </label>
          <label>
            <span className="sr-only">Filter by class</span>
            <FormControl.Select className="wr-control" value={gradYear} onChange={(event) => setGradYear(event.target.value)}>
              <option value="all">All classes</option>
              {years.map((year) => <option key={year} value={year}>Class of {year}</option>)}
              {submissions.some((row) => row.gradYear === null) ? <option value="unset">Class not set</option> : null}
            </FormControl.Select>
          </label>
          <label>
            <span className="sr-only">Filter by squad</span>
            <FormControl.Select className="wr-control" value={gender} onChange={(event) => setGender(event.target.value as SubmissionGenderFilter)}>
              <option value="all">All squads</option>
              <option value="F">Women</option>
              <option value="M">Men</option>
              <option value="unset">Squad not set</option>
            </FormControl.Select>
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--line)] pt-3">
          <span className="mr-auto text-xs text-ink-2" aria-live="polite">
            <strong className="font-semibold text-ink-1">{selected.size}</strong> selected
            {selected.size > 0 && promotableCount !== selected.size ? ` · ${promotableCount} new` : ""}
          </span>
          {selected.size > 0 ? (
            <button type="button" className="wr-btn wr-btn--ghost wr-btn--small" onClick={() => setSelected(new Set())} disabled={busy}>
              Clear selection
            </button>
          ) : null}
          {campaigns.length > 0 ? (
            <FormControl.Select
              className="wr-control"
              aria-label="Class campaign for promotion"
              value={campaignId}
              onChange={(event) => setCampaignId(event.target.value)}
              disabled={busy || promotableCount === 0}
            >
              <option value="">Promote to class…</option>
              {campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  Class of {campaign.classYear} · {campaign.gender === "F" ? "Women" : "Men"} · {campaign.name}
                </option>
              ))}
            </FormControl.Select>
          ) : (
            <Link
              href={collegeId ? `/c/campaigns?college=${collegeId}` : "/c/campaigns"}
              className="text-xs text-[var(--accent-2)] underline underline-offset-2"
            >
              Create a class campaign to promote
            </Link>
          )}
          <button
            type="button"
            className="wr-btn wr-btn--primary wr-btn--small"
            disabled={busy || !campaignId || promotableCount === 0}
            onClick={promoteSelected}
          >
            {busy ? "Working…" : `Promote${promotableCount > 0 ? ` ${promotableCount}` : ""}`}
          </button>
          <button
            type="button"
            className="wr-btn wr-btn--danger wr-btn--small"
            disabled={busy || selected.size === 0}
            onClick={deleteSelected}
          >
            Delete{selected.size > 0 ? ` ${selected.size}` : ""}
          </button>
        </div>

        {notice ? (
          <p
            role="status"
            className={`mt-2 text-xs ${notice.tone === "error" ? "text-[var(--bad)]" : "text-[var(--good)]"}`}
          >
            {notice.text}
          </p>
        ) : null}
      </div>

      <div className="wr-card overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-3 py-2 text-xs text-ink-3">
          <span>Showing {visible.length} of {submissions.length}</span>
          {hasFilters ? (
            <button type="button" className="underline underline-offset-2 hover:text-ink-1" onClick={resetFilters}>
              Clear filters
            </button>
          ) : (
            <span>Click any column heading to sort</span>
          )}
        </div>
        <div className="wr-scroll max-h-[calc(100vh-300px)] min-h-48 overflow-auto">
          <table className="w-max min-w-full text-sm">
            <thead className="sticky top-0 z-20">
              <tr className="border-b border-[var(--line)] text-left">
                <th className="sticky left-0 top-0 z-40 w-11 min-w-11 bg-[var(--paper)] px-3 py-2.5">
                  <FormControl.Input
                    ref={selectAllRef}
                    type="checkbox"
                    checked={allVisibleSelected}
                    disabled={visible.length === 0}
                    onChange={(event) => toggleVisible(event.target.checked)}
                    aria-label="Select all visible submissions"
                  />
                </th>
                <SortableHeader label="Name" sortKey="fullName" sort={sort} onSort={changeSort} className="sticky left-11 z-30 min-w-52 border-r border-[var(--line)] bg-[var(--paper)]" />
                <SortableHeader label="Status" sortKey="status" sort={sort} onSort={changeSort} className="min-w-28" />
                <SortableHeader label="Class" sortKey="gradYear" sort={sort} onSort={changeSort} className="min-w-24" />
                <SortableHeader label="Squad" sortKey="gender" sort={sort} onSort={changeSort} className="min-w-24" />
                <SortableHeader label="Email" sortKey="email" sort={sort} onSort={changeSort} className="min-w-52" />
                <SortableHeader label="Phone" sortKey="phone" sort={sort} onSort={changeSort} className="min-w-36" />
                <SortableHeader label="Club / school" sortKey="club" sort={sort} onSort={changeSort} className="min-w-48" />
                <SortableHeader label="LSC" sortKey="lsc" sort={sort} onSort={changeSort} className="min-w-20" />
                <SortableHeader label="SwimCloud" sortKey="swimcloudUrl" sort={sort} onSort={changeSort} className="min-w-28" />
                <SortableHeader label="Best times" sortKey="timesText" sort={sort} onSort={changeSort} className="min-w-64" />
                {fields.map((field) => (
                  <SortableHeader
                    key={field.key}
                    label={field.label}
                    sortKey={`answer:${field.key}`}
                    sort={sort}
                    onSort={changeSort}
                    className="min-w-48 max-w-80"
                  />
                ))}
                <SortableHeader label="Submitted" sortKey="submittedAt" sort={sort} onSort={changeSort} className="min-w-44" />
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={columnCount} className="px-4 py-12 text-center text-sm text-ink-3">
                    No submissions match these filters.
                  </td>
                </tr>
              ) : visible.map((submission) => (
                <tr key={submission.id} className="group border-b border-[var(--line)] last:border-0 align-top">
                  <td className="sticky left-0 z-10 bg-[var(--surface)] px-3 py-2.5 group-hover:bg-[var(--sunken)]">
                    <FormControl.Input
                      type="checkbox"
                      checked={selected.has(submission.id)}
                      onChange={(event) => toggleRow(submission.id, event.target.checked)}
                      aria-label={`Select ${submission.fullName}`}
                    />
                  </td>
                  <td className="sticky left-11 z-10 max-w-64 border-r border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 group-hover:bg-[var(--sunken)]">
                    <div className="font-medium text-ink-1">{submission.fullName}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    <SubmissionStatus status={submission.status} />
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-ink-2">{submission.gradYear ?? <EmptyCell />}</td>
                  <td className="px-3 py-2.5 text-ink-2">{submission.gender === "F" ? "Women" : submission.gender === "M" ? "Men" : <EmptyCell />}</td>
                  <td className="px-3 py-2.5 text-xs">
                    {submission.email ? <a href={`mailto:${submission.email}`} className="text-[var(--accent-2)] underline underline-offset-2">{submission.email}</a> : <EmptyCell />}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-ink-2">{submission.phone ?? <EmptyCell />}</td>
                  <td className="max-w-64 px-3 py-2.5 text-xs text-ink-2">{submission.club ?? <EmptyCell />}</td>
                  <td className="px-3 py-2.5 text-xs text-ink-2">{submission.lsc ?? <EmptyCell />}</td>
                  <td className="px-3 py-2.5 text-xs">
                    {submission.swimcloudUrl ? (
                      <a href={submission.swimcloudUrl} target="_blank" rel="noreferrer" className="text-[var(--accent-2)] underline underline-offset-2">Open ↗</a>
                    ) : <EmptyCell />}
                  </td>
                  <td className="max-w-80 whitespace-pre-wrap px-3 py-2.5 text-xs text-ink-2">{submission.timesText || <EmptyCell />}</td>
                  {fields.map((field) => {
                    const answer = formatAnswer(submission.answers[field.key]);
                    return (
                      <td key={field.key} className="max-w-80 whitespace-pre-wrap px-3 py-2.5 text-xs text-ink-2" title={answer || undefined}>
                        {answer || <EmptyCell />}
                      </td>
                    );
                  })}
                  <td className="whitespace-nowrap px-3 py-2.5 text-xs text-ink-2">
                    <time dateTime={submission.submittedAt} suppressHydrationWarning>
                      {DATE_FORMAT.format(new Date(submission.submittedAt))}
                    </time>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SortableHeader({
  label,
  sortKey,
  sort,
  onSort,
  className = "",
}: {
  label: string;
  sortKey: SubmissionSortKey;
  sort: SubmissionSortState;
  onSort: (key: SubmissionSortKey) => void;
  className?: string;
}) {
  const active = sort.key === sortKey;
  return (
    <th
      aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
      className={`sticky top-0 z-20 bg-[var(--paper)] px-3 py-2.5 ${className}`}
    >
      <button
        type="button"
        className={`flex w-full items-center gap-1 whitespace-nowrap text-left hover:text-ink-1 ${active ? "text-[var(--accent-2)]" : ""}`}
        onClick={() => onSort(sortKey)}
        aria-label={`Sort by ${label}${active ? `, currently ${sort.direction === "asc" ? "ascending" : "descending"}` : ""}`}
      >
        <span className="truncate">{label}</span>
        <span aria-hidden className="text-[10px]">{active ? (sort.direction === "asc" ? "↑" : "↓") : "↕"}</span>
      </button>
    </th>
  );
}

function SubmissionStatus({ status }: { status: Submission["status"] }) {
  return (
    <Badge tone={status === "new" ? "accent" : status === "promoted" ? "good" : "neutral"}>
      {SUBMISSION_STATUS_LABEL[status]}
    </Badge>
  );
}

function EmptyCell() {
  return <span className="text-ink-3">–</span>;
}
