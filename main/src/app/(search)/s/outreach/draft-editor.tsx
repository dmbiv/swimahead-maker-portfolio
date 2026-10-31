"use client";

import * as FormControl from "@/components/form-control";
import { useEffect, useState, useTransition } from "react";
import Link from "@/components/app-link";
import { useRouter } from "next/navigation";
import { Badge, Btn, Card, Select } from "@/components/ui";
import { CopyBtn } from "@/components/ui-interactive";
import { RichEmailEditor } from "@/components/rich-email-editor-lazy";
import { emailBodyToHtml, emailHtmlToText } from "@/lib/email-content";
import { gmailComposeUrl, mailtoUrl, outlookComposeUrl } from "@/lib/gmail";
import {
  OUTREACH_STAGE_LABELS,
  OUTREACH_DATABASE_UPDATE_ERROR,
  materializeOutreachTemplate,
  outreachMergeValues,
  outreachPlaceholderKeys,
  renderOutreachText,
  updateMaterializedOutreachCoachName,
  type OutreachDraftStatus,
  type OutreachProgram,
  type OutreachSwimmer,
  type OutreachTimeConfig,
  type SwimmerOutreachDraft,
  type SwimmerOutreachTemplate,
} from "@/lib/swimmer-outreach";
import { saveOutreachDraft } from "./actions";

type DraftForm = {
  coachName: string;
  coachEmail: string;
  subject: string;
  body: string;
  timeConfig: OutreachTimeConfig;
  status: OutreachDraftStatus;
};

function toHtmlBody(body: string, format: "text" | "html"): string {
  return format === "html" ? body : emailBodyToHtml(body, "text");
}

function initialForm(
  existing: SwimmerOutreachDraft,
  program: OutreachProgram,
  swimmer: OutreachSwimmer,
): DraftForm {
  const values = outreachMergeValues(program, swimmer, existing, existing.timeConfig);
  const renderedBody = existing.bodyFormat === "html" ? existing.body : renderOutreachText(existing.body, values);
  return {
    coachName: existing.coachName,
    coachEmail: existing.coachEmail,
    subject: renderOutreachText(existing.subject, values),
    body: toHtmlBody(renderedBody, existing.bodyFormat),
    timeConfig: { ...existing.timeConfig, entries: [...existing.timeConfig.entries] },
    status: existing.status,
  };
}

export function DraftEditor({ campaign, program, swimmer, existingDraft, programSaved = true, storageReady = true }: {
  campaign: SwimmerOutreachTemplate;
  program: OutreachProgram;
  swimmer: OutreachSwimmer;
  existingDraft: SwimmerOutreachDraft;
  programSaved?: boolean;
  storageReady?: boolean;
}) {
  const router = useRouter();
  const initial = initialForm(existingDraft, program, swimmer);
  const [form, setForm] = useState<DraftForm>(initial);
  const [baseline, setBaseline] = useState(JSON.stringify(initial));
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmReapply, setConfirmReapply] = useState(false);
  const [pending, startTransition] = useTransition();

  const bodyText = emailHtmlToText(form.body);
  const placeholders = outreachPlaceholderKeys(form.subject, bodyText);
  const emailValid = !form.coachEmail.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.coachEmail.trim());
  const readyContactMissing = form.status !== "draft" && (!form.coachName.trim() || !form.coachEmail.trim());
  const dirty = JSON.stringify(form) !== baseline;
  const canSave = Boolean(storageReady && dirty && form.subject.trim() && bodyText.trim() && emailValid && !readyContactMissing && !placeholders.length);
  const canOpenEmail = Boolean(!dirty && form.coachName.trim() && form.coachEmail.trim() && emailValid && !placeholders.length && form.subject.trim() && bodyText.trim());
  const wordCount = bodyText.trim().split(/\s+/).filter(Boolean).length;
  const campaignFolderHref = `/s/outreach/campaigns/${campaign.id}`;

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const save = () => {
    setNotice(null);
    startTransition(async () => {
      const result = await saveOutreachDraft({
        templateId: campaign.id,
        programId: program.id,
        ...form,
        bodyFormat: "html",
      });
      if (!result.ok) {
        setNotice(result.error);
        return;
      }
      const saved: DraftForm = {
        coachName: result.draft.coachName,
        coachEmail: result.draft.coachEmail,
        subject: result.draft.subject,
        body: result.draft.body,
        timeConfig: result.draft.timeConfig,
        status: result.draft.status,
      };
      setForm(saved);
      setBaseline(JSON.stringify(saved));
      setNotice("School draft saved to this campaign folder.");
      router.refresh();
    });
  };

  const reapply = () => {
    if (!confirmReapply) {
      setConfirmReapply(true);
      return;
    }
    setForm((current) => {
      const next = materializeOutreachTemplate(campaign, program, swimmer, current);
      return { ...next, body: emailBodyToHtml(next.body, "text") };
    });
    setConfirmReapply(false);
    setNotice("Master template reapplied with filled values. Save to keep this replacement.");
  };

  const updateCoachName = (coachName: string) => {
    setForm((current) => updateMaterializedOutreachCoachName(
      campaign,
      program,
      swimmer,
      current,
      coachName,
    ));
  };

  const openEmail = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-5">
      <section className="wr-card p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-lg font-semibold">{program.short}</h2>
              <Badge tone={form.status === "ready" ? "good" : form.status === "sent" ? "accent" : "neutral"}>{form.status === "ready" ? "Ready to send" : form.status === "sent" ? "Sent manually" : "Draft"}</Badge>
            </div>
            <p className="mt-1 text-xs text-ink-3">From {campaign.name} · {OUTREACH_STAGE_LABELS[campaign.stage]}</p>
            {!programSaved && <p className="mt-1 text-[11px] font-medium text-warn">This historical file is retained even though the program is no longer in My Programs → Saved.</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            {program.staffUrl && <a href={program.staffUrl} target="_blank" rel="noreferrer" className="wr-btn wr-btn--neutral wr-btn--small">Verify staff contact ↗</a>}
            {program.questionnaireUrl && <a href={program.questionnaireUrl} target="_blank" rel="noreferrer" className="wr-btn wr-btn--neutral wr-btn--small">Questionnaire ↗</a>}
          </div>
        </div>
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <div className="space-y-5">
          <Card className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-accent-2">1 · Recipient</p>
              <h2 className="mt-1 text-base font-semibold">Verify the coach</h2>
              <p className="mt-1 text-xs text-ink-3">Contact details belong to this school file and can carry into another campaign for the same program.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block min-w-0">
                <span className="wr-field-label block">Coach name</span>
                <FormControl.Input className="wr-control" maxLength={160} value={form.coachName} onChange={(event) => updateCoachName(event.target.value)} placeholder="Taylor Smith" />
              </label>
              <label className="block min-w-0">
                <span className="wr-field-label block">Coach email</span>
                <FormControl.Input className="wr-control" type="email" maxLength={320} aria-invalid={!emailValid} value={form.coachEmail} onChange={(event) => setForm((current) => ({ ...current, coachEmail: event.target.value }))} placeholder="coach@school.edu" />
              </label>
            </div>
            {!emailValid && <p className="text-xs font-medium text-bad" role="alert">Enter a valid email address or leave it blank while drafting.</p>}
            {readyContactMissing && <p className="text-xs font-medium text-bad" role="alert">A coach name and verified email are required for Ready or Sent status.</p>}
          </Card>

          <Card className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-accent-2">2 · School-specific copy</p>
                <h2 className="mt-1 text-base font-semibold">Edit the final email</h2>
                <p className="mt-1 text-xs text-ink-3">All template fields were filled when this draft was created. Edits here never change the master template.</p>
              </div>
              {!confirmReapply ? (
                <Btn small onClick={reapply}>Reapply master</Btn>
              ) : (
                <span className="flex items-center gap-2"><span className="text-[11px] text-warn">Replace this email with a newly filled copy?</span><Btn small onClick={() => setConfirmReapply(false)}>Cancel</Btn><Btn small tone="danger" onClick={reapply}>Replace</Btn></span>
              )}
            </div>
            <label className="block">
              <span className="wr-field-label block">Subject</span>
              <FormControl.Input className="wr-control" maxLength={500} value={form.subject} onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))} />
            </label>
            <div className="block">
              <span className="wr-field-label block">Message</span>
              <div className="mt-1">
                <RichEmailEditor value={form.body} onChange={(html) => setForm((current) => ({ ...current, body: html }))} placeholder="Write your message to the coach…" />
              </div>
            </div>
            {placeholders.length > 0 && <p className="text-xs font-medium text-bad" role="alert">School emails must contain final text, not template placeholders. Reapply the master or replace the remaining field.</p>}
          </Card>
        </div>

        <div className="space-y-4 xl:sticky xl:top-4">
          <Card className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-xs font-semibold">Email preview</p>
                <p className="mt-0.5 text-[11px] text-ink-3">This exact saved text is sent or copied.</p>
              </div>
              <span className="font-data text-[10px] text-ink-3">{wordCount} words</span>
            </div>
            <div className="max-h-[58vh] overflow-auto rounded-[var(--radius)] border border-line bg-paper p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-3">To</p>
              <p className="mt-1 break-all text-xs">{form.coachEmail || "Coach email not added"}</p>
              <p className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-ink-3">Subject</p>
              <p className="mt-1 break-words text-xs font-semibold">{form.subject}</p>
              <div className="my-3 border-t border-line" />
              <div className="email-rendered text-[11px] leading-5 text-ink-2" dangerouslySetInnerHTML={{ __html: form.body }} />
            </div>
            {!form.coachEmail.trim() && <p className="text-[10px] leading-4 text-warn">Add and verify a coach email before opening an email app.</p>}
            {dirty && <p className="text-[10px] leading-4 text-warn">Save this exact version before opening an email app.</p>}
          </Card>

          <Card className="space-y-3">
            <label className="block">
              <span className="wr-field-label block">File status</span>
              <Select className="!w-full" value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as OutreachDraftStatus }))}>
                <option value="draft">Draft</option>
                <option value="ready">Ready to send</option>
                <option value="sent">Sent manually</option>
              </Select>
            </label>
            <p className="text-[10px] leading-4 text-ink-3">SwimAhead opens your email app. It does not send or claim that an email was delivered.</p>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <Btn tone="primary" disabled={!canOpenEmail} onClick={() => openEmail(gmailComposeUrl(form.coachEmail, form.subject, bodyText))}>Open Gmail</Btn>
              <Btn disabled={!canOpenEmail} onClick={() => openEmail(outlookComposeUrl(form.coachEmail, form.subject, bodyText))}>Open Outlook</Btn>
              <Btn disabled={!canOpenEmail} onClick={() => { window.location.href = mailtoUrl(form.coachEmail, form.subject, bodyText); }}>Mail app</Btn>
              {canOpenEmail ? <CopyBtn text={`To: ${form.coachEmail}\nSubject: ${form.subject}\n\n${bodyText}`} label="Copy final email" small={false} /> : <Btn disabled>Copy final email</Btn>}
            </div>
          </Card>
        </div>
      </div>

      <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-3 rounded-[var(--radius)] border border-line-strong bg-surface/95 p-3 shadow-lg backdrop-blur">
        <Link
          href={campaignFolderHref}
          prefetch
          className="wr-btn wr-btn--neutral"
          onNavigate={(event) => {
            if (dirty && !window.confirm("Discard your unsaved school-draft changes?")) event.preventDefault();
          }}
        >
          Back to folder
        </Link>
        <p className="min-w-0 flex-1 text-xs text-ink-2" aria-live="polite">{notice ?? (!storageReady ? OUTREACH_DATABASE_UPDATE_ERROR : dirty ? "Unsaved school-specific changes" : "All school-specific changes saved")}</p>
        <Btn tone="primary" disabled={!canSave || pending} onClick={save}>{pending ? "Saving…" : "Save draft"}</Btn>
      </div>
    </div>
  );
}
