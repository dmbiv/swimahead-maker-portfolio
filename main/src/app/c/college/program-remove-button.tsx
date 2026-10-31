"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { removeCoachCollegeAction } from "@/lib/coach-actions";

export function ProgramRemoveButton({ collegeId, name }: { collegeId: string; name: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function remove() {
    if (!window.confirm(
      `Remove “${name}” from your coached programs? Its roster must be empty and its recruiting campaigns deleted first.`,
    )) return;

    setError(null);
    startTransition(async () => {
      const result = await removeCoachCollegeAction(collegeId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      document.cookie = "wr_coach_college=; path=/c; max-age=0; samesite=lax";
      router.refresh();
    });
  }

  return (
    <span className="inline-flex min-w-0 flex-col items-start gap-1">
      <button
        type="button"
        className="wr-btn wr-btn--danger wr-btn--small"
        disabled={pending}
        onClick={remove}
      >
        {pending ? "Removing…" : "Remove program"}
      </button>
      {error ? <span className="max-w-72 text-xs leading-4 text-bad" role="alert">{error}</span> : null}
    </span>
  );
}
