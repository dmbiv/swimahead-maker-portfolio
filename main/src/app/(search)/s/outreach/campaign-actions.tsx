"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { announceNavigationStart } from "@/components/navigation-feedback";
import { deleteOutreachTemplate } from "./actions";

export function DeleteCampaignButton({ campaignId, name, draftCount, leavePage = false }: {
  campaignId: string;
  name: string;
  draftCount: number;
  leavePage?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const remove = () => {
    const versions = draftCount === 0
      ? ""
      : ` and ${draftCount} school-specific ${draftCount === 1 ? "version" : "versions"}`;
    if (!window.confirm(`Delete “${name}”${versions}? This cannot be undone.`)) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteOutreachTemplate(campaignId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (leavePage) {
        const destination = "/s/outreach/campaigns";
        announceNavigationStart(destination);
        router.replace(destination);
      } else {
        router.refresh();
      }
    });
  };

  return (
    <span className="inline-flex min-w-0 flex-col items-end gap-1">
      <button type="button" className="wr-btn wr-btn--ghost wr-btn--small text-bad" disabled={pending} onClick={remove}>
        {pending ? "Deleting…" : "Delete"}
      </button>
      {error && <span className="max-w-56 text-right text-[10px] leading-4 text-bad" role="alert">{error}</span>}
    </span>
  );
}
