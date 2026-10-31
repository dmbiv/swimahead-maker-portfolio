"use client";

import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { conferenceProgramsHref } from "@/lib/explore-navigation";

export type ConferenceSquad = "all" | "men" | "women" | "coed";

const SQUAD_OPTIONS: Array<{ value: ConferenceSquad; label: string }> = [
  { value: "all", label: "All squads" },
  { value: "men", label: "Men’s" },
  { value: "women", label: "Women’s" },
  { value: "coed", label: "Coed" },
];

export function ConferenceSquadSelector({
  conferenceId,
  returnHref,
  squad,
}: {
  conferenceId: string;
  returnHref: string;
  squad: ConferenceSquad;
}) {
  const router = useRouter();
  const menuRef = useRef<HTMLDetailsElement>(null);
  const [pending, startTransition] = useTransition();
  const selectedLabel = SQUAD_OPTIONS.find((option) => option.value === squad)?.label ?? "All squads";

  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) {
        menuRef.current?.removeAttribute("open");
      }
    };
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !menuRef.current?.open) return;
      menuRef.current.open = false;
      menuRef.current.querySelector<HTMLElement>("summary")?.focus();
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeWithEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeWithEscape);
    };
  }, []);

  const selectSquad = (next: ConferenceSquad) => {
    if (menuRef.current) menuRef.current.open = false;
    if (next === squad) return;
    startTransition(() => {
      router.replace(
        conferenceProgramsHref(
          conferenceId,
          returnHref,
          next === "all" ? undefined : next,
        ),
        { scroll: false },
      );
    });
  };

  return (
    <details ref={menuRef} className="conference-squad-menu">
      <summary
        className="wr-btn wr-btn--neutral wr-btn--small conference-squad-trigger"
        aria-label={`Filter by squad, currently ${selectedLabel}`}
        data-pending={pending}
      >
        <span className="conference-squad-label">Squad</span>
        <span>{selectedLabel}</span>
        <span className="program-filter-chevron" aria-hidden>
          <svg viewBox="0 0 12 12" focusable="false">
            <path d="m2.75 4.5 3.25 3 3.25-3" />
          </svg>
        </span>
      </summary>
      <div className="conference-squad-popover" role="menu" aria-label="Filter conference programs by squad">
        {SQUAD_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="menuitemradio"
            aria-checked={squad === option.value}
            data-active={squad === option.value}
            disabled={pending}
            onClick={() => selectSquad(option.value)}
          >
            <span>{option.label}</span>
            {squad === option.value && <span aria-hidden>✓</span>}
          </button>
        ))}
      </div>
    </details>
  );
}
