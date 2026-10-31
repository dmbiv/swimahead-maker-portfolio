"use client";

import * as FormControl from "@/components/form-control";
import Link from "@/components/app-link";
import { useEffect, useOptimistic, useRef, useState, useTransition, type SyntheticEvent } from "react";
import { useRouter } from "next/navigation";
import type {
  PublicCipFilterOption,
  PublicProgramFilters,
  SwimmerAdmissionScores,
} from "@/lib/public-programs";
import { EVENT_LABELS } from "@/lib/events";
import type { EventCode } from "@/lib/types";

const NUMBER_FIELDS = new Set(["enrollmentMin", "enrollmentMax", "netPriceMax", "admissionMax", "academicValue", "fitRank"]);
const MULTI_FIELDS = new Set(["conference", "division", "control", "cip", "state", "fitEvent"]);

function numberValue(value: number | null): string | undefined {
  return value === null ? undefined : String(value);
}

function multiSelectionLabel(group: string, values: string[]): string {
  const shown = values.slice(0, 2).join(", ");
  return `${group}: ${shown}${values.length > 2 ? ` +${values.length - 2}` : ""}`;
}

function FilterChevron() {
  return (
    <span className="program-filter-chevron" aria-hidden>
      <svg viewBox="0 0 12 12" focusable="false">
        <path d="m2.75 4.5 3.25 3 3.25-3" />
      </svg>
    </span>
  );
}

type ProgramDetailFilterName = "conference" | "division" | "control" | "cip";

function ProgramDetailGroup({
  label,
  name,
  options,
  selected,
}: {
  label: string;
  name: ProgramDetailFilterName;
  options: ReadonlyArray<{ value: string; label: string }>;
  selected: readonly string[];
}) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleOptions = normalizedQuery
    ? options.filter((option) => option.label.toLocaleLowerCase().includes(normalizedQuery))
    : options;
  const visibleValues = new Set(visibleOptions.map((option) => option.value));
  const selectedOutsideSearch = selected.filter((value) => !visibleValues.has(value));

  return (
    <details className="program-filter-detail-menu">
      <summary className="program-filter-detail-summary">
        <span>{label}</span>
        <span className="program-filter-detail-meta">{selected.length ? `${selected.length} selected` : "Any"}</span>
        <FilterChevron />
      </summary>
      <div className="program-filter-detail-body">
        {selectedOutsideSearch.map((value) => (
          <FormControl.Input key={value} type="hidden" name={name} value={value} />
        ))}
        <FormControl.Input
          className="wr-control program-filter-detail-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`Search ${label.toLocaleLowerCase()}`}
          aria-label={`Search ${label.toLocaleLowerCase()}`}
          autoComplete="off"
        />
        <div className="program-filter-check-grid program-filter-detail-options program-filter-scroll">
          {visibleOptions.map((option) => (
            <label key={option.value}>
              <FormControl.Input type="checkbox" name={name} value={option.value} defaultChecked={selected.includes(option.value)} />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
        {visibleOptions.length === 0 && <p className="program-filter-detail-empty">No matches</p>}
      </div>
    </details>
  );
}

export function ProgramFilters({
  filters,
  divisions,
  conferences,
  states,
  cipOptions,
  showRuledOut,
  ruledOutCount,
  signedIn,
  fitEventOptions,
  fitCoveragePrograms,
  fitQualifiedPrograms,
  fitCoveredConferenceCount,
  fitDatasetReady,
  fitSetupIssue,
  swimmerAdmissionScores,
  academicScoreCoverage,
  testScoreCoveragePrograms,
  academicMatchedPrograms,
  swimmingStrengthCoverage,
}: {
  filters: PublicProgramFilters;
  divisions: string[];
  conferences: Array<{ value: string; label: string }>;
  states: string[];
  cipOptions: PublicCipFilterOption[];
  showRuledOut: boolean;
  ruledOutCount: number;
  signedIn: boolean;
  fitEventOptions: EventCode[];
  fitCoveragePrograms: number;
  fitQualifiedPrograms: number;
  fitCoveredConferenceCount: number;
  fitDatasetReady: boolean;
  fitSetupIssue: "gender" | "times" | "events" | null;
  swimmerAdmissionScores: SwimmerAdmissionScores;
  academicScoreCoverage: number;
  testScoreCoveragePrograms: number;
  academicMatchedPrograms: number;
  swimmingStrengthCoverage: number;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [pendingNavigationKind, setPendingNavigationKind] = useState<"filter" | "search">("filter");
  const [optimisticFitEvents, setOptimisticFitEvents] = useOptimistic(filters.fitEvents);
  const savedAcademicScore = swimmerAdmissionScores[filters.academicTest];
  const effectiveAcademicValue = filters.academicValue ?? savedAcademicScore;
  const academicNeedsSavedScore = filters.academicMode === "middle_50"
    || filters.academicMode === "at_or_above_25th"
    || filters.academicMode === "above_75th";
  const academicSetupIssue = filters.academicMode !== "none"
    && (academicNeedsSavedScore || effectiveAcademicValue === null)
    && savedAcademicScore === null;

  useEffect(() => {
    const closeMenusOutside = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      for (const menu of formRef.current?.querySelectorAll<HTMLDetailsElement>("details.program-filter-menu[open]") ?? []) {
        if (!menu.contains(event.target)) menu.open = false;
      }
    };
    const closeMenusWithEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const menu = formRef.current?.querySelector<HTMLDetailsElement>("details.program-filter-menu[open]");
      if (!menu) return;
      menu.open = false;
      menu.querySelector<HTMLElement>("summary")?.focus();
    };
    document.addEventListener("pointerdown", closeMenusOutside);
    document.addEventListener("keydown", closeMenusWithEscape);
    return () => {
      document.removeEventListener("pointerdown", closeMenusOutside);
      document.removeEventListener("keydown", closeMenusWithEscape);
    };
  }, []);

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const values: Record<string, string> = {
      q: filters.query,
      squad: filters.squad,
      enrollmentMin: filters.minimumEnrollment == null ? "" : String(filters.minimumEnrollment),
      enrollmentMax: filters.maximumEnrollment == null ? "" : String(filters.maximumEnrollment),
      netPriceMax: filters.maximumNetPrice == null ? "" : String(filters.maximumNetPrice),
      admissionMax: filters.maximumAdmissionRate == null ? "" : String(filters.maximumAdmissionRate * 100),
      academicTest: filters.academicTest,
      academicMode: filters.academicMode,
      academicValue: effectiveAcademicValue == null ? "" : String(effectiveAcademicValue),
      sort: filters.sort,
      fitRank: String(filters.fitRank),
      fitMatch: filters.fitMatch,
    };
    for (const [name, value] of Object.entries(values)) {
      const field = form.elements.namedItem(name);
      if ((field instanceof HTMLInputElement || field instanceof HTMLSelectElement) && !(name === "q" && document.activeElement === field)) {
        field.value = value;
      }
    }
    const selectedValues: Record<string, readonly string[]> = {
      conference: filters.conferences,
      division: filters.divisions,
      control: filters.controls,
      cip: filters.cips,
      state: filters.states,
      fitEvent: filters.fitEvents,
    };
    for (const [name, selected] of Object.entries(selectedValues)) {
      for (const field of form.querySelectorAll<HTMLInputElement>(`input[type="checkbox"][name="${name}"]`)) {
        field.checked = selected.includes(field.value);
      }
    }
    for (const field of form.querySelectorAll<HTMLInputElement>('input[name="fitMode"]')) {
      field.checked = field.value === filters.fitMode;
    }
    const show = form.elements.namedItem("showRuledOut");
    if (show instanceof HTMLInputElement) show.checked = showRuledOut;
  }, [effectiveAcademicValue, filters, showRuledOut]);

  const navigate = ({
    nextFitEvents,
    submittedQuery,
  }: {
    nextFitEvents?: EventCode[];
    submittedQuery?: string;
  } = {}) => {
    const form = formRef.current;
    if (!form) return;
    const data = new FormData(form);
    data.set("q", submittedQuery ?? filters.query);
    const fitMode = String(data.get("fitMode") ?? "none");
    const academicMode = String(data.get("academicMode") ?? "none");
    const params = new URLSearchParams();
    for (const [key, raw] of data.entries()) {
      const value = String(raw).trim();
      if (!value) continue;
      if (key === "squad" && value === "all") continue;
      if (key === "sort" && value === "name") continue;
      if (key === "fitMode" && value === "none") continue;
      if (key === "fitMatch" && value === "any") continue;
      if (key === "fitRank" && fitMode !== "program_rank") continue;
      if (key === "academicMode" && value === "none") continue;
      if (key === "academicTest" && academicMode === "none" && value === "sat") continue;
      if (key === "academicValue" && academicMode === "none") continue;
      if (key === "academicValue" && academicMode !== "median_at_least" && academicMode !== "median_at_most") continue;
      if (MULTI_FIELDS.has(key)) params.append(key, value);
      else params.set(key, value);
    }
    const query = params.toString();
    setPendingNavigationKind(submittedQuery === undefined ? "filter" : "search");
    startTransition(() => {
      if (nextFitEvents) setOptimisticFitEvents(nextFitEvents);
      router.replace(query ? `/s/explore?${query}` : "/s/explore", { scroll: false });
    });
  };

  const onChange = (event: React.FormEvent<HTMLFormElement>) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLSelectElement)) return;
    if (!target.name || NUMBER_FIELDS.has(target.name)) return;
    if (target.name === "q") return;
    if (target.name === "fitEvent") {
      const selectedEvents = [...(formRef.current?.querySelectorAll<HTMLInputElement>('input[name="fitEvent"]') ?? [])]
        .filter((field) => field.checked)
        .map((field) => field.value as EventCode);
      navigate({ nextFitEvents: selectedEvents });
      return;
    }
    if (target.name === "academicTest") {
      const academicValue = formRef.current?.elements.namedItem("academicValue");
      if (academicValue instanceof HTMLInputElement) academicValue.value = "";
    }
    navigate();
  };

  const hasNumeric = filters.minimumEnrollment !== null || filters.maximumEnrollment !== null ||
    filters.maximumNetPrice !== null || filters.maximumAdmissionRate !== null;
  const activeCount = [
    Boolean(filters.query), filters.squad !== "all", filters.divisions.length > 0, filters.states.length > 0,
    filters.conferences.length > 0, filters.controls.length > 0, filters.cips.length > 0, hasNumeric, filters.sort !== "name", showRuledOut,
    filters.fitMode !== "none", filters.academicMode !== "none",
  ].filter(Boolean).length;
  const clearField = (name: string, fallback = "") => {
    if (MULTI_FIELDS.has(name)) {
      for (const field of formRef.current?.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`) ?? []) {
        if (field.type === "hidden") field.disabled = true;
        else field.checked = false;
      }
      navigate(name === "fitEvent" ? { nextFitEvents: [] } : undefined);
      return;
    }
    if (name === "fitMode") {
      const none = formRef.current?.querySelector<HTMLInputElement>('input[name="fitMode"][value="none"]');
      if (none) none.checked = true;
      navigate();
      return;
    }
    if (name === "academicMode") {
      const field = formRef.current?.elements.namedItem("academicMode");
      if (field instanceof HTMLSelectElement) field.value = "none";
      navigate();
      return;
    }
    const field = formRef.current?.elements.namedItem(name);
    if (field instanceof HTMLInputElement) {
      if (field.type === "checkbox") field.checked = false;
      else field.value = fallback;
    } else if (field instanceof HTMLSelectElement) {
      field.value = fallback;
    }
    navigate(name === "q" ? { submittedQuery: "" } : undefined);
  };
  const clearProgramDetails = () => {
    for (const name of ["conference", "division", "control", "cip"] as const) {
      for (const field of formRef.current?.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`) ?? []) {
        if (field.type === "hidden") field.disabled = true;
        else field.checked = false;
      }
    }
    navigate();
  };
  const selectedConferenceLabels = filters.conferences.map((value) =>
    conferences.find((conference) => conference.value === value)?.label ?? value);
  const selectedCipLabels = filters.cips.map((value) =>
    cipOptions.find((option) => option.value === value)?.label ?? "Selected major");
  const chips = [
    filters.query ? { name: "q", label: `Search: ${filters.query}` } : null,
    filters.squad !== "all" ? { name: "squad", label: filters.squad === "men" ? "Men’s" : filters.squad === "women" ? "Women’s" : "Coed", fallback: "all" } : null,
    filters.divisions.length > 0 ? { name: "division", label: multiSelectionLabel("Division", filters.divisions) } : null,
    filters.conferences.length > 0 ? { name: "conference", label: multiSelectionLabel("Conference", selectedConferenceLabels) } : null,
    filters.states.length > 0 ? { name: "state", label: `States: ${filters.states.join(", ")}` } : null,
    filters.controls.length > 0 ? { name: "control", label: multiSelectionLabel("Institution type", filters.controls) } : null,
    filters.cips.length > 0 ? { name: "cip", label: multiSelectionLabel("Major", selectedCipLabels) } : null,
    filters.minimumEnrollment !== null ? { name: "enrollmentMin", label: `Enrollment ≥ ${filters.minimumEnrollment.toLocaleString("en-US")}` } : null,
    filters.maximumEnrollment !== null ? { name: "enrollmentMax", label: `Enrollment ≤ ${filters.maximumEnrollment.toLocaleString("en-US")}` } : null,
    filters.maximumNetPrice !== null ? { name: "netPriceMax", label: `Net price ≤ $${filters.maximumNetPrice.toLocaleString("en-US")}` } : null,
    filters.maximumAdmissionRate !== null ? { name: "admissionMax", label: `Admission ≤ ${Math.round(filters.maximumAdmissionRate * 100)}%` } : null,
    filters.academicMode !== "none" ? {
      name: "academicMode",
      label: filters.academicMode === "median_at_least"
        ? `${filters.academicTest.toUpperCase()} median ≥ ${effectiveAcademicValue ?? "score"}`
        : filters.academicMode === "median_at_most"
          ? `${filters.academicTest.toUpperCase()} median ≤ ${effectiveAcademicValue ?? "score"}`
          : filters.academicMode === "middle_50"
            ? `${filters.academicTest.toUpperCase()}: in middle 50%`
            : filters.academicMode === "at_or_above_25th"
              ? `${filters.academicTest.toUpperCase()}: at/above 25th percentile`
              : `${filters.academicTest.toUpperCase()}: above 75th percentile`,
      fallback: "none",
    } : null,
    filters.sort !== "name" ? { name: "sort", label: `Sorted by ${filters.sort.replaceAll("-", " ")}`, fallback: "name" } : null,
    filters.fitMode !== "none" ? { name: "fitMode", label: filters.fitMode === "conference_score" ? "Can score at conference" : filters.fitMode === "conference_place" ? "Conference top 3" : `School top ${filters.fitRank} (conference meet)` } : null,
    optimisticFitEvents.length > 0 ? { name: "fitEvent", label: optimisticFitEvents.map((event) => EVENT_LABELS[event]).join(", ") } : null,
    showRuledOut ? { name: "showRuledOut", label: "Showing ruled-out" } : null,
  ].filter((chip): chip is { name: string; label: string; fallback?: string } => Boolean(chip));
  const programDetailCount = filters.conferences.length
    + filters.divisions.length
    + filters.controls.length
    + filters.cips.length;
  const moreFilterCount = [
    filters.minimumEnrollment !== null,
    filters.maximumEnrollment !== null,
    filters.maximumNetPrice !== null,
    filters.maximumAdmissionRate !== null,
    showRuledOut,
  ].filter(Boolean).length;
  const searching = pending && pendingNavigationKind === "search";
  const submitProgramSearch = (query?: string) => {
    const searchInput = formRef.current?.elements.namedItem("q");
    if (!(searchInput instanceof HTMLInputElement)) return;
    navigate({ submittedQuery: query ?? searchInput.value });
  };
  const closeOtherMenus = (event: SyntheticEvent<HTMLDetailsElement>) => {
    const openedMenu = event.currentTarget;
    if (!openedMenu.open) return;
    for (const menu of formRef.current?.querySelectorAll<HTMLDetailsElement>("details.program-filter-menu[open]") ?? []) {
      if (menu !== openedMenu) menu.open = false;
    }
  };

  return (
    <form
      ref={formRef}
      method="get"
      action="/s/explore"
      role="search"
      className="wr-card program-filter-panel p-3 sm:p-4"
      onChange={onChange}
      onSubmit={(event) => {
        event.preventDefault();
        navigate();
      }}
    >
      <h2 className="sr-only">Filter college swimming programs</h2>

      <div className="program-filter-main">
        <div className="program-filter-search" aria-busy={searching}>
          <label className="wr-field-label block" htmlFor="program-search-query">Search programs</label>
          <div className="flex items-center gap-2">
            <FormControl.Input
              id="program-search-query"
              className="wr-control min-w-0 flex-1"
              type="search"
              name="q"
              defaultValue={filters.query}
              placeholder="College, place, conference, or major"
              autoComplete="off"
              onKeyDown={(event) => {
                if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
                event.preventDefault();
                submitProgramSearch(event.currentTarget.value);
              }}
            />
            <button
              type="button"
              className="wr-btn wr-btn--neutral min-w-28 shrink-0"
              disabled={pending}
              onClick={() => submitProgramSearch()}
            >
              {searching ? (
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden />
                  Searching…
                </span>
              ) : "Search"}
            </button>
          </div>
          <span className="sr-only" aria-live="polite">{searching ? "Searching programs" : ""}</span>
        </div>

        <label>
          <span className="wr-field-label block">Squad</span>
          <FormControl.Select className="wr-control" name="squad" defaultValue={filters.squad}>
            <option value="all">All squads</option>
            <option value="men">Men’s</option>
            <option value="women">Women’s</option>
            <option value="coed">Coed</option>
          </FormControl.Select>
        </label>

        <label>
          <span className="wr-field-label block">Sort</span>
          <FormControl.Select className="wr-control" name="sort" defaultValue={filters.sort}>
            <option value="name">College name</option>
            <option value="swimming-strength">Swimming strength</option>
            <option value="conference">Conference</option>
            <option value="enrollment">Enrollment, largest first</option>
            <option value="net-price">Average net price, lowest first</option>
            <option value="admission-rate">Admission rate, lowest first</option>
          </FormControl.Select>
        </label>
      </div>

      <div className="program-filter-toolbar">
        <div className="program-filter-groups">
          <details className="program-filter-menu" onToggle={closeOtherMenus}>
            <summary className="program-filter-summary" data-active={programDetailCount > 0}>
              <span>Program</span>
              {programDetailCount > 0 && <span className="program-filter-count">{programDetailCount}</span>}
              <FilterChevron />
            </summary>
            <div className="program-filter-popover program-filter-popover--program">
              <div className="program-filter-popover-head">
                <div>
                  <strong>Program details</strong>
                  <p>Select any that work. Choices within each group are combined.</p>
                </div>
                {programDetailCount > 0 && (
                  <button type="button" className="program-filter-reset" onClick={clearProgramDetails}>Clear</button>
                )}
              </div>
              <div className="program-filter-detail-stack">
                <ProgramDetailGroup
                  label="Conference"
                  name="conference"
                  options={conferences}
                  selected={filters.conferences}
                />
                <ProgramDetailGroup
                  label="Division"
                  name="division"
                  options={divisions.map((division) => ({ value: division, label: division }))}
                  selected={filters.divisions}
                />
                <ProgramDetailGroup
                  label="Institution type"
                  name="control"
                  options={(["Public", "Private nonprofit", "Private for-profit", "Unknown"] as const).map((control) => ({
                    value: control,
                    label: control === "Unknown" ? "Not reported" : control,
                  }))}
                  selected={filters.controls}
                />
                <ProgramDetailGroup
                  label="Major"
                  name="cip"
                  options={cipOptions}
                  selected={filters.cips}
                />
              </div>
            </div>
          </details>

          <details className="program-filter-menu" onToggle={closeOtherMenus}>
            <summary className="program-filter-summary" data-active={filters.states.length > 0}>
              <span>Location</span>
              {filters.states.length > 0 && <span className="program-filter-count">{filters.states.length}</span>}
              <FilterChevron />
            </summary>
            <div className="program-filter-popover program-filter-popover--states">
              <div className="program-filter-popover-head">
                <div>
                  <strong>States</strong>
                  <p>{filters.states.length === 0 ? "All states are included." : `${filters.states.length} selected.`}</p>
                </div>
                {filters.states.length > 0 && (
                  <button type="button" className="program-filter-reset" onClick={() => clearField("state")}>Clear</button>
                )}
              </div>
              <fieldset className="program-filter-check-grid program-filter-scroll">
                <legend className="sr-only">Filter by state</legend>
                {states.map((state) => (
                  <label key={state}>
                    <FormControl.Input type="checkbox" name="state" value={state} defaultChecked={filters.states.includes(state)} />
                    <span>{state}</span>
                  </label>
                ))}
              </fieldset>
            </div>
          </details>

          {signedIn ? (
            <details className="program-filter-menu" onToggle={closeOtherMenus}>
              <summary className="program-filter-summary" data-active={filters.fitMode !== "none"}>
                <span>Athletic fit</span>
                {filters.fitMode !== "none" && <span className="program-filter-status-dot" aria-hidden />}
                <FilterChevron />
              </summary>
              <div className="program-filter-popover program-filter-popover--xl">
                <div className="program-filter-popover-head">
                  <div>
                    <strong id="performance-fit-title">Where can I score?</strong>
                    <p>Compare your times with conference-meet cutoffs.</p>
                  </div>
                  <span className="program-filter-data-status">
                    {!fitDatasetReady
                      ? "No dataset imported"
                      : filters.fitMode === "none"
                        ? `${fitCoveredConferenceCount} conferences loaded`
                        : fitSetupIssue === "events"
                          ? "Choose event(s)"
                          : `${fitQualifiedPrograms} match · ${fitCoveragePrograms} with data`}
                  </span>
                </div>

                <fieldset>
                  <legend className="sr-only">Athletic fit comparison</legend>
                  <div className="program-filter-choice-grid">
                    {([
                      ["none", "Off", "Show every program"],
                      ["conference_score", "Conference scorer", "Could earn individual points"],
                      ["conference_place", "Conference top 3", "Could place in the top three"],
                      ["program_rank", "School top X", "Xth-fastest at its conference meet"],
                    ] as const).map(([value, label, detail]) => (
                      <label key={value} className="program-filter-choice">
                        <FormControl.Input type="radio" name="fitMode" value={value} defaultChecked={filters.fitMode === value} />
                        <span>
                          <strong>{label}</strong>
                          <small>{detail}</small>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                {filters.fitMode !== "none" && (
                  <div className="program-filter-subsection">
                    <div className="program-filter-fit-settings">
                      {filters.fitMode === "program_rank" && (
                        <label>
                          <span className="wr-field-label block">Top X at conference meet</span>
                          <FormControl.Input className="wr-control font-data" type="number" name="fitRank" min="1" max="100" step="1" defaultValue={filters.fitRank} onBlur={() => navigate()} />
                        </label>
                      )}
                      <label>
                        <span className="wr-field-label block">Multiple events</span>
                        <FormControl.Select className="wr-control" name="fitMatch" defaultValue={filters.fitMatch}>
                          <option value="any">Match any selected event</option>
                          <option value="all">Match every selected event</option>
                        </FormControl.Select>
                      </label>
                    </div>
                    <fieldset className="mt-3">
                      <legend className="wr-field-label">Events</legend>
                      {fitEventOptions.length === 0 ? (
                        <p className="program-filter-empty">Add results in My Times first.</p>
                      ) : (
                        <div className="program-filter-check-grid program-filter-event-grid program-filter-scroll">
                          {fitEventOptions.map((event) => (
                            <label key={event}>
                              <FormControl.Input type="checkbox" name="fitEvent" value={event} defaultChecked={filters.fitEvents.includes(event)} />
                              <span>{EVENT_LABELS[event]}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </fieldset>
                    {filters.fitMode === "program_rank" && (
                      <p className="program-filter-help">School top X uses verified conference-championship swims rather than a full-season roster. Matching programs include a SwimCloud cross-check.</p>
                    )}
                  </div>
                )}
                {fitSetupIssue && fitSetupIssue !== "events" && (
                  <p className="program-filter-warning">
                    {fitSetupIssue === "gender" ? "Add your competition category in Profile before comparing cutoffs." : "Add at least one supported result in My Times before comparing cutoffs."}{" "}
                    <Link href={fitSetupIssue === "gender" ? "/s/profile" : "/s/times"}>{fitSetupIssue === "gender" ? "Open Profile" : "Open My Times"}</Link>
                  </p>
                )}
                {fitSetupIssue === "events" && <p className="program-filter-warning">Choose at least one event. Results are event-specific.</p>}
                {!fitSetupIssue && filters.fitMode !== "none" && !fitDatasetReady && <p className="program-filter-warning">No verified conference result set has been imported.</p>}
                {!fitSetupIssue && filters.fitMode !== "none" && fitDatasetReady && fitCoveragePrograms === 0 && <p className="program-filter-warning">The loaded result sets do not cover the current programs and selected events.</p>}
              </div>
            </details>
          ) : (
            <Link href="/sign-in?next=%2Fs%2Fexplore" className="program-filter-signin">
              <span>Athletic fit</span><small>Sign in</small>
            </Link>
          )}

          {signedIn && (
            <details className="program-filter-menu program-filter-menu--right" onToggle={closeOtherMenus}>
              <summary className="program-filter-summary" data-active={filters.academicMode !== "none"}>
                <span>Academic fit</span>
                {filters.academicMode !== "none" && <span className="program-filter-status-dot" aria-hidden />}
                <FilterChevron />
              </summary>
              <div className="program-filter-popover program-filter-popover--wide">
                <div className="program-filter-popover-head">
                  <div>
                    <strong id="academic-fit-title">How does my score compare?</strong>
                    <p>Use your saved SAT or ACT against reported admission ranges.</p>
                  </div>
                  <span className="program-filter-data-status">
                    {academicSetupIssue
                      ? `${filters.academicTest.toUpperCase()} score needed`
                      : filters.academicMode === "none"
                        ? `${testScoreCoveragePrograms} programs with test score data`
                        : `${academicMatchedPrograms} match · ${academicScoreCoverage} with data`}
                  </span>
                </div>

                <div className="program-filter-field-grid">
                  <label>
                    <span className="wr-field-label block">Test</span>
                    <FormControl.Select className="wr-control" name="academicTest" defaultValue={filters.academicTest}>
                      <option value="sat">SAT{swimmerAdmissionScores.sat === null ? " · not saved" : ` · ${swimmerAdmissionScores.sat}`}</option>
                      <option value="act">ACT{swimmerAdmissionScores.act === null ? " · not saved" : ` · ${swimmerAdmissionScores.act}`}</option>
                    </FormControl.Select>
                  </label>
                  <label>
                    <span className="wr-field-label block">Comparison</span>
                    <FormControl.Select className="wr-control" name="academicMode" defaultValue={filters.academicMode}>
                      <option value="none">Off · show every college</option>
                      <option value="median_at_least">College median is at least X</option>
                      <option value="median_at_most">College median is at most X</option>
                      <option value="middle_50">My score is in the middle 50%</option>
                      <option value="at_or_above_25th">My score is at or above the 25th percentile</option>
                      <option value="above_75th">My score is above the 75th percentile</option>
                    </FormControl.Select>
                  </label>
                  {(filters.academicMode === "median_at_least" || filters.academicMode === "median_at_most") && (
                    <label>
                      <span className="wr-field-label block">X · median cutoff</span>
                      <FormControl.Input
                        className="wr-control font-data"
                        type="number"
                        name="academicValue"
                        min={filters.academicTest === "sat" ? 400 : 1}
                        max={filters.academicTest === "sat" ? 1600 : 36}
                        step={filters.academicTest === "sat" ? 10 : 1}
                        defaultValue={numberValue(effectiveAcademicValue)}
                        placeholder={savedAcademicScore === null ? "Enter a score" : String(savedAcademicScore)}
                        onBlur={() => navigate()}
                      />
                    </label>
                  )}
                </div>

                <p className="program-filter-help">
                  {filters.academicMode === "median_at_least" || filters.academicMode === "median_at_most"
                    ? "X defaults to your saved score, but you can enter another cutoff."
                    : filters.academicMode === "middle_50"
                      ? "Includes colleges where your score is between the reported 25th and 75th percentiles."
                      : filters.academicMode === "at_or_above_25th"
                        ? "Includes colleges where your score meets or exceeds the reported 25th percentile."
                        : filters.academicMode === "above_75th"
                          ? "Includes colleges where your score is strictly above the reported 75th percentile."
                          : "Choose a median cutoff or compare your saved score with reported percentile ranges."}
                  {filters.academicTest === "sat" && " SAT composite values combine the matching reported reading and math percentiles."}
                </p>
                {savedAcademicScore === null && (
                  <p className="program-filter-warning">
                    Your profile has no {filters.academicTest.toUpperCase()} score. {academicNeedsSavedScore
                      ? "This comparison needs a saved score."
                      : "Enter X directly or save a score to use it as the default."}{" "}
                    <Link href="/s/profile">Open Profile</Link>
                  </p>
                )}
                {filters.academicMode !== "none" && !academicSetupIssue && academicScoreCoverage === 0 && (
                  <p className="program-filter-warning">No colleges report every value required for this comparison.</p>
                )}
              </div>
            </details>
          )}

          <details className={`program-filter-menu${signedIn ? " program-filter-menu--right" : ""}`} onToggle={closeOtherMenus}>
            <summary className="program-filter-summary" data-active={moreFilterCount > 0}>
              <span>More</span>
              {moreFilterCount > 0 && <span className="program-filter-count">{moreFilterCount}</span>}
              <FilterChevron />
            </summary>
            <div className="program-filter-popover program-filter-popover--wide">
              <div className="program-filter-popover-head">
                <div>
                  <strong>More filters</strong>
                  <p>Enrollment, cost, admission rate, and visibility.</p>
                </div>
              </div>
              <div className="program-filter-field-grid">
                <label>
                  <span className="wr-field-label block">Minimum enrollment</span>
                  <FormControl.Input className="wr-control font-data" type="number" min="0" step="1" name="enrollmentMin" defaultValue={numberValue(filters.minimumEnrollment)} onBlur={() => navigate()} />
                </label>
                <label>
                  <span className="wr-field-label block">Maximum enrollment</span>
                  <FormControl.Input className="wr-control font-data" type="number" min="0" step="1" name="enrollmentMax" defaultValue={numberValue(filters.maximumEnrollment)} onBlur={() => navigate()} />
                </label>
                <label>
                  <span className="wr-field-label block">Maximum average net price</span>
                  <FormControl.Input className="wr-control font-data" type="number" min="0" step="500" name="netPriceMax" defaultValue={numberValue(filters.maximumNetPrice)} onBlur={() => navigate()} />
                </label>
                <label>
                  <span className="wr-field-label block">Maximum admission rate (%)</span>
                  <FormControl.Input className="wr-control font-data" type="number" min="0" max="100" step="0.1" name="admissionMax" defaultValue={filters.maximumAdmissionRate === null ? undefined : filters.maximumAdmissionRate * 100} onBlur={() => navigate()} />
                </label>
              </div>
              <p className="program-filter-help">Programs without a reported value are omitted when one of these limits is active.</p>
              {signedIn && ruledOutCount > 0 && (
                <label className="program-filter-toggle">
                  <FormControl.Input type="checkbox" name="showRuledOut" value="1" defaultChecked={showRuledOut} />
                  <span>Show ruled-out programs ({ruledOutCount})</span>
                </label>
              )}
            </div>
          </details>
        </div>
        <div className="program-filter-toolbar-meta">
          <span aria-live="polite">
            {pending ? "Updating…" : activeCount ? `${activeCount} active` : "All programs"}
          </span>
          {activeCount > 0 && <Link href="/s/explore">Clear all</Link>}
        </div>
      </div>

      {chips.length > 0 && (
        <div className="program-filter-chip-row" aria-label="Active filters">
          {chips.map((chip) => (
            <button key={chip.name} type="button" className="filter-chip" onClick={() => clearField(chip.name, chip.fallback)} aria-label={`Remove ${chip.label} filter`}>
              {chip.label} <span aria-hidden>×</span>
            </button>
          ))}
        </div>
      )}

      {filters.sort === "swimming-strength" && (
        <p className="program-filter-context-note">
          Swimming strength compares each program’s verified third-fastest swimmer across like-for-like peer groups. {swimmingStrengthCoverage.toLocaleString("en-US")} programs have enough evidence; unscored programs appear last.
        </p>
      )}
    </form>
  );
}
