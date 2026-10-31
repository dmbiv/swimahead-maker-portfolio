"use client";

import * as FormControl from "@/components/form-control";
import { useCallback, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "@/components/app-link";
import { RichEmailEditor } from "@/components/rich-email-editor-lazy";
import { plainTextToEmailHtml } from "@/lib/email-content";
import {
  saveTemplate,
  deleteTemplate,
  buildCampaignOutreach,
  sendOutreachViaProvider,
} from "@/lib/coach-outreach";
import type { ConnectedSender, OutreachTemplate, OutreachRecipient } from "@/lib/coach-outreach-defs";

type CampaignOption = { id: string; name: string; classYear: number };
type Placeholder = { key: string; label: string };

export function OutreachWorkbench({
  templates,
  campaigns,
  placeholders,
  connectedSenders,
  mailboxProviderConfigured,
}: {
  templates: OutreachTemplate[];
  campaigns: CampaignOption[];
  placeholders: Placeholder[];
  connectedSenders: ConnectedSender[];
  mailboxProviderConfigured: boolean;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <TemplateEditor templates={templates} placeholders={placeholders} />
      <SendPanel templates={templates} campaigns={campaigns} connectedSenders={connectedSenders} mailboxProviderConfigured={mailboxProviderConfigured} />
    </div>
  );
}

function TemplateEditor({ templates, placeholders }: { templates: OutreachTemplate[]; placeholders: Placeholder[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<OutreachTemplate | null>(null);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const subjectRef = useRef<HTMLInputElement>(null);
  const insertIntoBodyRef = useRef<((text: string) => void) | null>(null);
  const [activeField, setActiveField] = useState<"subject" | "body">("body");

  const registerInsert = useCallback((fn: ((text: string) => void) | null) => {
    insertIntoBodyRef.current = fn;
  }, []);

  function load(t: OutreachTemplate | null) {
    setEditing(t);
    setName(t?.name ?? "");
    setSubject(t?.subject ?? "");
    setBody(t ? (t.bodyFormat === "html" ? t.body : plainTextToEmailHtml(t.body)) : "");
    setMsg(null);
    setActiveField("body");
  }

  function insertPlaceholder(key: string) {
    const token = `{{${key}}}`;
    if (activeField === "subject") {
      const el = subjectRef.current;
      if (!el) {
        setSubject((s) => s + token);
        return;
      }
      const startPos = el.selectionStart ?? subject.length;
      const endPos = el.selectionEnd ?? subject.length;
      const next = subject.slice(0, startPos) + token + subject.slice(endPos);
      setSubject(next);
      requestAnimationFrame(() => {
        el.focus();
        const caret = startPos + token.length;
        el.setSelectionRange(caret, caret);
      });
      return;
    }
    if (insertIntoBodyRef.current) insertIntoBodyRef.current(token);
    else setBody((b) => b + token);
  }

  function save() {
    setMsg(null);
    start(async () => {
      const res = await saveTemplate({ id: editing?.id ?? null, name, subject, body, bodyFormat: "html" });
      if (res.ok) {
        load(null);
        router.refresh();
      } else {
        setMsg(res.error);
      }
    });
  }

  function remove(id: string) {
    start(async () => {
      await deleteTemplate(id);
      if (editing?.id === id) load(null);
      router.refresh();
    });
  }

  return (
    <div className="wr-card space-y-3 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Templates</h2>
        {editing ? <button type="button" className="text-xs text-ink-3 underline underline-offset-2" onClick={() => load(null)}>New template</button> : null}
      </div>

      {templates.length > 0 ? (
        <ul className="divide-y divide-[var(--line)]">
          {templates.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
              <button type="button" className="truncate text-left hover:underline" onClick={() => load(t)}>{t.name}</button>
              <button type="button" className="shrink-0 text-xs text-ink-3 underline underline-offset-2" disabled={busy} onClick={() => remove(t.id)}>Delete</button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="space-y-2 border-t border-[var(--line)] pt-3">
        <label className="block text-sm">
          <span className="wr-field-label block">Template name</span>
          <FormControl.Input className="wr-control mt-1 w-full" value={name} onChange={(e) => setName(e.target.value)} placeholder="Intro email" />
        </label>
        <label className="block text-sm">
          <span className="wr-field-label block">Subject</span>
          <FormControl.Input
            ref={subjectRef}
            className="wr-control mt-1 w-full"
            value={subject}
            onFocus={() => setActiveField("subject")}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="{{program_name}} swimming: your {{best_event}}"
          />
        </label>
        <div className="text-sm">
          <span className="wr-field-label block">Body</span>
          <div className="mt-1">
            <RichEmailEditor
              value={body}
              onChange={setBody}
              onFocus={() => setActiveField("body")}
              registerInsert={registerInsert}
              placeholder={"Hi {{first_name}}, I'm {{coach_name}} at {{program_name}}. Your {{best_event}} ({{best_time}}) caught our eye..."}
            />
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-[11px] text-ink-3">
            Insert an autofill tag into the <span className="font-medium text-ink-2">{activeField === "subject" ? "subject" : "message"}</span> (whichever you last clicked):
          </p>
          <div className="flex flex-wrap gap-1">
            {placeholders.map((p) => (
              <button key={p.key} type="button" className="rounded border border-[var(--line)] px-1.5 py-0.5 text-[11px] text-ink-2 hover:bg-[var(--sunken)]" onClick={() => insertPlaceholder(p.key)} title={p.label}>
                {`{{${p.key}}}`}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button type="button" className="wr-btn wr-btn--primary" disabled={busy} onClick={save}>
            {editing ? "Save changes" : "Add template"}
          </button>
          {msg ? <span className="text-xs text-[var(--danger,#c0392b)]">{msg}</span> : null}
        </div>
      </div>
    </div>
  );
}

function SendPanel({ templates, campaigns, connectedSenders, mailboxProviderConfigured }: {
  templates: OutreachTemplate[];
  campaigns: CampaignOption[];
  connectedSenders: ConnectedSender[];
  mailboxProviderConfigured: boolean;
}) {
  const [campaignId, setCampaignId] = useState(campaigns[0]?.id ?? "");
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [bucket, setBucket] = useState<"ledger" | "questionnaire">("ledger");
  const [connectionId, setConnectionId] = useState(connectedSenders[0]?.connectionId ?? "");
  const [recipients, setRecipients] = useState<OutreachRecipient[] | null>(null);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [sendErrors, setSendErrors] = useState<Record<string, string>>({});
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const [, startSend] = useTransition();

  const hasConnectedSender = connectedSenders.length > 0 && Boolean(connectionId);

  function invalidatePrepared() {
    setRecipients(null);
    setSent(new Set());
    setSendErrors({});
    setPreviewId(null);
    setMsg(null);
  }

  function selectCampaign(value: string) {
    setCampaignId(value);
    invalidatePrepared();
  }

  function selectTemplate(value: string) {
    setTemplateId(value);
    invalidatePrepared();
  }

  function selectBucket(value: "ledger" | "questionnaire") {
    setBucket(value);
    invalidatePrepared();
  }

  function selectConnection(value: string) {
    setConnectionId(value);
    invalidatePrepared();
  }

  function build() {
    invalidatePrepared();
    start(async () => {
      try {
        const res = await buildCampaignOutreach({
          campaignId,
          templateId,
          bucket,
          connectionId: connectionId || undefined,
        });
        if (res.ok) {
          setRecipients(res.recipients);
          if (res.recipients.length === 0) setMsg("No recruits in the selected campaign source yet.");
          else if (!res.sendAllowed) setMsg(res.sendBlockedReason);
        } else {
          setMsg(res.error);
        }
      } catch {
        setMsg("Emails could not be prepared. Refresh the page and try again.");
      }
    });
  }

  function sendViaProvider(r: OutreachRecipient) {
    if (!r.canProviderSend) {
      setSendErrors((prev) => ({
        ...prev,
        [r.recruitId]: r.blockedReason ?? "This contact is not currently authorized for sending.",
      }));
      return;
    }
    setSendErrors((prev) => { const next = { ...prev }; delete next[r.recruitId]; return next; });
    setSendingId(r.recruitId);
    startSend(async () => {
      try {
        const res = await sendOutreachViaProvider({
          campaignId,
          recruitId: r.recruitId,
          connectionId,
          templateId,
        });
        if (res.ok) {
          setSent((prev) => new Set(prev).add(r.recruitId));
          if (res.error) setSendErrors((prev) => ({ ...prev, [r.recruitId]: res.error! }));
        } else {
          setSendErrors((prev) => ({ ...prev, [r.recruitId]: res.error ?? "Submission failed." }));
        }
      } catch {
        setSendErrors((prev) => ({ ...prev, [r.recruitId]: "The message could not be submitted. Refresh the page and try again." }));
      } finally {
        setSendingId(null);
      }
    });
  }

  const canBuild = Boolean(campaignId && templateId);
  const selectorsDisabled = busy || Boolean(sendingId);

  return (
    <div className="wr-card space-y-3 p-4">
      <h2 className="text-base font-semibold">Send to a campaign</h2>

      {campaigns.length === 0 || templates.length === 0 ? (
        <p className="text-sm text-ink-3">
          {campaigns.length === 0 ? "Create a campaign first. " : ""}
          {templates.length === 0 ? "Add a template to the left first." : ""}
        </p>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-sm">
              <span className="wr-field-label block">Campaign</span>
              <FormControl.Select className="wr-control mt-1 w-full" value={campaignId} disabled={selectorsDisabled} onChange={(e) => selectCampaign(e.target.value)}>
                {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </FormControl.Select>
            </label>
            <label className="text-sm">
              <span className="wr-field-label block">Template</span>
              <FormControl.Select className="wr-control mt-1 w-full" value={templateId} disabled={selectorsDisabled} onChange={(e) => selectTemplate(e.target.value)}>
                {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </FormControl.Select>
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="wr-field-label block">Recruit source</span>
              <FormControl.Select
                className="wr-control mt-1 w-full"
                value={bucket}
                disabled={selectorsDisabled}
                onChange={(e) => selectBucket(e.target.value === "questionnaire" ? "questionnaire" : "ledger")}
              >
                <option value="ledger">Recruiting ledger</option>
                <option value="questionnaire">Questionnaire responses</option>
              </FormControl.Select>
            </label>
          </div>
          {connectedSenders.length > 0 ? (
            <label className="block text-sm">
              <span className="wr-field-label block">Send formatted email from</span>
              <FormControl.Select className="wr-control mt-1 w-full" value={connectionId} disabled={selectorsDisabled} onChange={(e) => selectConnection(e.target.value)}>
                {connectedSenders.map((s) => <option key={s.connectionId} value={s.connectionId}>{s.senderEmail}</option>)}
              </FormControl.Select>
            </label>
          ) : mailboxProviderConfigured ? (
            <p className="text-xs text-ink-3">
              <Link href="/c/settings" className="underline underline-offset-2">Connect a mailbox</Link> to send formatted email from here. Without one, each message opens in your own email app instead.
            </p>
          ) : (
            <p className="text-xs text-ink-3">
              Sending from inside the app is not configured on this deployment, so each message opens in your own email app instead.
            </p>
          )}

          <button type="button" className="wr-btn wr-btn--primary" disabled={busy || Boolean(sendingId) || !canBuild} onClick={build}>
            {busy ? "Preparing..." : "Prepare emails"}
          </button>
          {msg ? <p className="text-xs text-ink-2">{msg}</p> : null}
        </>
      )}

      {recipients && recipients.length > 0 ? (
        <div className="space-y-2 border-t border-[var(--line)] pt-3">
          <p className="text-xs text-ink-3">
            {hasConnectedSender
              ? "Send submits through your connected mailbox."
              : "Each message opens in your email app with the recruit's address filled in."}
          </p>
          <ul className="max-h-96 space-y-2 overflow-y-auto">
            {recipients.map((r) => {
              const noRoute = !r.route.available;
              const blocked = r.route.available && !r.canProviderSend;
              return (
                <li key={r.recruitId} className="rounded-md border border-[var(--line)] p-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="font-medium">{r.fullName}</span>
                      <span className="ml-2 text-xs text-ink-3">{r.email ?? "No email on file"}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {hasConnectedSender ? (
                        <button
                          type="button"
                          className={`wr-btn wr-btn--small ${sent.has(r.recruitId) || !r.canProviderSend ? "wr-btn--neutral" : "wr-btn--primary"}`}
                          disabled={!r.canProviderSend || sent.has(r.recruitId) || Boolean(sendingId)}
                          onClick={() => sendViaProvider(r)}
                        >
                          {sent.has(r.recruitId) ? "Submitted" : sendingId === r.recruitId ? "Submitting..." : noRoute ? "No email" : blocked ? "Blocked" : "Send"}
                        </button>
                      ) : r.composeUrl ? (
                        <a
                          href={r.composeUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="wr-btn wr-btn--small wr-btn--primary"
                        >
                          Open email
                        </a>
                      ) : (
                        <button type="button" className="wr-btn wr-btn--small wr-btn--neutral" disabled>
                          {noRoute ? "No email" : "Blocked"}
                        </button>
                      )}
                      {r.threadUrl ? (
                        <a href={r.threadUrl} target="_blank" rel="noreferrer" className="wr-btn wr-btn--neutral wr-btn--small" title="Open recent Gmail thread with this recruit">Open recent thread</a>
                      ) : null}
                    </div>
                  </div>
                  {noRoute ? (
                    <p className="mt-1 text-xs text-ink-3">
                      {r.blockedReason ?? "Add this recruit's email on their row in the campaign ledger."}
                    </p>
                  ) : (
                    <>
                      <p className="mt-1 truncate text-xs text-ink-2">{r.subject}</p>
                      <button
                        type="button"
                        className="mt-1 text-[11px] text-ink-3 underline underline-offset-2"
                        onClick={() => setPreviewId((current) => (current === r.recruitId ? null : r.recruitId))}
                      >
                        {previewId === r.recruitId ? "Hide preview" : "Preview"}
                      </button>
                    </>
                  )}
                  {!noRoute && previewId === r.recruitId ? (
                    <div className="mt-2 rounded-[var(--radius)] border border-line bg-paper p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-3">Subject</p>
                      <p className="mt-1 break-words text-xs font-semibold">{r.subject}</p>
                      <div className="my-2 border-t border-line" />
                      <div className="email-rendered text-[11px] leading-5 text-ink-2" dangerouslySetInnerHTML={{ __html: r.bodyHtml }} />
                    </div>
                  ) : null}
                  {!noRoute && r.blockedReason ? (
                    <p className="mt-1 text-xs text-warn">{r.blockedReason}</p>
                  ) : null}
                  {sendErrors[r.recruitId] ? <p className="mt-1 text-xs text-[var(--danger,#c0392b)]">{sendErrors[r.recruitId]}</p> : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
