"use client";

import { useState, useTransition } from "react";
import { updateProgramStatus } from "@/lib/program-status-client";
import { useProgramVisibility } from "./program-visibility";

type Status = "saved" | "ruled_out" | undefined;

export function ProgramControls({ programId, initial }: { programId: string; initial: Status }) {
  const [status, setStatus] = useState<Status>(initial);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const { hidePrograms, restorePrograms, setProgramStatus } = useProgramVisibility();

  const set = (next: "saved" | "ruled_out") => {
    const previous = status;
    const target = status === next ? undefined : next;
    if (target === "ruled_out") hidePrograms([programId]);
    setStatus(target);
    setProgramStatus(programId, target);
    setMessage(null);
    start(async () => {
      const result = await updateProgramStatus(programId, target);
      if (!result.ok) {
        if (target === "ruled_out") restorePrograms([programId]);
        setStatus(previous);
        setProgramStatus(programId, previous);
        setMessage("Couldn’t save that change.");
      } else {
        setMessage(target === "saved" ? "Saved" : target === "ruled_out" ? "Ruled out" : "Choice cleared");
      }
    });
  };

  return (
    <div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => set("saved")}
          disabled={pending}
          aria-pressed={status === "saved"}
          title={status === "saved" ? "Remove from your saved list" : "Add to your saved list"}
          className={`wr-btn wr-btn--small ${status === "saved" ? "wr-btn--primary" : "wr-btn--neutral"}`}
        >
          {pending && status === "saved" ? "Saving…" : status === "saved" ? "Saved ✓" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => set("ruled_out")}
          disabled={pending}
          aria-pressed={status === "ruled_out"}
          title={status === "ruled_out" ? "Restore this program to search" : "Hide this program from search"}
          className={`wr-btn wr-btn--small ${status === "ruled_out" ? "wr-btn--danger" : "wr-btn--neutral"}`}
        >
          {pending && status === "ruled_out" ? "Saving…" : status === "ruled_out" ? "Ruled out ✓" : "Rule out"}
        </button>
      </div>
      <span className="sr-only" aria-live="polite">{pending ? "Saving selection" : message}</span>
      {message?.startsWith("Couldn’t") && <p className="mt-1 text-[10px] font-medium text-bad" role="alert">{message}</p>}
    </div>
  );
}
