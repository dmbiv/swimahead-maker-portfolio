"use client";

import * as FormControl from "@/components/form-control";
import { Suspense, use, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Badge, Btn, Card, Select } from "@/components/ui";
import {
  EMPTY_OUTREACH_TIME_CONFIG,
  OUTREACH_STAGES,
  OUTREACH_STAGE_LABELS,
  STARTER_OUTREACH_TEMPLATE,
  insertPlaceholder,
  outreachStageSupportsResults,
  outreachMergeValues,
  outreachPlaceholderCount,
  removeOutreachResultsBlock,
  renderOutreachText,
  unknownOutreachPlaceholders,
  usesOutreachPlaceholder,
  type OutreachPlaceholder,
  type OutreachProgram,
  type OutreachStage,
  type OutreachSwimmer,
  type OutreachTimeConfig,
  type OutreachTimeEntry,
  type SwimmerOutreachTemplate,
  OUTREACH_DATABASE_UPDATE_ERROR,
} from "@/lib/swimmer-outreach";
import { saveOutreachTemplate } from "./actions";
import { PlaceholderLibrary } from "./placeholder-library";
import { announceNavigationStart } from "@/components/navigation-feedback";

type CampaignForm = {
  name: string;
  stage: OutreachStage;
  subjectTemplate: string;
  bodyTemplate: string;
  timeConfig: OutreachTimeConfig;
};

type ResultsPromise = Promise<
  | { status: "ready"; results: OutreachTimeEntry[] }
  | { status: "unavailable"; message: string }
>;

function AsyncResultsBuilder({ results, config, gender, onChange }: {
  results: ResultsPromise;
  config: OutreachTimeConfig;
  gender: OutreachSwimmer["gender"];
  onChange: (next: OutreachTimeConfig) => void;
}) {
  const loaded = use(results);
  if (loaded.status === "unavailable") {
    return <p className="rounded-[var(--radius)] border border-warn/30 bg-warn/5 p-3 text-xs text-warn">{loaded.message}</p>;
  }
  return <ResultsBuilder config={config} availableTimes={loaded.results} gender={gender} onChange={onChange} />;
}

function ResultsLoading() {
  return <div className="h-24 animate-pulse rounded-[var(--radius)] border border-line bg-sunken/40" aria-label="Loading swim results" />;
}

const ResultsBuilder = dynamic(
  () => import("./best-times-builder").then((module) => module.ResultsBuilder),
  { loading: ResultsLoading },
);

function initialForm(campaign?: SwimmerOutreachTemplate): CampaignForm {
  const form: CampaignForm = campaign
    ? {
      name: campaign.name,
      stage: campaign.stage,
      subjectTemplate: campaign.subjectTemplate,
      bodyTemplate: campaign.bodyTemplate,
      timeConfig: { ...campaign.timeConfig, entries: [...campaign.timeConfig.entries] },
    }
    : {
      ...STARTER_OUTREACH_TEMPLATE,
      timeConfig: { ...EMPTY_OUTREACH_TIME_CONFIG, entries: [] },
    };
  if (outreachStageSupportsResults(form.stage)) return form;
  return {
    ...form,
    subjectTemplate: removeOutreachResultsBlock(form.subjectTemplate),
    bodyTemplate: removeOutreachResultsBlock(form.bodyTemplate),
    timeConfig: { ...EMPTY_OUTREACH_TIME_CONFIG, entries: [] },
  };
}

const SAMPLE_PROGRAM: OutreachProgram = {
  id: "sample",
  name: "Selected University",
  short: "Selected University, Swimming",
  squad: "women",
  division: "Division I",
  staffUrl: "",
  questionnaireUrl: "",
};

export function CampaignEditor({ campaign, programs, swimmer, results, storageReady = true }: {
  campaign?: SwimmerOutreachTemplate;
  programs: OutreachProgram[];
  swimmer: OutreachSwimmer;
  results: ResultsPromise;
  storageReady?: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState<CampaignForm>(() => initialForm(campaign));
  const [baseline, setBaseline] = useState(() => JSON.stringify(initialForm(campaign)));
  const [previewProgramId, setPreviewProgramId] = useState(programs[0]?.id ?? "sample");
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const activeField = useRef<"subjectTemplate" | "bodyTemplate">("bodyTemplate");

  const previewProgram = programs.find((program) => program.id === previewProgramId) ?? SAMPLE_PROGRAM;
  const mergeValues = outreachMergeValues(
    previewProgram,
    swimmer,
    { coachName: "Jordan Lee", coachEmail: "coach@school.edu" },
    form.timeConfig,
  );
  const renderedSubject = renderOutreachText(form.subjectTemplate, mergeValues);
  const renderedBody = renderOutreachText(form.bodyTemplate, mergeValues);
  const supportsResults = outreachStageSupportsResults(form.stage);
  const unknown = unknownOutreachPlaceholders(form.subjectTemplate, form.bodyTemplate);
  const subjectUsesTimes = usesOutreachPlaceholder(form.subjectTemplate, "best_times");
  const timeBlockCount = outreachPlaceholderCount(form.bodyTemplate, "best_times");
  const timeMismatch = !supportsResults
    ? null
    : subjectUsesTimes
    ? "Selected results belong in the message, not the subject."
    : timeBlockCount > 1
      ? "Use the selected-results field only once."
      : timeBlockCount === 1 && form.timeConfig.entries.length === 0
        ? "Choose at least one exact result or remove the selected-results field."
        : timeBlockCount === 0 && form.timeConfig.entries.length > 0
          ? "Insert the selected-results field so the chosen swims appear."
          : null;
  const profileGaps = useMemo(() => [
    !swimmer.club ? "club / team" : null,
    !swimmer.majors ? "academic interests" : null,
    swimmer.gpa == null || swimmer.gpa <= 0 ? "GPA" : null,
    !swimmer.email ? "email" : null,
  ].filter((value): value is string => Boolean(value)), [swimmer]);
  const dirty = JSON.stringify(form) !== baseline;
  const canSave = Boolean(
    storageReady && dirty && form.name.trim() && form.subjectTemplate.trim() && form.bodyTemplate.trim() && !unknown.length && !timeMismatch,
  );
  const updateTimeConfig = useCallback((timeConfig: OutreachTimeConfig) => {
    setForm((current) => ({ ...current, timeConfig }));
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const insert = (key: OutreachPlaceholder) => {
    if (key === "best_times" && outreachPlaceholderCount(form.bodyTemplate, "best_times") > 0) {
      const start = form.bodyTemplate.search(/\{\{\s*best_times\s*\}\}/);
      setNotice("The message already contains its selected-results field.");
      requestAnimationFrame(() => {
        bodyRef.current?.focus();
        bodyRef.current?.setSelectionRange(start, start + form.bodyTemplate.slice(start).match(/^\{\{\s*best_times\s*\}\}/)![0].length);
      });
      return;
    }
    const field = key === "best_times" ? "bodyTemplate" : activeField.current;
    const element = field === "subjectTemplate" ? subjectRef.current : bodyRef.current;
    const start = element?.selectionStart ?? form[field].length;
    const end = element?.selectionEnd ?? start;
    const result = insertPlaceholder(form[field], key, start, end);
    setForm((current) => ({ ...current, [field]: result.value }));
    requestAnimationFrame(() => {
      element?.focus();
      element?.setSelectionRange(result.cursor, result.cursor);
    });
  };

  const save = () => {
    setNotice(null);
    startTransition(async () => {
      const result = await saveOutreachTemplate({ id: campaign?.id ?? null, ...form });
      if (!result.ok) {
        setNotice(result.error);
        return;
      }
      const saved = initialForm(result.template);
      setForm(saved);
      setBaseline(JSON.stringify(saved));
      if (!campaign) {
        const destination = `/s/outreach/campaigns/${result.template.id}`;
        announceNavigationStart(destination);
        router.replace(destination);
        return;
      }
      setNotice("Campaign template saved.");
      router.refresh();
    });
  };

  return (
    <div className="space-y-5">
      <Card className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-accent-2">1 · Campaign identity</p>
            <h2 className="mt-1 text-base font-semibold">Name the folder and outreach stage</h2>
            <p className="mt-1 text-xs text-ink-3">A campaign is one reusable message for one moment in your recruiting process.</p>
          </div>
          <Badge tone="neutral">{campaign ? "Editing template" : "New template"}</Badge>
        </div>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
          <label className="block min-w-0">
            <span className="wr-field-label block">Campaign folder name</span>
            <FormControl.Input className="wr-control" maxLength={120} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Junior-year introductions" />
          </label>
          <label className="block min-w-0">
            <span className="wr-field-label block">Outreach stage</span>
            <Select className="!w-full" value={form.stage} onChange={(event) => {
              const stage = event.target.value as OutreachStage;
              setForm((current) => outreachStageSupportsResults(stage)
                ? { ...current, stage }
                : {
                    ...current,
                    stage,
                    subjectTemplate: removeOutreachResultsBlock(current.subjectTemplate),
                    bodyTemplate: removeOutreachResultsBlock(current.bodyTemplate),
                    timeConfig: { ...EMPTY_OUTREACH_TIME_CONFIG, entries: [] },
                  });
            }}>
              {OUTREACH_STAGES.map((stage) => <option key={stage} value={stage}>{OUTREACH_STAGE_LABELS[stage]}</option>)}
            </Select>
          </label>
        </div>
      </Card>

      {supportsResults && (
        <Card className="space-y-3 !p-3 sm:!p-4">
          <div>
            <p className="text-xs font-semibold text-accent-2">2 · Selected results</p>
            <h2 className="mt-0.5 text-sm font-semibold">Choose the swims to include</h2>
            <p className="mt-0.5 text-[11px] text-ink-3">Choose any exact result from My Times. This selection will become the starting point for every school draft in this campaign.</p>
          </div>
          <Suspense fallback={<ResultsLoading />}>
            <AsyncResultsBuilder results={results} config={form.timeConfig} gender={swimmer.gender} onChange={updateTimeConfig} />
          </Suspense>
        </Card>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
        <Card className="space-y-4">
          <div>
            <p className="text-xs font-semibold text-accent-2">{supportsResults ? "3" : "2"} · Reusable copy</p>
            <h2 className="mt-1 text-base font-semibold">Write the template</h2>
            <p className="mt-1 text-xs text-ink-3">Merge fields are filled when you apply this template. Each school draft is then plain editable text, and the master stays unchanged.</p>
          </div>
          <label className="block">
            <span className="wr-field-label block">Subject</span>
            <FormControl.Input
              ref={subjectRef}
              className="wr-control"
              maxLength={500}
              value={form.subjectTemplate}
              onFocus={() => { activeField.current = "subjectTemplate"; }}
              onSelect={() => { activeField.current = "subjectTemplate"; }}
              onChange={(event) => setForm((current) => ({ ...current, subjectTemplate: event.target.value }))}
            />
          </label>
          <label className="block">
            <span className="wr-field-label block">Message</span>
            <FormControl.Textarea
              ref={bodyRef}
              className="wr-control font-data !text-xs"
              rows={18}
              maxLength={20_000}
              value={form.bodyTemplate}
              onFocus={() => { activeField.current = "bodyTemplate"; }}
              onSelect={() => { activeField.current = "bodyTemplate"; }}
              onChange={(event) => setForm((current) => ({ ...current, bodyTemplate: event.target.value }))}
            />
          </label>
          {unknown.length > 0 && <p className="text-xs font-medium text-bad" role="alert">Unknown merge field{unknown.length === 1 ? "" : "s"}: {unknown.join(", ")}.</p>}
          {timeMismatch && <p className="text-xs font-medium text-bad" role="alert">{timeMismatch}</p>}
        </Card>

        <div className="space-y-4 lg:sticky lg:top-4">
          <Card><PlaceholderLibrary onInsert={insert} allowResults={supportsResults} /></Card>
          <Card className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-xs font-semibold">Rendered sample</p>
                <p className="mt-0.5 text-[11px] text-ink-3">Merge fields are replaced here only.</p>
              </div>
              {programs.length > 0 && (
                <label className="max-w-48 min-w-0">
                  <span className="sr-only">Preview program</span>
                  <Select className="!w-full min-w-0 text-xs" value={previewProgramId} onChange={(event) => setPreviewProgramId(event.target.value)}>
                    {programs.map((program) => <option key={program.id} value={program.id}>{program.short}</option>)}
                  </Select>
                </label>
              )}
            </div>
            <div className="rounded-[var(--radius)] border border-line bg-paper p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-3">Subject</p>
              <p className="mt-1 break-words text-xs font-semibold">{renderedSubject}</p>
              <div className="my-3 border-t border-line" />
              <p className="whitespace-pre-wrap text-[11px] leading-5 text-ink-2">{renderedBody}</p>
            </div>
            {profileGaps.length > 0 && <p className="text-[10px] leading-4 text-warn">Blank sample values: {profileGaps.join(", ")}. Add them in your profile before using those fields.</p>}
          </Card>
        </div>
      </div>

      <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-3 rounded-[var(--radius)] border border-line-strong bg-surface/95 p-3 shadow-lg backdrop-blur">
        <Btn onClick={() => {
          if (dirty && !window.confirm("Discard your unsaved template changes?")) return;
          const destination = campaign ? `/s/outreach/campaigns/${campaign.id}` : "/s/outreach/campaigns";
          announceNavigationStart(destination);
          router.push(destination);
        }}>Cancel</Btn>
        <p className="min-w-0 flex-1 text-xs text-ink-2" aria-live="polite">{notice ?? (!storageReady ? OUTREACH_DATABASE_UPDATE_ERROR : dirty ? "Unsaved template changes" : "All template changes saved")}</p>
        <Btn tone="primary" disabled={!canSave || pending} onClick={save}>{pending ? "Saving…" : campaign ? "Save template" : "Create campaign"}</Btn>
      </div>
    </div>
  );
}
