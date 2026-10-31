"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PublicProgramMapItem } from "@/lib/public-programs";
import { programListHref, resultPageNumber } from "@/lib/explore-navigation";
import { useProgramVisibility } from "./program-visibility";

const RESULTS_PER_PAGE = 24;
const CampusMap = dynamic(
  () => import("@/components/campus-map").then((module) => module.CampusMap),
  { ssr: false, loading: () => <div className="flex min-h-64 items-center justify-center text-xs text-ink-3">Loading map…</div> },
);

function hrefForPage(baseHref: string, page: number): string {
  const [pathnameAndQuery] = baseHref.split("#", 1);
  const [pathname, query = ""] = pathnameAndQuery.split("?", 2);
  const params = new URLSearchParams(query);
  if (page > 1) params.set("page", String(page));
  else params.delete("page");
  const serialized = params.toString();
  return serialized ? `${pathname}?${serialized}` : pathname;
}

export function ProgramMap({ campusCount, listBaseHref }: {
  campusCount: number;
  listBaseHref: string;
}) {
  const [open, setOpen] = useState(false);
  const [programs, setPrograms] = useState<PublicProgramMapItem[] | null>(null);
  const [error, setError] = useState(false);
  const loadingRef = useRef(false);
  const mountedRef = useRef(true);
  const { hiddenProgramIds, programIds } = useProgramVisibility();
  const visiblePrograms = useMemo(
    () => (programs ?? []).filter((program) => !hiddenProgramIds.has(program.id)),
    [hiddenProgramIds, programs],
  );
  const visibleCampusCount = programs
    ? new Set(visiblePrograms.map((program) => program.institutionId)).size
    : campusCount;
  const programListHrefs = useMemo(() => Object.fromEntries((programs ?? []).map((program, index) => [
    program.id,
    programListHref(
      hrefForPage(listBaseHref, resultPageNumber(index, RESULTS_PER_PAGE)),
      program.id,
    ),
  ])), [listBaseHref, programs]);

  const load = useCallback(async () => {
    if (programs || loadingRef.current) return;
    loadingRef.current = true;
    setError(false);
    try {
      const response = await fetch("/api/s/explore-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "map", programIds }),
      });
      if (!response.ok) throw new Error(`Map request failed (${response.status})`);
      const payload = await response.json() as { programs?: PublicProgramMapItem[] };
      if (!Array.isArray(payload.programs)) throw new Error("Invalid map response");
      if (mountedRef.current) setPrograms(payload.programs);
    } catch {
      if (mountedRef.current) setError(true);
    } finally {
      loadingRef.current = false;
    }
  }, [programIds, programs]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 768px)");
    const revealDesktopMap = () => {
      if (!desktop.matches) return;
      setOpen(true);
      void load();
    };
    revealDesktopMap();
    desktop.addEventListener("change", revealDesktopMap);
    return () => desktop.removeEventListener("change", revealDesktopMap);
  }, [load]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) void load();
  };

  return (
    <section className="program-map-shell" aria-label="Campus map">
      <button type="button" className="program-map-toggle" aria-expanded={open} aria-controls="program-map-body" onClick={toggle}>
        <span><strong>Campus map</strong> <span className="text-ink-3">· {visibleCampusCount} locations</span></span>
        <span aria-hidden>{open ? "Hide" : "Show"}</span>
      </button>
      <div id="program-map-body" className="program-map-body" data-open={open}>
        {open && error ? (
          <div className="flex min-h-40 flex-col items-center justify-center gap-2 text-xs text-ink-3">
            <p>The map couldn’t load.</p>
            <button type="button" className="wr-btn wr-btn--neutral wr-btn--small" onClick={() => void load()}>Try again</button>
          </div>
        ) : open && programs ? (
          <>
            <CampusMap programs={visiblePrograms} programListHrefs={programListHrefs} />
            <p className="mt-2 text-[10px] text-ink-3">Select a campus to jump to its program card. Pinch, scroll, or use the controls to zoom.</p>
          </>
        ) : open ? (
          <div className="flex min-h-40 items-center justify-center text-xs text-ink-3">Loading campus locations…</div>
        ) : null}
      </div>
    </section>
  );
}
