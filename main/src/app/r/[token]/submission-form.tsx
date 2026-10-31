"use client";

import { useState, useTransition } from "react";
import Link from "@/components/app-link";
import * as FormControl from "@/components/form-control";
import { submitQuestionnaire } from "@/lib/questionnaire-actions";
import type { AnswerMap, AnswerValue, QuestionField } from "@/lib/questionnaire-fields";

export function SubmissionForm({
  token,
  coachingStaffName,
  fields = [],
}: {
  token: string;
  coachingStaffName: string;
  fields?: QuestionField[];
}) {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const [fullName, setFullName] = useState("");
  const [gradYear, setGradYear] = useState("");
  const [gender, setGender] = useState<"" | "M" | "F">("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [swimcloud, setSwimcloud] = useState("");
  const [club, setClub] = useState("");
  const [lsc, setLsc] = useState("");
  const [times, setTimes] = useState("");
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [ageAndGuardianConfirmed, setAgeAndGuardianConfirmed] = useState(false);

  function setAnswer(key: string, value: AnswerValue) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }

  function submit() {
    setError(null);
    if (fullName.trim().length < 1) {
      setError("Please enter your name.");
      return;
    }
    if (!legalAccepted) {
      setError("Please agree to the Terms and acknowledge the Privacy Policy.");
      return;
    }
    if (!ageAndGuardianConfirmed) {
      setError("Please confirm the age and guardian-permission requirements.");
      return;
    }
    for (const field of fields) {
      if (!field.required) continue;
      const v = answers[field.key];
      const blank = v == null || (Array.isArray(v) ? v.length === 0 : String(v).trim().length === 0);
      if (blank) {
        setError(`Please answer "${field.label}".`);
        return;
      }
    }
    start(async () => {
      const res = await submitQuestionnaire(token, {
        fullName,
        gradYear: gradYear ? Number(gradYear) : null,
        gender: gender || null,
        email,
        phone,
        swimcloudUrl: swimcloud,
        club,
        lsc,
        timesText: times,
        answers,
        legalAccepted,
        ageAndGuardianConfirmed,
      });
      if (res.ok) setDone(true);
      else setError(res.error);
    });
  }

  if (done) {
    return (
      <div className="wr-card p-6 text-center">
        <p className="text-base font-medium">Thanks, {fullName.split(" ")[0] || "swimmer"}.</p>
        <p className="mt-1 text-sm text-ink-2">Your information was sent to {coachingStaffName}. They will be in touch.</p>
      </div>
    );
  }

  return (
    <div className="wr-card space-y-4 p-5">
      <label className="block text-sm">
        <span className="wr-field-label block">Full name</span>
        <FormControl.Input className="wr-control mt-1 w-full" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm">
          <span className="wr-field-label block">Graduation year</span>
          <FormControl.Input className="wr-control mt-1 w-full" inputMode="numeric" value={gradYear} onChange={(e) => setGradYear(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="2027" />
          <span className="mt-1 block text-xs text-ink-3">SwimAhead is not offered to children under 13.</span>
        </label>
        <label className="text-sm">
          <span className="wr-field-label block">Category</span>
          <FormControl.Select className="wr-control mt-1 w-full" value={gender} onChange={(e) => setGender(e.target.value as "" | "M" | "F")}>
            <option value="">Choose</option>
            <option value="F">Women</option>
            <option value="M">Men</option>
          </FormControl.Select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm">
          <span className="wr-field-label block">Email</span>
          <FormControl.Input className="wr-control mt-1 w-full" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </label>
        <label className="text-sm">
          <span className="wr-field-label block">Phone</span>
          <FormControl.Input className="wr-control mt-1 w-full" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
        </label>
      </div>
      <p className="text-xs leading-5 text-ink-3">
        If you provide an email address or phone number, {coachingStaffName} may use it for individualized, one-to-one college recruiting communication.
      </p>

      <label className="block text-sm">
        <span className="wr-field-label block">SwimCloud profile link</span>
        <FormControl.Input className="wr-control mt-1 w-full" value={swimcloud} onChange={(e) => setSwimcloud(e.target.value)} placeholder="https://www.swimcloud.com/swimmer/..." />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm">
          <span className="wr-field-label block">Club or high school</span>
          <FormControl.Input className="wr-control mt-1 w-full" value={club} onChange={(e) => setClub(e.target.value)} autoComplete="organization" />
        </label>
        <label className="text-sm">
          <span className="wr-field-label block">LSC (optional)</span>
          <FormControl.Input className="wr-control mt-1 w-full" value={lsc} onChange={(e) => setLsc(e.target.value.toUpperCase().slice(0, 4))} placeholder="e.g. FL" />
        </label>
      </div>

      <label className="block text-sm">
        <span className="wr-field-label block">Best times</span>
        <FormControl.Textarea className="wr-control mt-1 min-h-24 w-full py-2" value={times} onChange={(e) => setTimes(e.target.value)} placeholder={"100 Free 47.1 SCY\n200 IM 1:52.0 SCY"} />
      </label>

      {fields.map((field) => (
        <CustomField key={field.key} field={field} value={answers[field.key]} onChange={(v) => setAnswer(field.key, v)} />
      ))}

      <div className="space-y-3 border-t border-line pt-4">
        <p className="text-xs leading-5 text-ink-3">
          Your response, including contact details, swimming information, and custom answers, will be shared with {coachingStaffName}. Do not include Social Security numbers, financial-account details, medical records, government IDs, or other highly sensitive information.
        </p>
        <label className="flex items-start gap-2.5 text-xs leading-5 text-ink-2">
          <FormControl.Input
            className="mt-1 size-4 shrink-0 accent-[var(--accent)]"
            type="checkbox"
            checked={legalAccepted}
            onChange={(event) => setLegalAccepted(event.target.checked)}
          />
          <span>
            I agree to the <Link className="font-semibold text-accent-2 underline" href="/terms" target="_blank" rel="noreferrer">Terms of Service</Link>{" "}
            and acknowledge the <Link className="font-semibold text-accent-2 underline" href="/privacy" target="_blank" rel="noreferrer">Privacy Policy</Link>.
            {email.trim() || phone.trim()
              ? ` I also authorize ${coachingStaffName} to use the contact details I provide for individualized, one-to-one college recruiting communication.`
              : ""}
          </span>
        </label>
        <label className="flex items-start gap-2.5 text-xs leading-5 text-ink-2">
          <FormControl.Input
            className="mt-1 size-4 shrink-0 accent-[var(--accent)]"
            type="checkbox"
            checked={ageAndGuardianConfirmed}
            onChange={(event) => setAgeAndGuardianConfirmed(event.target.checked)}
          />
          <span>
            I confirm I am at least 13. If I am under 18, my parent or legal guardian has reviewed and authorized this submission.
          </span>
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button type="button" className="wr-btn wr-btn--primary" disabled={busy || !legalAccepted || !ageAndGuardianConfirmed} onClick={submit}>
          {busy ? "Sending..." : "Submit"}
        </button>
        {error ? <span className="text-sm text-[var(--danger,#c0392b)]">{error}</span> : null}
      </div>
    </div>
  );
}

function CustomField({ field, value, onChange }: {
  field: QuestionField;
  value: AnswerValue | undefined;
  onChange: (value: AnswerValue) => void;
}) {
  const labelText = (
    <span className="wr-field-label block">
      {field.label}
      {field.required ? <span className="text-[var(--danger,#c0392b)]"> *</span> : null}
    </span>
  );

  if (field.kind === "long_text") {
    return (
      <label className="block text-sm">
        {labelText}
        <FormControl.Textarea className="wr-control mt-1 min-h-20 w-full py-2" value={typeof value === "string" ? value : ""} maxLength={2000} onChange={(e) => onChange(e.target.value)} />
      </label>
    );
  }

  if (field.kind === "number") {
    return (
      <label className="block text-sm">
        {labelText}
        <FormControl.Input className="wr-control mt-1 w-full" inputMode="decimal" value={value == null ? "" : String(value)} onChange={(e) => onChange(e.target.value.replace(/[^0-9.\-]/g, ""))} />
      </label>
    );
  }

  if (field.kind === "yes_no") {
    return (
      <fieldset className="block text-sm">
        {labelText}
        <div className="mt-1 flex gap-4">
          {(["yes", "no"] as const).map((opt) => (
            <label key={opt} className="flex items-center gap-1.5">
              <FormControl.Input type="radio" name={field.key} checked={value === opt} onChange={() => onChange(opt)} />
              <span className="capitalize">{opt}</span>
            </label>
          ))}
        </div>
      </fieldset>
    );
  }

  if (field.kind === "single_select") {
    return (
      <label className="block text-sm">
        {labelText}
        <FormControl.Select className="wr-control mt-1 w-full" value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)}>
          <option value="">Choose</option>
          {(field.options ?? []).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
        </FormControl.Select>
      </label>
    );
  }

  if (field.kind === "multi_select") {
    const selected = Array.isArray(value) ? value : [];
    return (
      <fieldset className="block text-sm">
        {labelText}
        <div className="mt-1 space-y-1">
          {(field.options ?? []).map((opt) => (
            <label key={opt} className="flex items-center gap-1.5">
              <FormControl.Input
                type="checkbox"
                checked={selected.includes(opt)}
                onChange={(e) => onChange(e.target.checked ? [...selected, opt] : selected.filter((o) => o !== opt))}
              />
              <span>{opt}</span>
            </label>
          ))}
        </div>
      </fieldset>
    );
  }

  return (
    <label className="block text-sm">
      {labelText}
      <FormControl.Input className="wr-control mt-1 w-full" value={typeof value === "string" ? value : ""} maxLength={2000} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
