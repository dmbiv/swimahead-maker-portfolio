"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ComponentPropsWithoutRef } from "react";

type ProgramStatus = "saved" | "ruled_out" | undefined;

type ProgramVisibility = {
  programIds: readonly string[];
  hiddenProgramIds: ReadonlySet<string>;
  statuses: Readonly<Record<string, ProgramStatus>>;
  hidePrograms: (programIds: string[]) => void;
  restorePrograms: (programIds: string[]) => void;
  setProgramStatus: (programId: string, status: ProgramStatus) => void;
};

const EMPTY_PROGRAM_IDS = new Set<string>();
const EMPTY_PROGRAM_STATUSES: Readonly<Record<string, Exclude<ProgramStatus, undefined>>> = {};
const ProgramVisibilityContext = createContext<ProgramVisibility>({
  programIds: [],
  hiddenProgramIds: EMPTY_PROGRAM_IDS,
  statuses: {},
  hidePrograms: () => undefined,
  restorePrograms: () => undefined,
  setProgramStatus: () => undefined,
});

export function ProgramVisibilityProvider({
  children,
  showRuledOut,
  programIds,
  initialStatuses = EMPTY_PROGRAM_STATUSES,
}: {
  children: React.ReactNode;
  showRuledOut: boolean;
  programIds: readonly string[];
  initialStatuses?: Readonly<Record<string, Exclude<ProgramStatus, undefined>>>;
}) {
  const [optimisticallyRuledOut, setOptimisticallyRuledOut] = useState<Set<string>>(() => new Set());
  const [statuses, setStatuses] = useState<Record<string, ProgramStatus>>(() => ({ ...initialStatuses }));

  const hidePrograms = useCallback((programIds: string[]) => {
    if (showRuledOut || programIds.length === 0) return;
    setOptimisticallyRuledOut((current) => {
      const next = new Set(current);
      for (const programId of programIds) next.add(programId);
      return next;
    });
  }, [showRuledOut]);

  const restorePrograms = useCallback((programIds: string[]) => {
    if (programIds.length === 0) return;
    setOptimisticallyRuledOut((current) => {
      const next = new Set(current);
      for (const programId of programIds) next.delete(programId);
      return next;
    });
  }, []);

  const setProgramStatus = useCallback((programId: string, status: ProgramStatus) => {
    setStatuses((current) => ({ ...current, [programId]: status }));
  }, []);

  const value = useMemo<ProgramVisibility>(() => ({
    programIds,
    hiddenProgramIds: showRuledOut ? EMPTY_PROGRAM_IDS : optimisticallyRuledOut,
    statuses,
    hidePrograms,
    restorePrograms,
    setProgramStatus,
  }), [hidePrograms, optimisticallyRuledOut, programIds, restorePrograms, setProgramStatus, showRuledOut, statuses]);

  return <ProgramVisibilityContext.Provider value={value}>{children}</ProgramVisibilityContext.Provider>;
}

export function useProgramVisibility(): ProgramVisibility {
  return useContext(ProgramVisibilityContext);
}

export function HideWhenRuledOut({ children, programId }: { children: React.ReactNode; programId: string }) {
  const { hiddenProgramIds } = useProgramVisibility();
  return hiddenProgramIds.has(programId) ? null : children;
}

export function WhenProgramStatus({
  children,
  programId,
  initial,
  is,
}: {
  children: React.ReactNode;
  programId: string;
  initial: ProgramStatus;
  is: Exclude<ProgramStatus, undefined>;
}) {
  const { statuses } = useProgramVisibility();
  const status = Object.prototype.hasOwnProperty.call(statuses, programId)
    ? statuses[programId]
    : initial;
  return status === is ? children : null;
}

export function ProgramStatusBadge({ programId, initial }: { programId: string; initial: ProgramStatus }) {
  const { statuses } = useProgramVisibility();
  const status = Object.prototype.hasOwnProperty.call(statuses, programId)
    ? statuses[programId]
    : initial;
  if (status === "saved") {
    return <span className="wr-badge border-accent/30 bg-accent/8 text-accent-2">On your list</span>;
  }
  if (status === "ruled_out") {
    return <span className="wr-badge border-line bg-sunken text-ink-3">Ruled out</span>;
  }
  return null;
}

export function ProgramStatusArticle({
  programId,
  initial,
  className = "",
  ...props
}: ComponentPropsWithoutRef<"article"> & { programId: string; initial: ProgramStatus }) {
  const { statuses } = useProgramVisibility();
  const status = Object.prototype.hasOwnProperty.call(statuses, programId)
    ? statuses[programId]
    : initial;
  return (
    <article
      {...props}
      className={`${className} ${status === "ruled_out" ? "program-card--ruled-out" : ""}`.trim()}
    />
  );
}
