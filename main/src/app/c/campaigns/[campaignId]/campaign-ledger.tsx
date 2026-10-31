"use client";

import * as FormControl from "@/components/form-control";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { buildSwimCloudResolverPath } from "@/lib/swimcloud-links";
import { gmailSearchThreadUrl } from "@/lib/gmail";
import {
  updateRecruit,
  removeRecruit,
  refreshRecruitTimes,
  addManualRecruit,
  listMoveTargets,
  moveRecruitToCampaign,
  type MoveTarget,
} from "@/lib/ledger-actions";
import {
  RECRUITING_CONTACT_RIGHTS_NOTICE,
  RECRUIT_STAGES,
  RECRUIT_STAGE_LABELS,
  ledgerEmailNeedsRightsAttestation,
  type LedgerRecruit,
  type RecruitStage,
  type RecruitPriority,
} from "@/lib/ledger-defs";
import { EVENT_LABELS, EVENT_ORDER } from "@/lib/events";
import type { EventCode, Gender } from "@/lib/types";
import { fmtClock } from "@/lib/time";
import {
  isWorkspaceDirectContactSource,
  WORKSPACE_DIRECT_CONTACT_SOURCE_LABELS,
} from "@/lib/workspace-contact-provenance";

const CONTACT_DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "numeric",
  day: "numeric",
  year: "numeric",
  timeZone: "America/New_York",
});

export type { LedgerRecruit } from "@/lib/ledger-defs";

const PRIORITY_LABEL: Record<RecruitPriority, string> = { high: "High", medium: "Medium", low: "Low" };
const PRIORITY_DOT: Record<RecruitPriority, string> = {
  high: "var(--danger, #c0392b)",
  medium: "var(--warn, #b8860b)",
  low: "var(--ink-3)",
};

const STAGE_TONE: Record<RecruitStage, string> = {
  identified: "text-ink-2",
  contacted: "text-ink-1",
  responded: "text-[var(--accent-2)]",
  visiting: "text-[var(--accent-2)]",
  committed: "text-[var(--good)]",
  passed: "text-ink-3 line-through",
};

export function CampaignLedger({
  campaignId,
  classYear,
  gender,
  rows,
}: {
  campaignId: string;
  classYear: number;
  gender: Gender;
  rows: LedgerRecruit[];
}) {
  const grouped = groupByStage(rows);
  const [adding, setAdding] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold">Ledger</h2>
        <div className="flex items-center gap-3">
          {rows.length > 0 ? (
            <span className="text-xs text-ink-3">
              {rows.length} tracked · {rows.filter((r) => r.stage === "committed").length} committed
            </span>
          ) : null}
          <button type="button" className="wr-btn wr-btn--neutral wr-btn--small" onClick={() => setAdding((v) => !v)}>
            {adding ? "Close" : "+ Add manually"}
          </button>
        </div>
      </div>

      {adding ? (
        <ManualAddForm
          campaignId={campaignId}
          classYear={classYear}
          gender={gender}
          onDone={() => setAdding(false)}
        />
      ) : null}

      {rows.length === 0 ? (
        <p className="text-sm text-ink-3">
          No recruits tracked yet. Add swimmers from the search above, or use <span className="text-ink-2">Add manually</span> for someone not in the pool.
        </p>
      ) : (
        <div className="wr-card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--line)] text-left text-xs text-ink-3">
                <th className="w-10 px-2 py-2" />
                <th className="px-3 py-2 font-normal">Swimmer</th>
                <th className="px-3 py-2 font-normal">Class</th>
                <th className="px-3 py-2 font-normal">Best (SCY)</th>
                <th className="px-3 py-2 font-normal">Stage</th>
                <th className="px-3 py-2 font-normal">Priority</th>
                <th className="px-3 py-2 font-normal" />
              </tr>
            </thead>
            <tbody>
              {grouped.map(({ stage, recruits }) => (
                <StageGroup key={stage} stage={stage} recruits={recruits} campaignId={campaignId} showHeader={grouped.length > 1} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ManualAddForm({
  campaignId,
  classYear,
  gender,
  onDone,
}: {
  campaignId: string;
  classYear: number;
  gender: Gender;
  onDone: () => void;
}) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [lsc, setLsc] = useState("");
  const [club, setClub] = useState("");
  const [event, setEvent] = useState<EventCode | "">("");
  const [time, setTime] = useState("");
  const [swimcloudUrl, setSwimcloudUrl] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, start] = useTransition();

  function submit() {
    setErr(null);
    if (fullName.trim().length === 0) {
      setErr("Enter the swimmer's name.");
      return;
    }
    start(async () => {
      const res = await addManualRecruit({
        campaignId,
        fullName,
        lsc: lsc || null,
        club: club || null,
        bestEvent: event || null,
        bestTime: time || null,
        swimcloudUrl: swimcloudUrl || null,
      });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      router.refresh();
      onDone();
    });
  }

  return (
    <div className="wr-card space-y-3 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium">Add a swimmer by hand</p>
        <p className="text-xs text-ink-3">
          Joins this campaign as class of {classYear} · {gender === "F" ? "Women" : "Men"}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-xs sm:col-span-2 lg:col-span-1">
          <span className="wr-field-label block">Full name</span>
          <FormControl.Input
            className="wr-control mt-1 w-full"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Jane Smith"
            autoFocus
          />
        </label>
        <label className="text-xs">
          <span className="wr-field-label block">LSC (optional)</span>
          <FormControl.Input
            className="wr-control mt-1 w-full"
            value={lsc}
            onChange={(e) => setLsc(e.target.value)}
            placeholder="e.g. NE"
          />
        </label>
        <label className="text-xs">
          <span className="wr-field-label block">Club (optional)</span>
          <FormControl.Input
            className="wr-control mt-1 w-full"
            value={club}
            onChange={(e) => setClub(e.target.value)}
            placeholder="Club or high school"
          />
        </label>
        <label className="text-xs">
          <span className="wr-field-label block">Best event (optional)</span>
          <FormControl.Select className="wr-control mt-1 w-full" value={event} onChange={(e) => setEvent(e.target.value as EventCode | "")}>
            <option value="">None</option>
            {EVENT_ORDER.map((code) => (
              <option key={code} value={code}>{EVENT_LABELS[code]}</option>
            ))}
          </FormControl.Select>
        </label>
        <label className="text-xs">
          <span className="wr-field-label block">Best time (SCY)</span>
          <FormControl.Input
            className="wr-control mt-1 w-full tabular-nums"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            placeholder="1:52.34"
            disabled={!event}
          />
        </label>
        <label className="text-xs sm:col-span-2 lg:col-span-3">
          <span className="wr-field-label block">SwimCloud link (optional)</span>
          <FormControl.Input
            className="wr-control mt-1 w-full"
            value={swimcloudUrl}
            onChange={(e) => setSwimcloudUrl(e.target.value)}
            placeholder="https://www.swimcloud.com/swimmer/..."
          />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="wr-btn wr-btn--primary wr-btn--small" disabled={busy} onClick={submit}>
          {busy ? "Adding..." : "Add to ledger"}
        </button>
        <button type="button" className="wr-btn wr-btn--neutral wr-btn--small" disabled={busy} onClick={onDone}>
          Cancel
        </button>
        {err ? <span className="text-xs text-[var(--danger,#c0392b)]">{err}</span> : null}
      </div>
    </div>
  );
}

function StageGroup({ stage, recruits, campaignId, showHeader }: { stage: RecruitStage; recruits: LedgerRecruit[]; campaignId: string; showHeader: boolean }) {
  return (
    <>
      {showHeader ? (
        <tr className="bg-[var(--sunken)]">
          <td colSpan={7} className="px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-ink-3">
            {RECRUIT_STAGE_LABELS[stage]} ({recruits.length})
          </td>
        </tr>
      ) : null}
      {recruits.map((r) => (
        <LedgerRow key={r.id} recruit={r} campaignId={campaignId} />
      ))}
    </>
  );
}

function LedgerRow({ recruit, campaignId }: { recruit: LedgerRecruit; campaignId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, start] = useTransition();
  const scUrl = recruit.swimcloudUrl ?? buildSwimCloudResolverPath({
    fullName: recruit.fullName,
    classYears: [recruit.classYear, recruit.classYearMin, recruit.classYearMax]
      .filter((year): year is number => year != null),
    lscCode: recruit.lsc,
  });
  const directContactIsAttested = Boolean(
    recruit.email &&
    recruit.contactRightsAttestedAt &&
    isWorkspaceDirectContactSource(recruit.contactSource),
  );
  const threadUrl = directContactIsAttested
    ? gmailSearchThreadUrl({ email: recruit.email, name: recruit.fullName })
    : null;

  async function patch(update: Parameters<typeof updateRecruit>[0]) {
    const result = await updateRecruit(update);
    if (result.ok) router.refresh();
    return result;
  }

  function queuePatch(update: Parameters<typeof updateRecruit>[0]) {
    start(async () => {
      await patch(update);
    });
  }

  return (
    <>
      <tr className="border-b border-[var(--line)]">
        <td className="py-2 pl-2 pr-1 text-center">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md leading-none text-ink-2 transition-colors hover:bg-[var(--sunken)] hover:text-ink-1"
            aria-label={open ? "Collapse" : "Expand"}
            aria-expanded={open}
          >
            <span className={`text-[26px] leading-none transition-transform duration-150 ${open ? "rotate-90" : ""}`}>▸</span>
          </button>
        </td>
        <td className="px-3 py-2">
          <div className="font-medium">{recruit.fullName}</div>
          {recruit.club ? <div className="text-xs text-ink-3">{[recruit.club, recruit.lsc].filter(Boolean).join(" · ")}</div> : null}
        </td>
        <td className="px-3 py-2 tabular-nums">{classLabel(recruit)}</td>
        <td className="px-3 py-2 tabular-nums text-ink-2">
          {recruit.bestEvent ? `${recruit.bestEvent} ${recruit.bestTime ?? ""}`.trim() : "Not set"}
        </td>
        <td className="px-3 py-2">
          <FormControl.Select
            className={`wr-control wr-control--bare text-xs ${STAGE_TONE[recruit.stage]}`}
            value={recruit.stage}
            disabled={busy}
            onChange={(e) => queuePatch({ recruitId: recruit.id, campaignId, stage: e.target.value as RecruitStage })}
          >
            {RECRUIT_STAGES.map((s) => <option key={s} value={s}>{RECRUIT_STAGE_LABELS[s]}</option>)}
          </FormControl.Select>
        </td>
        <td className="px-3 py-2">
          <span className="flex items-center gap-1.5">
            {recruit.priority ? (
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: PRIORITY_DOT[recruit.priority] }} aria-hidden />
            ) : null}
            <FormControl.Select
              className="wr-control wr-control--bare text-xs"
              value={recruit.priority ?? ""}
              disabled={busy}
              onChange={(e) => queuePatch({ recruitId: recruit.id, campaignId, priority: (e.target.value || null) as RecruitPriority | null })}
            >
              <option value="">No priority</option>
              {(["high", "medium", "low"] as RecruitPriority[]).map((p) => (
                <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>
              ))}
            </FormControl.Select>
          </span>
        </td>
        <td className="px-3 py-2 text-right">
          <div className="flex items-center justify-end gap-1.5">
            {threadUrl ? (
              <a href={threadUrl} target="_blank" rel="noreferrer" className="wr-btn wr-btn--neutral wr-btn--small" title="Open recent email thread with this recruit">Email ↗</a>
            ) : null}
            <a href={scUrl} target="_blank" rel="noreferrer" className="wr-btn wr-btn--neutral wr-btn--small">
              <span>SwimCloud</span><span aria-hidden>↗</span>
            </a>
          </div>
        </td>
      </tr>

      {open ? (
        <tr className="border-b border-[var(--line)] bg-[var(--sunken)]">
          <td />
          <td colSpan={6} className="px-3 py-3">
            <RecruitDetail recruit={recruit} campaignId={campaignId} onPatch={patch} busy={busy} />
          </td>
        </tr>
      ) : null}
    </>
  );
}

function RecruitDetail({
  recruit,
  campaignId,
  onPatch,
  busy,
}: {
  recruit: LedgerRecruit;
  campaignId: string;
  onPatch: (u: Parameters<typeof updateRecruit>[0]) => Promise<Awaited<ReturnType<typeof updateRecruit>>>;
  busy: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState(recruit.email ?? "");
  const [phone, setPhone] = useState(recruit.phone ?? "");
  const [notes, setNotes] = useState(recruit.notes ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [msgIsError, setMsgIsError] = useState(false);
  const [emailRightsAttested, setEmailRightsAttested] = useState(false);
  const [acting, startAct] = useTransition();
  const emailRightsRequired = ledgerEmailNeedsRightsAttestation({
    currentEmail: recruit.email,
    nextEmail: email,
    contactSource: recruit.contactSource,
    contactRightsAttestedAt: recruit.contactRightsAttestedAt,
  });

  function saveContact() {
    setMsg(null);
    if (emailRightsRequired && !emailRightsAttested) {
      setMsgIsError(true);
      setMsg("Confirm your program's one-to-one recruiting-contact rights for this email.");
      return;
    }
    startAct(async () => {
      const res = await onPatch({
        recruitId: recruit.id,
        campaignId,
        email,
        emailRightsAttested,
        phone,
        notes,
      });
      setMsgIsError(!res.ok);
      setMsg(res.ok ? "Saved." : res.error);
    });
  }

  function markContacted() {
    setMsg(null);
    startAct(async () => {
      const res = await onPatch({ recruitId: recruit.id, campaignId, markContacted: true });
      setMsgIsError(!res.ok);
      setMsg(res.ok ? "Marked contacted." : res.error);
    });
  }

  function refresh() {
    setMsg(null);
    startAct(async () => {
      const res = await refreshRecruitTimes(recruit.id, campaignId);
      setMsgIsError(!res.ok);
      setMsg(res.error ?? `Added ${res.added} time ${res.added === 1 ? "snapshot" : "snapshots"}.`);
      router.refresh();
    });
  }

  function remove() {
    startAct(async () => {
      await removeRecruit(recruit.id, campaignId);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs">
            <span className="wr-field-label block">Email</span>
            <FormControl.Input
              className="wr-control mt-1 w-full"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setEmailRightsAttested(false);
              }}
              placeholder="Not set"
              autoComplete="email"
            />
          </label>
          <label className="text-xs">
            <span className="wr-field-label block">Phone</span>
            <FormControl.Input className="wr-control mt-1 w-full" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Not set" />
          </label>
        </div>
        {emailRightsRequired ? (
          <label className="flex items-start gap-2.5 rounded-md border border-[var(--line)] bg-[var(--surface)] p-3 text-xs leading-5 text-ink-2">
            <FormControl.Input
              className="mt-1 size-4 shrink-0 accent-[var(--accent)]"
              type="checkbox"
              checked={emailRightsAttested}
              onChange={(event) => setEmailRightsAttested(event.target.checked)}
            />
            <span>{RECRUITING_CONTACT_RIGHTS_NOTICE}</span>
          </label>
        ) : recruit.email && recruit.contactSource && recruit.contactRightsAttestedAt ? (
          <p className="text-[11px] text-ink-3">
            Source: {WORKSPACE_DIRECT_CONTACT_SOURCE_LABELS[recruit.contactSource]}. Recruiting-use rights are recorded.
          </p>
        ) : null}
        <label className="block text-xs">
          <span className="wr-field-label block">Notes</span>
          <FormControl.Textarea className="wr-control mt-1 min-h-20 w-full py-2" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Visit dates, conversation notes, academic fit..." />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="wr-btn wr-btn--neutral wr-btn--small"
            disabled={busy || acting || (emailRightsRequired && !emailRightsAttested)}
            onClick={saveContact}
          >
            Save details
          </button>
          <button type="button" className="wr-btn wr-btn--neutral wr-btn--small" disabled={busy || acting} onClick={markContacted}>Mark contacted</button>
          <button type="button" className="wr-btn wr-btn--neutral wr-btn--small" disabled={acting} onClick={refresh}>Refresh times</button>
          <button type="button" className="text-xs text-ink-3 underline underline-offset-2 hover:text-[var(--danger,#c0392b)]" disabled={acting} onClick={remove}>Remove</button>
          {msg ? (
            <span className={`text-xs ${msgIsError ? "text-[var(--danger,#c0392b)]" : "text-ink-2"}`}>{msg}</span>
          ) : null}
        </div>
        <MoveRecruit recruitId={recruit.id} campaignId={campaignId} />
        {recruit.lastContactedAt ? (
          <p className="text-[11px] text-ink-3">Last contacted {CONTACT_DATE_FORMAT.format(new Date(recruit.lastContactedAt))}.</p>
        ) : null}
      </div>

      <div>
        <p className="wr-field-label mb-1">Times this season</p>
        {recruit.snapshots.length === 0 ? (
          <p className="text-xs text-ink-3">No time history yet. Use Refresh times to pull from the recruit pool.</p>
        ) : (
          <ul className="space-y-0.5 text-xs">
            {recruit.snapshots.map((s, i) => (
              <li key={i} className="flex items-center justify-between gap-2 tabular-nums">
                <span>{s.event} {s.course}</span>
                <span className="text-ink-2">{fmtClock(s.seconds)}{s.score != null ? <span className="ml-1 text-ink-3">({s.score})</span> : null}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function MoveRecruit({ recruitId, campaignId }: { recruitId: string; campaignId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [targets, setTargets] = useState<MoveTarget[] | null>(null);
  const [target, setTarget] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, start] = useTransition();

  function toggle() {
    setMsg(null);
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (targets === null) {
      start(async () => setTargets(await listMoveTargets(recruitId)));
    }
  }

  function move() {
    if (!target) return;
    setMsg(null);
    start(async () => {
      const res = await moveRecruitToCampaign({ recruitId, fromCampaignId: campaignId, toCampaignId: target });
      if (!res.ok) {
        setMsg(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="text-xs">
      <button type="button" className="text-ink-3 underline underline-offset-2 hover:text-ink-1" onClick={toggle}>
        {open ? "Cancel move" : "Move to another campaign"}
      </button>
      {open ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {targets === null ? (
            <span className="text-ink-3">Loading campaigns…</span>
          ) : targets.length === 0 ? (
            <span className="text-ink-3">No other campaigns for this program yet.</span>
          ) : (
            <>
              <FormControl.Select className="wr-control" value={target} onChange={(e) => setTarget(e.target.value)} disabled={busy}>
                <option value="">Choose a campaign…</option>
                {targets.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}: class of {t.classYear}, {t.gender === "F" ? "Women" : "Men"}
                  </option>
                ))}
              </FormControl.Select>
              <button type="button" className="wr-btn wr-btn--neutral wr-btn--small" disabled={busy || !target} onClick={move}>
                {busy ? "Moving…" : "Move"}
              </button>
            </>
          )}
          {msg ? <span className="text-[var(--danger,#c0392b)]">{msg}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

function classLabel(recruit: LedgerRecruit): string {
  if (recruit.classConfidence === "exact" && recruit.classYear != null) return String(recruit.classYear);
  if (recruit.classYearMin != null && recruit.classYearMax != null) {
    return recruit.classYearMin === recruit.classYearMax
      ? String(recruit.classYearMin)
      : `${recruit.classYearMin} or ${recruit.classYearMax}`;
  }
  return recruit.classYear != null ? String(recruit.classYear) : "Not set";
}

function groupByStage(rows: LedgerRecruit[]): { stage: RecruitStage; recruits: LedgerRecruit[] }[] {
  const order: RecruitStage[] = ["visiting", "responded", "contacted", "identified", "committed", "passed"];
  return order
    .map((stage) => ({ stage, recruits: rows.filter((r) => r.stage === stage) }))
    .filter((group) => group.recruits.length > 0);
}
