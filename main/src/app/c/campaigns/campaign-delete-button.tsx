"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { announceNavigationStart } from "@/components/navigation-feedback";
import { deleteCampaign } from "@/lib/campaign-actions";

export function CampaignDeleteButton({
  campaignId,
  name,
  recruitCount,
  returnHref,
}: {
  campaignId: string;
  name: string;
  recruitCount: number;
  returnHref?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function remove() {
    const recruits = recruitCount > 0
      ? ` and its ${recruitCount} ledger ${recruitCount === 1 ? "recruit" : "recruits"}`
      : "";
    if (!window.confirm(`Permanently delete “${name}”${recruits}? This cannot be undone.`)) return;

    setError(null);
    startTransition(async () => {
      const result = await deleteCampaign(campaignId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (returnHref) {
        announceNavigationStart(returnHref);
        router.replace(returnHref);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <span className="inline-flex min-w-0 flex-col items-end gap-1">
      <button
        type="button"
        className="wr-btn wr-btn--danger wr-btn--small"
        disabled={pending}
        onClick={remove}
      >
        {pending ? "Deleting…" : "Delete"}
      </button>
      {error ? <span className="max-w-64 text-right text-xs leading-4 text-bad" role="alert">{error}</span> : null}
    </span>
  );
}
