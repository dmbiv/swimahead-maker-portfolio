"use client";

import * as FormControl from "@/components/form-control";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCampaign } from "@/lib/campaign-actions";
import type { Gender } from "@/lib/types";
import { announceNavigationStart } from "@/components/navigation-feedback";

export function CampaignCreateForm({
  collegeId,
  defaultGender,
  currentYear,
}: {
  collegeId: string;
  defaultGender: Gender;
  currentYear: number;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [classYear, setClassYear] = useState(currentYear + 1);
  const [gender, setGender] = useState<Gender>(defaultGender);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  function submit() {
    setError(null);
    start(async () => {
      const finalName = name.trim() || `Class of ${classYear}`;
      const res = await createCampaign({ collegeId, name: finalName, classYear, gender });
      if (res.ok && res.id) {
        const destination = `/c/campaigns/${res.id}`;
        announceNavigationStart(destination);
        router.push(destination);
      } else setError(res.error ?? "Could not create the campaign.");
    });
  }

  return (
    <div className="wr-card max-w-xl p-4">
      <h2 className="text-base font-semibold">New campaign</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <label>
          <span className="wr-field-label block">Name</span>
          <FormControl.Input
            className="wr-control mt-1 w-full"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={`Class of ${classYear}`}
          />
        </label>
        <label>
          <span className="wr-field-label block">Class year</span>
          <FormControl.Input
            className="wr-control mt-1 w-24"
            inputMode="numeric"
            value={classYear}
            onChange={(e) => setClassYear(Number(e.target.value.replace(/\D/g, "").slice(0, 4)) || currentYear)}
          />
        </label>
        <label>
          <span className="wr-field-label block">Squad</span>
          <FormControl.Select className="wr-control mt-1" value={gender} onChange={(e) => setGender(e.target.value as Gender)}>
            <option value="M">Men</option>
            <option value="F">Women</option>
          </FormControl.Select>
        </label>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button type="button" className="wr-btn wr-btn--primary" disabled={busy} onClick={submit}>
          {busy ? "Creating..." : "Create campaign"}
        </button>
        {error ? <span className="text-xs text-[var(--danger,#c0392b)]">{error}</span> : null}
      </div>
    </div>
  );
}
