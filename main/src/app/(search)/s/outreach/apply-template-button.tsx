"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { announceNavigationStart } from "@/components/navigation-feedback";
import { applyOutreachTemplate } from "./actions";

export function ApplyTemplateButton({ campaignId, programId }: {
  campaignId: string;
  programId: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const apply = () => {
    setError(null);
    startTransition(async () => {
      const result = await applyOutreachTemplate({ templateId: campaignId, programId });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const destination = `/s/outreach/campaigns/${campaignId}/drafts/${programId}`;
      announceNavigationStart(destination);
      router.push(destination);
    });
  };

  return (
    <span className="shrink-0 text-right">
      <button type="button" disabled={pending} onClick={apply} className="text-[11px] font-semibold text-accent-2 hover:underline disabled:cursor-wait disabled:opacity-60">
        {pending ? "Applying…" : "Apply template"}
      </button>
      {error && <span className="mt-1 block max-w-56 text-[10px] font-medium text-bad" role="alert">{error}</span>}
    </span>
  );
}
