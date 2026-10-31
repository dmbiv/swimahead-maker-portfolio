"use client";

import * as FormControl from "@/components/form-control";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addRosterSwimmer,
  addRosterSwimmerFromSwims,
  parseRosterBulk,
  addRosterBulk,
  clearRoster,
  type ParsedRosterSwimmer,
} from "@/lib/coach-roster";
import { searchSwimsMembersAction } from "@/lib/coach-actions";
import { rosterClassDisplay, SEASON_ROLLOVER_LABEL } from "@/lib/roster-season";
import { fmtClock } from "@/lib/time";
import type { SwimsMember } from "@/lib/types";

type Tab = "paste" | "swims" | "manual";

export function RosterImport({
  collegeId,
  swimcloudRosterUrl,
  rosterCount,
}: {
  collegeId: string;
  swimcloudRosterUrl: string | null;
  rosterCount: number;
}) {
  const [tab, setTab] = useState<Tab>("paste");

  return (
    <div className="wr-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-2 text-base font-semibold">Add swimmers</h2>
        <TabButton active={tab === "paste"} onClick={() => setTab("paste")}>Paste roster</TabButton>
        <TabButton active={tab === "swims"} onClick={() => setTab("swims")}>USA Swimming</TabButton>
        <TabButton active={tab === "manual"} onClick={() => setTab("manual")}>One swimmer</TabButton>
      </div>

      <div className="mt-4">
        {tab === "paste" ? (
          <BulkTab collegeId={collegeId} swimcloudRosterUrl={swimcloudRosterUrl} rosterCount={rosterCount} />
        ) : null}
        {tab === "swims" ? <SwimsTab collegeId={collegeId} /> : null}
        {tab === "manual" ? <ManualTab collegeId={collegeId} /> : null}
      </div>
    </div>
  );
}

function SeasonReset({ collegeId, rosterCount }: { collegeId: string; rosterCount: number }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  if (rosterCount === 0) return null;

  function wipe() {
    start(async () => {
      const res = await clearRoster(collegeId);
      setConfirming(false);
      setMsg(res.ok ? `Removed ${res.removed} ${res.removed === 1 ? "swimmer" : "swimmers"}. Paste the new roster below.` : res.error);
      if (res.ok) router.refresh();
    });
  }

  return (
    <div className="rounded-md border border-[var(--line)] bg-[var(--sunken)] px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-ink-2">
          <strong className="text-ink-1">New season?</strong> Clear this roster and paste the current one. Do this once each
          year, after {SEASON_ROLLOVER_LABEL}, when the new roster is posted.
        </p>
        {confirming ? (
          <span className="flex shrink-0 items-center gap-2">
            <button type="button" className="wr-btn wr-btn--neutral wr-btn--small" disabled={busy} onClick={wipe}>
              {busy ? "Clearing..." : `Yes, remove all ${rosterCount}`}
            </button>
            <button type="button" className="text-xs text-ink-3 underline underline-offset-2" onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </span>
        ) : (
          <button type="button" className="wr-btn wr-btn--neutral wr-btn--small shrink-0" onClick={() => { setMsg(null); setConfirming(true); }}>
            Clear roster
          </button>
        )}
      </div>
      {msg ? <p className="mt-1.5 text-xs text-ink-2">{msg}</p> : null}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-2.5 py-1 text-sm ${active ? "bg-[var(--sunken)] font-medium" : "text-ink-2 hover:text-ink-1"}`}
    >
      {children}
    </button>
  );
}

function swimCloudClipboardHints(html: string): string {
  if (!/swimcloud\.com\/swimmer\/|href\s*=\s*["']\/swimmer\//i.test(html)) return "";

  const document = new DOMParser().parseFromString(html, "text/html");
  const hints: string[] = [];
  const seen = new Set<string>();
  for (const anchor of document.querySelectorAll<HTMLAnchorElement>("a[href]")) {
    let url: URL;
    try {
      url = new URL(anchor.getAttribute("href") ?? "", "https://www.swimcloud.com");
    } catch {
      continue;
    }
    const host = url.hostname.toLocaleLowerCase().replace(/^www\./, "");
    const swimmerId = url.pathname.match(/^\/swimmer\/(\d+)\/?$/)?.[1];
    if (host !== "swimcloud.com" || !swimmerId || seen.has(swimmerId)) continue;

    const name = (anchor.textContent ?? "").replace(/[\[\]*_`]/g, "").replace(/\s+/g, " ").trim();
    if (!name) continue;
    const row = anchor.closest("tr, [role='row']");
    const cellElements = row
      ? [...row.querySelectorAll<HTMLElement>("th, td, [role='cell'], [role='gridcell']")]
      : [];
    const anchorCell = anchor.closest<HTMLElement>("th, td, [role='cell'], [role='gridcell']");
    const cells = cellElements.map((cell) => (cell.textContent ?? "").replace(/\s+/g, " ").trim());
    const nameCellIndex = anchorCell ? cellElements.indexOf(anchorCell) : -1;
    if (nameCellIndex >= 0) cells[nameCellIndex] = `[${name}](https://www.swimcloud.com/swimmer/${swimmerId})`;
    const rowText = cells.some(Boolean)
      ? cells.filter(Boolean).join("\t")
      : (row?.textContent ?? anchor.parentElement?.textContent ?? "").replace(/\s+/g, " ").trim();
    hints.push(nameCellIndex >= 0
      ? rowText
      : `[${name}](https://www.swimcloud.com/swimmer/${swimmerId})\t${rowText}`);
    seen.add(swimmerId);
  }
  return hints.join("\n").slice(0, 50_000);
}

function BulkTab({
  collegeId,
  swimcloudRosterUrl,
  rosterCount,
}: {
  collegeId: string;
  swimcloudRosterUrl: string | null;
  rosterCount: number;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [clipboardHints, setClipboardHints] = useState("");
  const [preview, setPreview] = useState<ParsedRosterSwimmer[] | null>(null);
  const [excluded, setExcluded] = useState<ReadonlySet<number>>(new Set());
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const included = preview ? preview.filter((_, index) => !excluded.has(index)) : [];
  const autoExcludedDivers = preview
    ? preview.filter((swimmer, index) => swimmer.isDiver && excluded.has(index)).length
    : 0;

  function doPreview() {
    setMsg(null);
    start(async () => {
      const parsed = await parseRosterBulk([clipboardHints, text].filter(Boolean).join("\n"));
      setPreview(parsed);
      setExcluded(new Set(parsed.flatMap((swimmer, index) => (swimmer.isDiver ? [index] : []))));
      if (parsed.length === 0) {
        setMsg("No swimmers were found. Make sure the copy includes the Name header through the final roster row.");
      }
    });
  }

  function toggleExcluded(index: number) {
    setExcluded((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function handleRosterPaste(event: React.ClipboardEvent<HTMLTextAreaElement>) {
    const hints = swimCloudClipboardHints(event.clipboardData.getData("text/html"));
    if (!hints) return;

    event.preventDefault();
    const field = event.currentTarget;
    const pasted = event.clipboardData.getData("text/plain");
    const startAt = field.selectionStart;
    const endAt = field.selectionEnd;
    const nextText = `${text.slice(0, startAt)}${pasted}${text.slice(endAt)}`;
    const caret = startAt + pasted.length;
    setText(nextText);
    setClipboardHints((current) => (
      startAt === 0 && endAt === text.length
        ? hints
        : [current, hints].filter(Boolean).join("\n")
    ));
    setPreview(null);
    setExcluded(new Set());
    setMsg(null);
    requestAnimationFrame(() => field.setSelectionRange(caret, caret));
  }

  function selectMember(index: number, memberId: string) {
    setPreview((current) => current?.map((swimmer, swimmerIndex) => (
      swimmerIndex === index ? { ...swimmer, swimsMemberId: memberId || null } : swimmer
    )) ?? null);
  }

  function save() {
    setMsg(null);
    start(async () => {
      const swimmers = included.map((swimmer) => ({
        fullName: swimmer.fullName,
        classYear: swimmer.classYear,
        classStanding: swimmer.classStanding,
        hometown: swimmer.hometown,
        swimcloudUrl: swimmer.swimcloudUrl,
        times: swimmer.times,
        swimsMemberId: swimmer.swimsMemberId,
      }));
      const res = await addRosterBulk({ collegeId, swimmers });
      if (res.ok) {
        setText("");
        setClipboardHints("");
        setPreview(null);
        setExcluded(new Set());
        const details = [
          res.enriched > 0 ? `${res.enriched} with verified times` : null,
          res.nameOnly > 0 ? `${res.nameOnly} name-only` : null,
          res.skipped > 0 ? `${res.skipped} skipped` : null,
        ].filter(Boolean).join(", ");
        setMsg(`Added ${res.added} ${res.added === 1 ? "swimmer" : "swimmers"}${details ? ` (${details})` : ""}.`);
        router.refresh();
      } else {
        setMsg(res.error);
      }
    });
  }

  return (
    <div className="space-y-3 text-sm">
      <SeasonReset collegeId={collegeId} rosterCount={rosterCount} />

      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
        <div>
          <p className="font-medium text-ink-1">Paste the full SwimCloud roster table.</p>
          <p className="mt-1 text-ink-2">
            Open the roster, select from the Name header through the final swimmer, copy, and paste below. Extra page text is fine;
            we identify the roster rows and propose USA Swimming matches for you to review.
          </p>
        </div>
        {swimcloudRosterUrl ? (
          <a href={swimcloudRosterUrl} target="_blank" rel="noreferrer" className="wr-btn wr-btn--neutral shrink-0">
            Open roster on SwimCloud
          </a>
        ) : null}
      </div>

      <label className="block">
        <span className="wr-field-label block">SwimCloud roster table</span>
        <FormControl.Textarea
          className="wr-control mt-1 min-h-40 w-full py-2 font-mono text-xs"
          value={text}
          onPaste={handleRosterPaste}
          onChange={(event) => {
            setText(event.target.value);
            setClipboardHints("");
            setPreview(null);
            setExcluded(new Set());
          }}
          placeholder={"Season 2025-2026 Men\nName\tHometown\tClass\n1\tSwimmer One\tExample City, OH\tSR\t650.00\n2\tSwimmer Two\tSample Town, IL\tFR\t640.00"}
        />
      </label>

      <div className="flex items-center gap-2">
        <button type="button" className="wr-btn wr-btn--neutral" disabled={busy || (text.trim().length < 4 && !clipboardHints)} onClick={doPreview}>
          Preview
        </button>
        {preview && preview.length > 0 ? (
          <button type="button" className="wr-btn wr-btn--primary" disabled={busy || included.length === 0} onClick={save}>
            {busy ? "Importing..." : `Import ${included.length} ${included.length === 1 ? "swimmer" : "swimmers"}`}
          </button>
        ) : null}
        {msg ? <span className="text-xs text-ink-2">{msg}</span> : null}
      </div>

      {preview && preview.length > 0 ? (
        <div className="max-h-64 overflow-y-auto rounded-md border border-[var(--line)]">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--line)] text-left text-ink-3">
                <th className="px-3 py-2 font-medium">Roster name</th>
                <th className="px-3 py-2 font-medium">Class</th>
                <th className="px-3 py-2 font-medium">USA Swimming identity</th>
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {preview.map((s, i) => {
                const selectedCandidate = s.candidates.find((candidate) => candidate.memberId === s.swimsMemberId) ?? null;
                const isExcluded = excluded.has(i);
                const year = rosterClassDisplay(s);
                return (
                  <tr key={i} className={`border-b border-[var(--line)] last:border-0 ${isExcluded ? "opacity-45" : ""}`}>
                  <td className="px-3 py-2">
                    <div className={`font-medium ${isExcluded ? "line-through" : ""}`}>{s.fullName}</div>
                    {s.hometown ? <div className="text-[11px] text-ink-3">{s.hometown}</div> : null}
                    {s.isDiver ? <div className="text-[11px] text-ink-3">Listed as a diver</div> : null}
                    {s.swimcloudUrl ? (
                      <a href={s.swimcloudUrl} target="_blank" rel="noreferrer" className="text-[11px] text-[var(--accent-2)] underline underline-offset-2">
                        SwimCloud profile
                      </a>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-ink-3">
                    <div>{year.label}</div>
                    {year.detail ? <div className="text-[11px]">{year.detail}</div> : null}
                  </td>
                  <td className="px-3 py-2 text-ink-2">
                    {s.times.length > 0 ? (
                      <span>
                        {s.times.length} pasted {s.times.length === 1 ? "time" : "times"}: {s.times.slice(0, 2).map((t) => `${t.event} ${fmtClock(t.seconds)}`).join(", ")}
                      </span>
                    ) : s.candidates.length > 0 ? (
                      <div className="min-w-64 space-y-1.5">
                        <FormControl.Select
                          className="wr-control w-full text-xs"
                          value={s.swimsMemberId ?? ""}
                          onChange={(event) => selectMember(i, event.target.value)}
                          disabled={isExcluded}
                          aria-label={`USA Swimming match for ${s.fullName}`}
                        >
                          <option value="">Keep as name only</option>
                          {s.candidates.map((candidate) => (
                            <option key={candidate.memberId} value={candidate.memberId}>
                              {candidate.shortName || candidate.fullName}
                              {candidate.age != null ? ` · age ${candidate.age}` : ""}
                              {candidate.lsc ? ` · ${candidate.lsc}` : ""}
                              {candidate.club ? ` · ${candidate.club}` : ""}
                            </option>
                          ))}
                        </FormControl.Select>
                        {selectedCandidate ? (
                          <p className="text-[11px] text-ink-3">
                            {selectedCandidate.matchStrength === "strong" ? "Strong match" : "Selected match"}
                            {selectedCandidate.matchSignals.length > 0 ? `: ${selectedCandidate.matchSignals.join(" · ")}.` : "."}
                          </p>
                        ) : (
                          <p className="text-[11px] text-ink-3">Review age and home region if no match is preselected.</p>
                        )}
                      </div>
                    ) : (
                      <span className="text-ink-3">Name only. No USA Swimming identity was found, including historical members.</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right align-top">
                    <button
                      type="button"
                      onClick={() => toggleExcluded(i)}
                      className="rounded px-1.5 py-0.5 text-ink-3 hover:bg-[var(--sunken)] hover:text-ink-1"
                      aria-label={isExcluded ? `Include ${s.fullName}` : `Leave ${s.fullName} out of this import`}
                      title={isExcluded ? "Include this athlete" : "Leave this athlete out"}
                    >
                      {isExcluded ? "Undo" : "×"}
                    </button>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
          {autoExcludedDivers > 0 ? (
            <p className="border-t border-[var(--line)] px-3 py-2 text-[11px] text-ink-3">
              {autoExcludedDivers} {autoExcludedDivers === 1 ? "athlete is" : "athletes are"} listed as diving and will not be
              imported. Divers have no USA Swimming times, so they cannot be scored. Use Undo to import one anyway.
            </p>
          ) : null}
          {included.some((swimmer) => swimmer.times.length === 0 && !swimmer.swimsMemberId) ? (
            <p className="border-t border-[var(--line)] px-3 py-2 text-[11px] text-ink-3">
              Name-only swimmers are still added to the roster, but they do not affect roster-gap ranking until times are attached.
              International athletes usually land here, since USA Swimming only holds domestic results.
            </p>
          ) : null}
          <p className="border-t border-[var(--line)] px-3 py-2 text-[11px] text-ink-3">
            USA Swimming shows each swimmer&apos;s current or summer club, not necessarily the college team. Strong matches use the roster name, class/age, and home region instead.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function SwimsTab({ collegeId }: { collegeId: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [members, setMembers] = useState<SwimsMember[]>([]);
  const [searching, start] = useTransition();
  const [adding, startAdd] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function search() {
    setMsg(null);
    start(async () => {
      const found = await searchSwimsMembersAction(query.trim());
      setMembers(found);
      if (found.length === 0) setMsg("No USA Swimming members matched that name.");
    });
  }

  function add(m: SwimsMember) {
    startAdd(async () => {
      const displayName = m.shortName || m.fullName;
      const res = await addRosterSwimmerFromSwims({ collegeId, memberId: m.memberId, fullName: displayName });
      setMsg(res.error ?? `Added ${displayName}.`);
      if (res.ok) router.refresh();
    });
  }

  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap items-end gap-2">
        <label className="grow">
          <span className="wr-field-label block">Swimmer name</span>
          <FormControl.Input
            className="wr-control mt-1 w-full"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            placeholder="Enter swimmer name"
          />
        </label>
        <button type="button" className="wr-btn wr-btn--neutral" disabled={searching || query.trim().length < 2} onClick={search}>
          {searching ? "Searching" : "Search"}
        </button>
      </div>

      {members.length > 0 ? (
        <ul className="divide-y divide-[var(--line)]">
          {members.map((m) => (
            <li key={m.memberId} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="truncate font-medium">{m.shortName || m.fullName}</p>
                <p className="truncate text-xs text-ink-3">
                  {[m.age != null ? `age ${m.age}` : null, m.lsc, m.club ? `current/summer club: ${m.club}` : null].filter(Boolean).join(" · ")}
                </p>
                {m.shortName && m.shortName !== m.fullName ? <p className="truncate text-[11px] text-ink-3">USA Swimming record: {m.fullName}</p> : null}
              </div>
              <button type="button" className="wr-btn wr-btn--neutral shrink-0" disabled={adding} onClick={() => add(m)}>
                Add
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {msg ? <p className="text-xs text-ink-2">{msg}</p> : null}
    </div>
  );
}

function ManualTab({ collegeId }: { collegeId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [classYear, setClassYear] = useState("");
  const [swimcloud, setSwimcloud] = useState("");
  const [pasted, setPasted] = useState("");
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function save() {
    setMsg(null);
    start(async () => {
      const times = (await parseRosterBulk(`${name || "Swimmer X"}\n${pasted}`))[0]?.times ?? [];
      const res = await addRosterSwimmer({
        collegeId,
        fullName: name,
        classYear: classYear ? Number(classYear) : null,
        swimcloudUrl: swimcloud || null,
        source: "manual",
        times,
      });
      if (res.ok) {
        setName(""); setClassYear(""); setSwimcloud(""); setPasted("");
        setMsg(res.error ?? "Swimmer added.");
        router.refresh();
      } else {
        setMsg(res.error);
      }
    });
  }

  return (
    <div className="space-y-3 text-sm">
      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          <span className="wr-field-label block">Name</span>
          <FormControl.Input className="wr-control mt-1 w-full" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          <span className="wr-field-label block">Class year</span>
          <FormControl.Input
            className="wr-control mt-1 w-full"
            inputMode="numeric"
            value={classYear}
            onChange={(e) => setClassYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="2027"
          />
        </label>
      </div>
      <label className="block">
        <span className="wr-field-label block">SwimCloud link (optional)</span>
        <FormControl.Input className="wr-control mt-1 w-full" value={swimcloud} onChange={(e) => setSwimcloud(e.target.value)} placeholder="https://www.swimcloud.com/swimmer/..." />
      </label>
      <label className="block">
        <span className="wr-field-label block">Paste best times</span>
        <FormControl.Textarea
          className="wr-control mt-1 min-h-24 w-full py-2"
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          placeholder={"100 Free 45.32 SCY\n200 IM 1:48.10 SCY"}
        />
      </label>

      <div className="flex items-center gap-2">
        <button type="button" className="wr-btn wr-btn--primary" disabled={busy || name.trim().length < 1} onClick={save}>
          Add swimmer
        </button>
        {msg ? <span className="text-xs text-ink-2">{msg}</span> : null}
      </div>
    </div>
  );
}
