"use client";

import * as FormControl from "@/components/form-control";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { searchCollegesAction, addCoachCollegeAction } from "@/lib/coach-actions";
import type { CollegeOption } from "@/lib/coach-college-directory";

const SQUAD_LABEL: Record<CollegeOption["squad"], string> = {
  men: "Men",
  women: "Women",
  coed: "Coed",
};

export function CollegePicker({
  suggestion,
  mode = "first",
  attachedProgramIds = [],
  headingLevel = "h1",
}: {
  suggestion: CollegeOption | null;
  mode?: "first" | "add";
  attachedProgramIds?: string[];
  headingLevel?: "h1" | "h2";
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CollegeOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();
  const seq = useRef(0);
  const attachedProgramKey = attachedProgramIds.join("|");
  const Heading = headingLevel;

  useEffect(() => {
    const attached = new Set(attachedProgramKey ? attachedProgramKey.split("|") : []);
    const clean = query.trim();
    const token = ++seq.current;
    const timer = setTimeout(async () => {
      if (clean.length < 2) {
        if (token === seq.current) {
          setResults([]);
          setSearching(false);
        }
        return;
      }
      setSearching(true);
      const found = await searchCollegesAction(clean);
      if (token === seq.current) {
        setResults(found.filter((option) => !attached.has(option.athleticProgramId)));
        setSearching(false);
      }
    }, clean.length < 2 ? 0 : 220);
    return () => clearTimeout(timer);
  }, [query, attachedProgramKey]);

  function choose(option: CollegeOption) {
    setError(null);
    startSave(async () => {
      const res = await addCoachCollegeAction(option.athleticProgramId);
      if (res.ok) router.refresh();
      else setError(res.error ?? "Could not add that college.");
    });
  }

  return (
    <div className="max-w-xl space-y-4">
      <div>
        <Heading className={headingLevel === "h2" ? "text-base font-semibold" : undefined}>
          {mode === "add" ? "Add another program" : "Which program do you coach?"}
        </Heading>
        <p className="mt-1 text-sm text-ink-2">
          {mode === "add"
            ? "Add another team if you run more than one program (for example a men's and a women's squad)."
            : "This sets your roster context and tailors recruit search. You can add another program later."}
        </p>
      </div>

      {suggestion ? (
        <div className="wr-card p-4">
          <p className="text-xs uppercase tracking-wide text-ink-3">Suggested</p>
          <CollegeRow option={suggestion} onChoose={choose} disabled={saving} />
        </div>
      ) : null}

      <div className="wr-card p-4">
        <label className="block text-sm">
          <span className="wr-field-label block">Search colleges</span>
          <FormControl.Input
            className="wr-control mt-1 w-full"
            placeholder="Start typing a school name..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </label>

        <div className="mt-3 divide-y divide-[var(--line)]">
          {searching && results.length === 0 ? (
            <p className="py-2 text-sm text-ink-3">Searching...</p>
          ) : null}
          {!searching && query.trim().length >= 2 && results.length === 0 ? (
            <p className="py-2 text-sm text-ink-3">
              No supported swimming program matches that. Try a shorter or different name.
            </p>
          ) : null}
          {results.map((option) => (
            <CollegeRow
              key={option.athleticProgramId}
              option={option}
              onChoose={choose}
              disabled={saving}
            />
          ))}
        </div>
      </div>

      {error ? <p className="text-sm text-[var(--danger,#c0392b)]">{error}</p> : null}
    </div>
  );
}

function CollegeRow({
  option,
  onChoose,
  disabled,
}: {
  option: CollegeOption;
  onChoose: (option: CollegeOption) => void;
  disabled: boolean;
}) {
  const meta = [
    option.division,
    SQUAD_LABEL[option.squad],
    [option.city, option.stateCode].filter(Boolean).join(", "),
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="truncate font-medium">{option.name}</p>
        {meta ? <p className="truncate text-xs text-ink-3">{meta}</p> : null}
      </div>
      <button
        type="button"
        className="wr-btn wr-btn--neutral shrink-0"
        disabled={disabled}
        onClick={() => onChoose(option)}
      >
        {disabled ? "Adding..." : "Add"}
      </button>
    </div>
  );
}
