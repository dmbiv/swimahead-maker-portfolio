"use client";

import * as FormControl from "@/components/form-control";
import { useState, useTransition } from "react";
import { findSwimmerByName, importOfficialTimes } from "@/lib/swimmer-actions";
import type { SwimsMember } from "@/lib/types";

export function SwimsImport({ swimsMemberId }: { swimsMemberId: string | null }) {
  const [name, setName] = useState("");
  const [lsc, setLsc] = useState("");
  const [members, setMembers] = useState<SwimsMember[] | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "error" | "neutral"; text: string } | null>(null);
  const [busy, start] = useTransition();

  const search = () => {
    setMsg(null); setMembers(null);
    start(async () => {
      const res = await findSwimmerByName(name.trim(), lsc || undefined);
      if (!res.ok) { setMsg({ tone: "error", text: res.error ?? "Search is unavailable." }); return; }
      if (res.members.length === 0) { setMsg({ tone: "neutral", text: "No swimmers matched. Check the spelling or add your LSC code." }); return; }
      setMembers(res.members);
      setMsg({ tone: "neutral", text: `${res.members.length} ${res.members.length === 1 ? "match" : "matches"} found. Use age, LSC, and current or former club to confirm.` });
    });
  };

  const importFor = (memberId: string) => {
    setMsg(null);
    start(async () => {
      const res = await importOfficialTimes(memberId);
      if (res.ok) { setMsg({ tone: "ok", text: res.count > 0 ? `Added ${res.count} new official ${res.count === 1 ? "result" : "results"}. Your earlier result history was kept.` : "Your official times are already current." }); setMembers(null); setName(""); }
      else setMsg({ tone: "error", text: res.error ?? "Import failed." });
    });
  };

  return (
    <div className="wr-card p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Official USA Swimming times</div>
          <p className="mt-0.5 text-xs text-ink-2">Search once, then use one-click sync when new results post.</p>
        </div>
        {swimsMemberId && <button type="button" onClick={() => importFor(swimsMemberId)} disabled={busy} className="wr-btn wr-btn--primary wr-btn--small">{busy ? "Syncing…" : "Sync official times"}</button>}
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="min-w-48 flex-1">
          <span className="wr-field-label block">Swimmer name</span>
          <FormControl.Input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && name.trim().length >= 2) search(); }} placeholder="First and last name" autoComplete="name" className="wr-control" />
        </label>
        <label className="w-24">
          <span className="wr-field-label block">LSC (optional)</span>
          <FormControl.Input value={lsc} onChange={(e) => setLsc(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4))} placeholder="NC" autoCapitalize="characters" className="wr-control" />
        </label>
        <button type="button" onClick={search} disabled={busy || name.trim().length < 2} className="wr-btn wr-btn--neutral">{busy && !members ? "Searching…" : "Search"}</button>
      </div>

      {members && (
        <div className="mt-2 border border-line rounded-[var(--radius)] divide-y divide-line/60 max-h-64 overflow-auto wr-scroll">
          {members.map((m) => (
            <div key={m.memberId} className="flex items-center gap-3 px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{m.shortName || m.fullName}</div>
                <div className="text-[11px] text-ink-3">{[m.age != null ? `age ${m.age}` : null, m.lsc, m.club ? `current/former club: ${m.club}` : null].filter(Boolean).join(" · ")}</div>
                {m.shortName && m.shortName !== m.fullName ? <div className="text-[11px] text-ink-3">USA Swimming record: {m.fullName}</div> : null}
              </div>
              <button type="button" onClick={() => importFor(m.memberId)} disabled={busy} className="wr-btn wr-btn--neutral wr-btn--small">Import</button>
            </div>
          ))}
        </div>
      )}
      {msg && <p className={`mt-2 text-xs ${msg.tone === "error" ? "text-bad" : msg.tone === "ok" ? "text-good" : "text-ink-2"}`} role={msg.tone === "error" ? "alert" : undefined} aria-live="polite">{msg.text}</p>}
    </div>
  );
}
