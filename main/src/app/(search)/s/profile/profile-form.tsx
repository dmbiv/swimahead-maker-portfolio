"use client";

import { type FormEvent, useEffect, useRef, useState, useTransition } from "react";
import { Btn, Card, Field, Input, Meter, SectionTitle, TextArea } from "@/components/ui";
import { updateMyProfile } from "@/lib/swimmer-actions";

type ProfileInitial = {
  firstName: string;
  lastName: string;
  gradYear: number;
  club: string;
  city: string;
  state: string;
  email: string;
  phone: string;
  gpa: number;
  sat: number | null;
  act: number | null;
  maxAnnualCost: number | null;
  majors: string[];
  bio: string;
  videoUrl: string;
};

type ProfileFormState = Omit<ProfileInitial, "gradYear" | "gpa" | "sat" | "act" | "maxAnnualCost" | "majors"> & {
  gradYear: string;
  gpa: string;
  sat: string;
  act: string;
  maxAnnualCost: string;
  majors: string;
};

type ProfileField = keyof ProfileFormState;
type ProfileErrors = Partial<Record<ProfileField, string>>;

function toFormState(profile: ProfileInitial): ProfileFormState {
  return {
    ...profile,
    gradYear: String(profile.gradYear),
    gpa: String(profile.gpa),
    sat: profile.sat == null ? "" : String(profile.sat),
    act: profile.act == null ? "" : String(profile.act),
    maxAnnualCost: profile.maxAnnualCost == null ? "" : String(profile.maxAnnualCost),
    majors: profile.majors.join("\n"),
  };
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return <p id={id} className="mt-1 text-xs font-medium text-bad">{message}</p>;
}

function validWebUrl(value: string) {
  if (!value.trim()) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function validate(form: ProfileFormState): ProfileErrors {
  const errors: ProfileErrors = {};
  const gradYear = Number(form.gradYear);
  const gpa = Number(form.gpa);
  const sat = form.sat.trim() ? Number(form.sat) : null;
  const act = form.act.trim() ? Number(form.act) : null;
  const maxAnnualCost = form.maxAnnualCost.trim() ? Number(form.maxAnnualCost) : null;
  const majors = form.majors.split(/[\n,]/).map((major) => major.trim()).filter(Boolean);

  if (!form.firstName.trim()) errors.firstName = "First name is required.";
  if (!form.lastName.trim()) errors.lastName = "Last name is required.";
  if (!Number.isInteger(gradYear) || gradYear < 2026 || gradYear > 2034) {
    errors.gradYear = "Use a graduation year from 2026 through 2034.";
  }
  if (form.state.trim() && !/^[a-z]{2}$/i.test(form.state.trim())) {
    errors.state = "Use a two-letter state code.";
  }
  if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) {
    errors.email = "Enter a valid email address.";
  }
  if (!Number.isFinite(gpa) || gpa < 0 || gpa > 4.5) {
    errors.gpa = "GPA must be between 0.00 and 4.50.";
  }
  if (sat != null && (!Number.isInteger(sat) || sat < 400 || sat > 1600)) {
    errors.sat = "SAT must be a whole number from 400 to 1600, or left blank.";
  }
  if (act != null && (!Number.isInteger(act) || act < 1 || act > 36)) {
    errors.act = "ACT must be a whole number from 1 to 36, or left blank.";
  }
  if (maxAnnualCost != null && (!Number.isFinite(maxAnnualCost) || maxAnnualCost < 0 || maxAnnualCost > 200000)) {
    errors.maxAnnualCost = "Enter an annual amount from $0 to $200,000, or leave it blank.";
  }
  if (majors.length > 6) errors.majors = "Keep the list to six academic interests.";
  if (majors.some((major) => major.length > 80)) errors.majors = "Each academic interest must be 80 characters or fewer.";
  if (form.bio.length > 2000) errors.bio = "Bio must be 2,000 characters or fewer.";
  if (!validWebUrl(form.videoUrl)) errors.videoUrl = "Use a full http:// or https:// link.";

  return errors;
}

export function ProfileForm({ initial }: { initial: ProfileInitial }) {
  const original = toFormState(initial);
  const [form, setForm] = useState<ProfileFormState>(original);
  const [savedSnapshot, setSavedSnapshot] = useState(JSON.stringify(original));
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const dirty = JSON.stringify(form) !== savedSnapshot;
  const majors = form.majors.split(/[\n,]/).map((major) => major.trim()).filter(Boolean);
  const completionChecks = [
    ["Name", Boolean(form.firstName.trim() && form.lastName.trim())],
    ["Graduation year", Boolean(form.gradYear)],
    ["Team", Boolean(form.club.trim())],
    ["Location", Boolean(form.city.trim() && form.state.trim())],
    ["Email", Boolean(form.email.trim())],
    ["Phone", Boolean(form.phone.trim())],
    ["GPA", Number(form.gpa) > 0],
    ["Academic interests", majors.length > 0],
    ["Bio", Boolean(form.bio.trim())],
    ["Race video", Boolean(form.videoUrl.trim())],
  ] as const;
  const completion = Math.round((completionChecks.filter(([, done]) => done).length / completionChecks.length) * 100);
  const missing = completionChecks.filter(([, done]) => !done).map(([label]) => label);

  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (dirty && !pending) formRef.current?.requestSubmit();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dirty, pending]);

  const set = <K extends ProfileField>(key: K, value: ProfileFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setStatus("idle");
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validate(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setStatus("error");
      const firstInvalid = event.currentTarget.querySelector<HTMLElement>("[aria-invalid='true']");
      firstInvalid?.focus();
      return;
    }

    const majors = form.majors.split(/[\n,]/).map((major) => major.trim()).filter(Boolean);
    setStatus("idle");
    startTransition(async () => {
      try {
        const result = await updateMyProfile({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          gradYear: Number(form.gradYear),
          club: form.club.trim(),
          city: form.city.trim(),
          state: form.state.trim().toUpperCase(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          gpa: Number(form.gpa),
          sat: form.sat.trim() ? Number(form.sat) : null,
          act: form.act.trim() ? Number(form.act) : null,
          maxAnnualCost: form.maxAnnualCost.trim() ? Number(form.maxAnnualCost) : null,
          majors,
          bio: form.bio.trim(),
          videoUrl: form.videoUrl.trim(),
        });
        if (!result.ok) throw new Error("Profile update failed");
        setSavedSnapshot(JSON.stringify(form));
        setStatus("saved");
      } catch {
        setStatus("error");
      }
    });
  };

  const discardChanges = () => {
    setForm(JSON.parse(savedSnapshot) as ProfileFormState);
    setErrors({});
    setStatus("idle");
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header>
        <div>
          <h1 className="text-2xl font-semibold">Profile</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-2">
            Update the information used for program match estimates and email drafts.
          </p>
        </div>
      </header>

      <Card className="profile-progress-card">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold">Profile readiness</h2>
              <span className="font-data text-sm font-semibold">{completion}%</span>
            </div>
            <div className="mt-2"><Meter label="Profile readiness" value={completion} tone={completion === 100 ? "good" : "accent"} /></div>
            <p className="mt-2 text-xs text-ink-3">A complete profile creates better email drafts and makes your information easier to share.</p>
          </div>
          <div className="sm:max-w-md sm:border-l sm:border-line sm:pl-4">
            {missing.length ? (
              <div className="flex flex-wrap gap-1.5" aria-label="Missing profile items">
                {missing.map((item) => <span key={item} className="rounded-[var(--radius)] bg-sunken px-2 py-1 text-[11px] text-ink-2">Add {item.toLocaleLowerCase()}</span>)}
              </div>
            ) : <p className="text-sm font-medium text-good">All profile sections are complete.</p>}
          </div>
        </div>
      </Card>

      <form ref={formRef} onSubmit={submit} noValidate className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <fieldset>
              <legend className="sr-only">Basic swimmer information</legend>
              <SectionTitle>Basic information</SectionTitle>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="First name">
                  <Input
                    autoComplete="given-name"
                    value={form.firstName}
                    onChange={(event) => set("firstName", event.target.value)}
                    required
                    aria-invalid={Boolean(errors.firstName)}
                    aria-describedby={errors.firstName ? "profile-first-name-error" : undefined}
                  />
                  <FieldError id="profile-first-name-error" message={errors.firstName} />
                </Field>
                <Field label="Last name">
                  <Input
                    autoComplete="family-name"
                    value={form.lastName}
                    onChange={(event) => set("lastName", event.target.value)}
                    required
                    aria-invalid={Boolean(errors.lastName)}
                    aria-describedby={errors.lastName ? "profile-last-name-error" : undefined}
                  />
                  <FieldError id="profile-last-name-error" message={errors.lastName} />
                </Field>
                <Field label="Graduation year">
                  <Input
                    type="number"
                    min={2026}
                    max={2034}
                    inputMode="numeric"
                    value={form.gradYear}
                    onChange={(event) => set("gradYear", event.target.value)}
                    required
                    aria-invalid={Boolean(errors.gradYear)}
                    aria-describedby={errors.gradYear ? "profile-grad-error" : undefined}
                  />
                  <FieldError id="profile-grad-error" message={errors.gradYear} />
                </Field>
                <Field label="Club / high school">
                  <Input
                    autoComplete="organization"
                    value={form.club}
                    onChange={(event) => set("club", event.target.value)}
                    placeholder="Northside Aquatics"
                  />
                </Field>
                <Field label="City">
                  <Input
                    autoComplete="address-level2"
                    value={form.city}
                    onChange={(event) => set("city", event.target.value)}
                  />
                </Field>
                <Field label="State">
                  <Input
                    autoComplete="address-level1"
                    value={form.state}
                    onChange={(event) => set("state", event.target.value.slice(0, 2).toUpperCase())}
                    maxLength={2}
                    placeholder="NC"
                    aria-invalid={Boolean(errors.state)}
                    aria-describedby={errors.state ? "profile-state-error" : undefined}
                  />
                  <FieldError id="profile-state-error" message={errors.state} />
                </Field>
              </div>
            </fieldset>
          </Card>

          <Card>
            <fieldset>
              <legend className="sr-only">Contact information</legend>
              <SectionTitle>Contact</SectionTitle>
              <div className="space-y-3">
                <Field label="Email">
                  <Input
                    type="email"
                    autoComplete="email"
                    value={form.email}
                    onChange={(event) => set("email", event.target.value)}
                    required
                    aria-invalid={Boolean(errors.email)}
                    aria-describedby={errors.email ? "profile-email-error" : "profile-email-help"}
                  />
                  <p id="profile-email-help" className="mt-1 text-xs text-ink-3">Used in email drafts and profile exports.</p>
                  <FieldError id="profile-email-error" message={errors.email} />
                </Field>
                <Field label="Mobile phone">
                  <Input
                    type="tel"
                    autoComplete="tel"
                    value={form.phone}
                    onChange={(event) => set("phone", event.target.value)}
                    placeholder="(555) 010-2400"
                  />
                </Field>
              </div>
            </fieldset>
          </Card>

          <Card>
            <fieldset>
              <legend className="sr-only">Academic information</legend>
              <SectionTitle>Academics and budget</SectionTitle>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Unweighted GPA">
                  <Input
                    type="number"
                    min={0}
                    max={4.5}
                    step={0.01}
                    inputMode="decimal"
                    value={form.gpa}
                    onChange={(event) => set("gpa", event.target.value)}
                    required
                    aria-invalid={Boolean(errors.gpa)}
                    aria-describedby={errors.gpa ? "profile-gpa-error" : undefined}
                  />
                  <FieldError id="profile-gpa-error" message={errors.gpa} />
                </Field>
                <Field label="SAT composite (optional)">
                  <Input
                    type="number"
                    min={400}
                    max={1600}
                    step={10}
                    inputMode="numeric"
                    value={form.sat}
                    onChange={(event) => set("sat", event.target.value)}
                    placeholder="Not reported"
                    aria-invalid={Boolean(errors.sat)}
                    aria-describedby={errors.sat ? "profile-sat-error" : undefined}
                  />
                  <FieldError id="profile-sat-error" message={errors.sat} />
                </Field>
                <Field label="ACT composite (optional)">
                  <Input
                    type="number"
                    min={1}
                    max={36}
                    step={1}
                    inputMode="numeric"
                    value={form.act}
                    onChange={(event) => set("act", event.target.value)}
                    placeholder="Not reported"
                    aria-invalid={Boolean(errors.act)}
                    aria-describedby={errors.act ? "profile-act-error" : undefined}
                  />
                  <FieldError id="profile-act-error" message={errors.act} />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Maximum annual college cost (optional)">
                    <Input
                      type="number"
                      min={0}
                      max={200000}
                      step={1000}
                      inputMode="numeric"
                      value={form.maxAnnualCost}
                      onChange={(event) => set("maxAnnualCost", event.target.value)}
                      placeholder="Not set"
                      aria-invalid={Boolean(errors.maxAnnualCost)}
                      aria-describedby={errors.maxAnnualCost ? "profile-cost-error" : "profile-cost-help"}
                    />
                    <p id="profile-cost-help" className="mt-1 text-xs text-ink-3">
                      Used to compare programs against their average net-price estimate. This is not a financial-aid quote.
                    </p>
                    <FieldError id="profile-cost-error" message={errors.maxAnnualCost} />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Field label="Academic interests, one per line">
                    <TextArea
                      rows={4}
                      value={form.majors}
                      onChange={(event) => set("majors", event.target.value)}
                      placeholder={"Engineering\nEconomics"}
                      aria-invalid={Boolean(errors.majors)}
                      aria-describedby={errors.majors ? "profile-majors-error" : "profile-majors-help"}
                    />
                    <p id="profile-majors-help" className="mt-1 text-xs text-ink-3">Up to six interests.</p>
                    <FieldError id="profile-majors-error" message={errors.majors} />
                  </Field>
                </div>
              </div>
            </fieldset>
          </Card>

          <Card>
            <fieldset>
              <legend className="sr-only">Bio and race video</legend>
              <SectionTitle>Bio and video</SectionTitle>
              <div className="space-y-3">
                <Field label="Short bio">
                  <TextArea
                    rows={7}
                    maxLength={2000}
                    value={form.bio}
                    onChange={(event) => set("bio", event.target.value)}
                    placeholder="Training focus, goals, leadership, and program preferences"
                    aria-invalid={Boolean(errors.bio)}
                    aria-describedby={errors.bio ? "profile-bio-count profile-bio-error" : "profile-bio-count"}
                  />
                  <p id="profile-bio-count" className="mt-1 text-right font-data text-[10px] text-ink-3">{form.bio.length} / 2,000</p>
                  <FieldError id="profile-bio-error" message={errors.bio} />
                </Field>
                <Field label="Race video URL">
                  <Input
                    type="url"
                    inputMode="url"
                    value={form.videoUrl}
                    onChange={(event) => set("videoUrl", event.target.value)}
                    placeholder="https://youtube.com/watch?v=…"
                    aria-invalid={Boolean(errors.videoUrl)}
                    aria-describedby={errors.videoUrl ? "profile-video-error" : "profile-video-help"}
                  />
                  <p id="profile-video-help" className="mt-1 text-xs text-ink-3">Add a link to a race or technique video.</p>
                  <FieldError id="profile-video-error" message={errors.videoUrl} />
                  {form.videoUrl && validWebUrl(form.videoUrl) && (
                    <a href={form.videoUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs font-medium text-accent-2 hover:underline">Open video <span aria-hidden>↗</span></a>
                  )}
                </Field>
              </div>
            </fieldset>
          </Card>
        </div>

        <div className="profile-savebar flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <div aria-live="polite" className="min-h-5 text-xs">
            {pending && <span className="font-medium text-accent">Saving profile…</span>}
            {!pending && status === "saved" && <span className="font-medium text-good">Profile saved.</span>}
            {!pending && status === "error" && <span role="alert" className="font-medium text-bad">Check the marked fields and try again.</span>}
            {!pending && status === "idle" && dirty && <span className="text-ink-3">Unsaved changes.</span>}
            {!pending && status === "idle" && !dirty && <span className="text-ink-3">No unsaved changes.</span>}
          </div>
          <div className="flex w-full gap-2 sm:w-auto">
            <span className="hidden items-center text-[10px] text-ink-3 lg:flex"><kbd className="rounded-[var(--radius)] border border-line bg-paper px-1.5 py-1 font-data">⌘ S</kbd></span>
            <Btn onClick={discardChanges} disabled={pending || !dirty}>Discard changes</Btn>
            <Btn type="submit" tone="primary" disabled={pending || !dirty}>{pending ? "Saving…" : "Save profile"}</Btn>
          </div>
        </div>
      </form>
    </div>
  );
}
