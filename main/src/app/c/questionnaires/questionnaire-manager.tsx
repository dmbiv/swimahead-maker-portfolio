"use client";

import * as FormControl from "@/components/form-control";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "@/components/app-link";
import {
  createQuestionnaire,
  updateQuestionnaire,
  setQuestionnaireStatus,
} from "@/lib/questionnaire-actions";
import type { Questionnaire } from "@/lib/questionnaire-defs";
import { type QuestionField } from "@/lib/questionnaire-fields";
import { QuestionBuilder } from "./question-builder";

type CampaignOption = { id: string; name: string; classYear: number };

export function QuestionnaireManager({
  collegeId,
  questionnaires,
  campaigns,
  siteUrl,
}: {
  collegeId: string;
  questionnaires: Questionnaire[];
  campaigns: CampaignOption[];
  siteUrl: string | null;
}) {
  return (
    <div className="space-y-6">
      <CreateForm collegeId={collegeId} campaigns={campaigns} />

      {questionnaires.length === 0 ? (
        <p className="text-sm text-ink-3">No questionnaires yet. Create one above to get a shareable link.</p>
      ) : (
        <ul className="space-y-3">
          {questionnaires.map((q) => (
            <QuestionnaireCard key={q.id} questionnaire={q} siteUrl={siteUrl} />
          ))}
        </ul>
      )}
    </div>
  );
}

function CreateForm({ collegeId, campaigns }: { collegeId: string; campaigns: CampaignOption[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [intro, setIntro] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [extraFields, setExtraFields] = useState<QuestionField[]>([]);
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    start(async () => {
      const res = await createQuestionnaire({ title: title.trim() || "Recruiting questionnaire", intro, collegeId, campaignId: campaignId || null, extraFields });
      if (res.ok) {
        setTitle("");
        setIntro("");
        setCampaignId("");
        setExtraFields([]);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="wr-card max-w-2xl space-y-3 p-4">
      <h2 className="text-base font-semibold">New questionnaire</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="wr-field-label block">Title</span>
          <FormControl.Input className="wr-control mt-1 w-full" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Recruiting questionnaire" />
        </label>
        <label className="text-sm">
          <span className="wr-field-label block">Attach to campaign (optional)</span>
          <FormControl.Select className="wr-control mt-1 w-full" value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
            <option value="">No campaign</option>
            {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name} (Class of {c.classYear})</option>)}
          </FormControl.Select>
        </label>
      </div>
      <label className="block text-sm">
        <span className="wr-field-label block">Intro shown to recruits (optional)</span>
        <FormControl.Textarea className="wr-control mt-1 min-h-16 w-full py-2" value={intro} onChange={(e) => setIntro(e.target.value)} placeholder="Tell recruits what this is and what happens next." />
      </label>

      <QuestionBuilder fields={extraFields} onChange={setExtraFields} />

      <div className="flex items-center gap-3">
        <button type="button" className="wr-btn wr-btn--primary" disabled={busy} onClick={submit}>
          {busy ? "Creating..." : "Create questionnaire"}
        </button>
        {error ? <span className="text-xs text-[var(--danger,#c0392b)]">{error}</span> : null}
      </div>
      <p className="text-xs text-ink-3">
        Every questionnaire collects name, graduation year, contact info, SwimCloud link, and best times by default.
      </p>
    </div>
  );
}

function QuestionnaireCard({ questionnaire, siteUrl }: { questionnaire: Questionnaire; siteUrl: string | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(questionnaire.title);
  const [fields, setFields] = useState<QuestionField[]>(questionnaire.extraFields);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();
  const [copied, setCopied] = useState(false);

  const sharePath = `/r/${questionnaire.shareToken}`;
  const shareUrl = siteUrl ? `${siteUrl}${sharePath}` : sharePath;

  function copy() {
    const absoluteShareUrl = siteUrl
      ? shareUrl
      : new URL(sharePath, window.location.href).toString();
    navigator.clipboard?.writeText(absoluteShareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function toggleStatus() {
    startBusy(async () => {
      await setQuestionnaireStatus(questionnaire.id, questionnaire.status === "active" ? "closed" : "active");
      router.refresh();
    });
  }

  function toggleEditing() {
    if (!editing) {
      setTitle(questionnaire.title);
      setFields(questionnaire.extraFields);
      setSaveMsg(null);
    }
    setEditing((v) => !v);
  }

  function saveEdits() {
    setSaveMsg(null);
    startBusy(async () => {
      const res = await updateQuestionnaire({ id: questionnaire.id, title, intro: questionnaire.intro, extraFields: fields });
      if (res.ok) {
        setEditing(false);
        router.refresh();
      } else {
        setSaveMsg(res.error);
      }
    });
  }

  return (
    <li className="wr-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium">{questionnaire.title}</span>
            <span className={`rounded px-1.5 py-0.5 text-[10px] ${questionnaire.status === "active" ? "bg-[color-mix(in_srgb,var(--good)_16%,transparent)] text-[var(--good)]" : "bg-[var(--sunken)] text-ink-3"}`}>
              {questionnaire.status === "active" ? "Active" : "Closed"}
            </span>
          </div>
          <p className="mt-1 text-sm text-ink-2">
            {questionnaire.submissionCount} {questionnaire.submissionCount === 1 ? "submission" : "submissions"}
            {questionnaire.newCount > 0 ? `, ${questionnaire.newCount} new` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="wr-btn wr-btn--neutral wr-btn--small" onClick={copy}>{copied ? "Copied" : "Copy link"}</button>
          <a href={shareUrl} target="_blank" rel="noreferrer" className="wr-btn wr-btn--neutral wr-btn--small">Preview</a>
          <button type="button" className="wr-btn wr-btn--neutral wr-btn--small" disabled={busy} onClick={toggleStatus}>
            {questionnaire.status === "active" ? "Close" : "Reopen"}
          </button>
          <button type="button" className="wr-btn wr-btn--neutral wr-btn--small" onClick={toggleEditing}>
            {editing ? "Cancel edit" : "Edit questions"}
          </button>
          <Link href={`/c/questionnaires/${questionnaire.id}`} className="wr-btn wr-btn--primary wr-btn--small">
            View submissions
          </Link>
        </div>
      </div>

      <div className="mt-2 truncate rounded bg-[var(--sunken)] px-2 py-1 font-mono text-xs text-ink-3">{shareUrl}</div>

      {editing ? (
        <div className="mt-3 space-y-3 border-t border-[var(--line)] pt-3">
          <label className="block text-sm">
            <span className="wr-field-label block">Title</span>
            <FormControl.Input className="wr-control mt-1 w-full" value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <QuestionBuilder fields={fields} onChange={setFields} />
          <div className="flex items-center gap-3">
            <button type="button" className="wr-btn wr-btn--primary wr-btn--small" disabled={busy} onClick={saveEdits}>
              {busy ? "Saving..." : "Save questions"}
            </button>
            {saveMsg ? <span className="text-xs text-[var(--danger,#c0392b)]">{saveMsg}</span> : null}
          </div>
        </div>
      ) : null}
    </li>
  );
}
