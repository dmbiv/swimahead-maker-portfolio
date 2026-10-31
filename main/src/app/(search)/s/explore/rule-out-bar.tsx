"use client";

import * as FormControl from "@/components/form-control";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ruleOutMany } from "@/lib/swimmer-actions";
import { useProgramVisibility } from "./program-visibility";

export interface RuleTarget {
  programId: string;
  squad: "men" | "women" | "coed";
  netPrice: number | null;
  division: string | null;
  majors: string[];
  stateCode: string | null;
  status?: "saved" | "ruled_out";
}

export function RuleOutBar() {
  const [targets, setTargets] = useState<RuleTarget[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [majorOptions, setMajorOptions] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [price, setPrice] = useState("");
  const [major, setMajor] = useState("");
  const [division, setDivision] = useState("");
  const [state, setState] = useState("");
  const [squad, setSquad] = useState<RuleTarget["squad"] | "">("");
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ ids: string[]; label: string } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const { hidePrograms, programIds, restorePrograms } = useProgramVisibility();
  const divisions = [...new Set(targets.map((target) => target.division).filter((value): value is string => Boolean(value)))].sort();

  const load = async () => {
    if (loaded || loading) return;
    setLoading(true);
    setLoadError(false);
    try {
      const response = await fetch("/api/s/explore-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "rules", programIds }),
      });
      if (!response.ok) throw new Error(`Rule data request failed (${response.status})`);
      const payload = await response.json() as {
        targets?: RuleTarget[];
        states?: string[];
        majorOptions?: string[];
      };
      if (!Array.isArray(payload.targets) || !Array.isArray(payload.states) || !Array.isArray(payload.majorOptions)) {
        throw new Error("Invalid rule data response");
      }
      setTargets(payload.targets);
      setStates(payload.states);
      setMajorOptions(payload.majorOptions);
      setLoaded(true);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  const prepare = (matcher: (t: RuleTarget) => boolean, label: string) => {
    const ids = targets.filter((target) => !target.status && matcher(target)).map((target) => target.programId);
    if (ids.length === 0) { setMsg("Nothing matched that rule."); return; }
    setMsg(null);
    setConfirmation({ ids: [...new Set(ids)], label });
  };

  const apply = () => {
    if (!confirmation) return;
    const { ids, label } = confirmation;
    hidePrograms(ids);
    start(async () => {
      const res = await ruleOutMany(ids, label);
      setMsg(res.ok ? `Ruled out ${res.count} programs (${label}).` : "Couldn't apply that rule.");
      if (res.ok) router.refresh();
      else restorePrograms(ids);
      setConfirmation(null);
    });
  };

  return (
    <details
      className="wr-card bulk-rule-panel p-3 sm:p-4"
      onToggle={(event) => {
        if (event.currentTarget.open) void load();
      }}
    >
      <summary className="cursor-pointer text-sm font-semibold">Bulk rule-out tools <span className="ml-1 font-normal text-ink-3">Apply one condition to these results</span></summary>
      {!loaded && (
        <div className="mt-3 flex items-center gap-2 text-xs text-ink-3" aria-live="polite">
          <span>{loadError ? "The bulk tools couldn’t load." : "Loading bulk tools…"}</span>
          {loadError && <button type="button" className="wr-btn wr-btn--neutral wr-btn--small" onClick={() => void load()}>Try again</button>}
        </div>
      )}
      <p className="mt-2 text-xs text-ink-3">You’ll see the number of matches before anything changes. Programs already saved or ruled out are protected; restore exclusions any time from My programs.</p>
      <div className="mt-3 flex flex-wrap items-end gap-3 text-xs">
        <label>Over net price
          <div className="flex gap-1.5 mt-1">
            <FormControl.Input value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))} placeholder="35000" className="wr-control w-24" />
            <button type="button" className="wr-btn wr-btn--neutral wr-btn--small" disabled={!loaded || !price || pending}
              onClick={() => prepare((t) => t.netPrice !== null && t.netPrice > Number(price), `over $${Number(price).toLocaleString("en-US")}/yr`)}>
              Preview
            </button>
          </div>
        </label>

        <label>Without a major
          <div className="flex gap-1.5 mt-1">
            <FormControl.Select value={major} onChange={(e) => setMajor(e.target.value)} className="wr-control max-w-56">
              <option value="">Choose a major</option>
              {majorOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </FormControl.Select>
            <button type="button" className="wr-btn wr-btn--neutral wr-btn--small" disabled={!loaded || !major || pending}
              onClick={() => { const selected = major.toLocaleLowerCase(); prepare((t) => !t.majors.some((item) => item.toLocaleLowerCase() === selected), `no ${major}`); }}>
              Preview
            </button>
          </div>
        </label>

        <label>Squad
          <div className="flex gap-1.5 mt-1">
            <FormControl.Select value={squad} onChange={(e) => setSquad(e.target.value as typeof squad)} className="wr-control">
              <option value="">Any</option>
              <option value="men">Men’s</option>
              <option value="women">Women’s</option>
              <option value="coed">Coed</option>
            </FormControl.Select>
            <button type="button" className="wr-btn wr-btn--neutral wr-btn--small" disabled={!loaded || !squad || pending}
              onClick={() => prepare((t) => t.squad === squad, `${squad === "men" ? "men’s" : squad === "women" ? "women’s" : "coed"} squad`)}>
              Preview
            </button>
          </div>
        </label>

        <label>In division
          <div className="flex gap-1.5 mt-1">
            <FormControl.Select value={division} onChange={(e) => setDivision(e.target.value)} className="wr-control">
              <option value="">Any</option>
              {divisions.map((option) => <option key={option}>{option}</option>)}
            </FormControl.Select>
            <button type="button" className="wr-btn wr-btn--neutral wr-btn--small" disabled={!loaded || !division || pending}
              onClick={() => prepare((t) => t.division === division, `division ${division}`)}>
              Preview
            </button>
          </div>
        </label>

        <label>In state
          <div className="flex gap-1.5 mt-1">
            <FormControl.Select value={state} onChange={(e) => setState(e.target.value)} className="wr-control">
              <option value="">Any</option>{states.map((s) => <option key={s}>{s}</option>)}
            </FormControl.Select>
            <button type="button" className="wr-btn wr-btn--neutral wr-btn--small" disabled={!loaded || !state || pending}
              onClick={() => prepare((t) => t.stateCode === state, `state ${state}`)}>
              Preview
            </button>
          </div>
        </label>
      </div>
      {confirmation && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius)] border border-line-strong bg-sunken p-3">
          <p className="text-xs text-ink-2"><strong>{confirmation.ids.length}</strong> {confirmation.ids.length === 1 ? "program matches" : "programs match"} “{confirmation.label}”.</p>
          <div className="flex gap-2">
            <button type="button" className="wr-btn wr-btn--neutral wr-btn--small" onClick={() => setConfirmation(null)}>Cancel</button>
            <button type="button" className="wr-btn wr-btn--danger wr-btn--small" disabled={pending} onClick={apply}>{pending ? "Applying…" : `Rule out ${confirmation.ids.length}`}</button>
          </div>
        </div>
      )}
      {msg && <p className="mt-2 text-xs text-ink-2" aria-live="polite">{msg}</p>}
    </details>
  );
}
