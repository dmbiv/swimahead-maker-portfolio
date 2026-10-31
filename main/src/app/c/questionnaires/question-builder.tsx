"use client";

import * as FormControl from "@/components/form-control";
import { useState } from "react";
import {
  MAX_QUESTIONS,
  QUESTION_KINDS,
  QUESTION_KIND_LABELS,
  fieldNeedsOptions,
  makeFieldKey,
  type QuestionField,
  type QuestionKind,
} from "@/lib/questionnaire-fields";

export function QuestionBuilder({ fields, onChange }: {
  fields: QuestionField[];
  onChange: (next: QuestionField[]) => void;
}) {
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<QuestionKind>("short_text");

  const atLimit = fields.length >= MAX_QUESTIONS;

  function addField() {
    const trimmed = label.trim();
    if (!trimmed || atLimit) return;
    const key = makeFieldKey(trimmed, fields.map((f) => f.key));
    const next: QuestionField = {
      key,
      label: trimmed,
      kind,
      required: false,
      ...(fieldNeedsOptions(kind) ? { options: ["Option 1"] } : {}),
    };
    onChange([...fields, next]);
    setLabel("");
    setKind("short_text");
  }

  function update(key: string, patch: Partial<QuestionField>) {
    onChange(fields.map((f) => (f.key === key ? { ...f, ...patch } : f)));
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= fields.length) return;
    const next = [...fields];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  function remove(key: string) {
    onChange(fields.filter((f) => f.key !== key));
  }

  return (
    <div className="space-y-2">
      <span className="wr-field-label block">Custom questions</span>

      {fields.length > 0 ? (
        <ul className="space-y-2">
          {fields.map((field, index) => (
            <li key={field.key} className="rounded-md border border-[var(--line)] bg-[var(--sunken)] p-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <FormControl.Input
                  className="wr-control wr-control--bare min-w-40 flex-1 text-sm"
                  value={field.label}
                  maxLength={120}
                  onChange={(e) => update(field.key, { label: e.target.value })}
                  aria-label="Question label"
                />
                <FormControl.Select
                  className="wr-control wr-control--bare text-xs"
                  value={field.kind}
                  onChange={(e) => {
                    const nextKind = e.target.value as QuestionKind;
                    update(field.key, {
                      kind: nextKind,
                      options: fieldNeedsOptions(nextKind) ? (field.options?.length ? field.options : ["Option 1"]) : undefined,
                    });
                  }}
                  aria-label="Question type"
                >
                  {QUESTION_KINDS.map((k) => <option key={k} value={k}>{QUESTION_KIND_LABELS[k]}</option>)}
                </FormControl.Select>
                <label className="flex items-center gap-1 text-xs text-ink-2">
                  <FormControl.Input type="checkbox" checked={field.required} onChange={(e) => update(field.key, { required: e.target.checked })} />
                  Required
                </label>
                <div className="flex items-center gap-1">
                  <button type="button" className="text-ink-3 hover:text-ink-1 disabled:opacity-30" disabled={index === 0} onClick={() => move(index, -1)} aria-label="Move up" title="Move up">↑</button>
                  <button type="button" className="text-ink-3 hover:text-ink-1 disabled:opacity-30" disabled={index === fields.length - 1} onClick={() => move(index, 1)} aria-label="Move down" title="Move down">↓</button>
                  <button type="button" className="text-[11px] text-ink-3 underline underline-offset-2" onClick={() => remove(field.key)}>Remove</button>
                </div>
              </div>

              {fieldNeedsOptions(field.kind) ? (
                <OptionsEditor options={field.options ?? []} onChange={(options) => update(field.key, { options })} />
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-ink-3">The standard fields (name, class, contact, SwimCloud, times) are always collected.</p>
      )}

      {atLimit ? (
        <p className="text-xs text-ink-3">Question limit reached ({MAX_QUESTIONS}).</p>
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-40 flex-1 text-sm">
            <span className="sr-only">New question</span>
            <FormControl.Input
              className="wr-control mt-1 w-full"
              value={label}
              maxLength={120}
              placeholder="Add a question (e.g. Intended major?)"
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addField(); } }}
            />
          </label>
          <FormControl.Select className="wr-control mt-1" value={kind} onChange={(e) => setKind(e.target.value as QuestionKind)} aria-label="New question type">
            {QUESTION_KINDS.map((k) => <option key={k} value={k}>{QUESTION_KIND_LABELS[k]}</option>)}
          </FormControl.Select>
          <button type="button" className="wr-btn wr-btn--neutral" onClick={addField} disabled={!label.trim()}>Add</button>
        </div>
      )}
    </div>
  );
}

function OptionsEditor({ options, onChange }: { options: string[]; onChange: (next: string[]) => void }) {
  return (
    <div className="mt-2 space-y-1 pl-1">
      {options.map((opt, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-ink-3">•</span>
          <FormControl.Input
            className="wr-control wr-control--bare flex-1 text-sm"
            value={opt}
            maxLength={80}
            onChange={(e) => onChange(options.map((o, j) => (j === i ? e.target.value : o)))}
            aria-label={`Option ${i + 1}`}
          />
          <button type="button" className="text-[11px] text-ink-3 underline underline-offset-2" disabled={options.length <= 1} onClick={() => onChange(options.filter((_, j) => j !== i))}>Remove</button>
        </div>
      ))}
      {options.length < 12 ? (
        <button type="button" className="text-xs text-[var(--accent-2)] underline underline-offset-2" onClick={() => onChange([...options, `Option ${options.length + 1}`])}>Add option</button>
      ) : null}
    </div>
  );
}
