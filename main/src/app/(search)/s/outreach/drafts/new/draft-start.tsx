"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Btn, Select } from "@/components/ui";
import { OUTREACH_STAGE_LABELS, type OutreachProgram, type OutreachStage } from "@/lib/swimmer-outreach";
import { announceNavigationStart } from "@/components/navigation-feedback";
import { applyOutreachTemplate } from "../../actions";

export function DraftStart({ programs, campaigns, drafts, initialProgramId }: {
  programs: OutreachProgram[];
  campaigns: Array<{ id: string; name: string; stage: OutreachStage }>;
  drafts: Array<{ templateId: string; programId: string }>;
  initialProgramId?: string;
}) {
  const router = useRouter();
  const [programId, setProgramId] = useState(programs.some((program) => program.id === initialProgramId) ? initialProgramId! : programs[0]?.id ?? "");
  const [campaignId, setCampaignId] = useState(campaigns[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const existing = drafts.some((draft) => draft.programId === programId && draft.templateId === campaignId);
  const open = () => {
    const destination = `/s/outreach/campaigns/${campaignId}/drafts/${programId}`;
    if (existing) {
      announceNavigationStart(destination);
      router.push(destination);
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await applyOutreachTemplate({ templateId: campaignId, programId });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      announceNavigationStart(destination);
      router.push(destination);
    });
  };
  return (
    <div className="space-y-4">
      <label className="block">
        <span className="wr-field-label block">1. Exact saved program</span>
        <Select className="!w-full min-w-0 max-w-full" value={programId} onChange={(event) => setProgramId(event.target.value)}>
          {programs.map((program) => <option key={program.id} value={program.id}>{program.short}{program.division ? ` · ${program.division}` : ""}</option>)}
        </Select>
        <span className="mt-1 block text-[11px] text-ink-3">Men’s and women’s squads are separate program files.</span>
      </label>
      <label className="block">
        <span className="wr-field-label block">2. Campaign folder</span>
        <Select className="!w-full min-w-0 max-w-full" value={campaignId} onChange={(event) => setCampaignId(event.target.value)}>
          {campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name} · {OUTREACH_STAGE_LABELS[campaign.stage]}</option>)}
        </Select>
        <span className="mt-1 block text-[11px] text-ink-3">Applying fills every placeholder and creates an independent, editable email.</span>
      </label>
      <div className="rounded-[var(--radius)] border border-line bg-sunken/50 p-3 text-xs text-ink-2">
        {existing ? "A draft already exists for this campaign and program." : "Applying creates and saves the filled school draft immediately."}
      </div>
      {error && <p className="text-xs font-medium text-bad" role="alert">{error}</p>}
      <Btn className="w-full" tone="primary" disabled={!programId || !campaignId || pending} onClick={open}>{pending ? "Applying template…" : existing ? "Open existing draft" : "Apply template"}</Btn>
    </div>
  );
}
