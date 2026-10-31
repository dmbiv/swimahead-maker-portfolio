"use client";

import * as FormControl from "@/components/form-control";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  searchRecruits,
  addRecruitToCampaign,
  ruleOutRecruit,
  restoreRuledOutRecruits,
  type ConferencePlaceContext,
  type RecruitHit,
  type RuledOutRecruit,
  type SearchCoverage,
} from "@/lib/campaign-actions";
import type { BandDirection } from "@/lib/recruit-fit";
import { NICHES } from "@/lib/niches";
import { EVENT_LABELS, EVENT_ORDER } from "@/lib/events";
import {
  DEFAULT_RADIUS_MILES,
  DEFAULT_RECRUIT_SCORE,
  proximityWeightFor,
  RADIUS_MAX_MILES,
  RADIUS_MIN_MILES,
  RADIUS_STEP_MILES,
  RECRUIT_SCORE_MAX,
  RECRUIT_SCORE_MIN,
  RECRUIT_SCORE_STEP,
  type RecruitTimeDirection,
} from "@/lib/recruit-controls";
import {
  CONFERENCE_PLACE_MAX,
  DEFAULT_CONFERENCE_PLACE,
  type ConferenceMeetCoverage,
} from "@/lib/conference-place-defs";
import { performanceScoreToSeconds } from "@/lib/performance-points";
import { fmtClock } from "@/lib/time";
import type { EventCode, Gender } from "@/lib/types";
import { LSC_GEO } from "@/lib/lsc-geo";
import { LSC_CODES } from "@/lib/swims-pool";

type Mode = "event" | "niche" | "conference";

const CONFIDENCE_STYLE: Record<RecruitHit["classConfidence"], string> = {
  exact: "bg-[color-mix(in_srgb,var(--accent)_18%,transparent)] text-[var(--accent-2)]",
  high: "bg-[var(--sunken)] text-ink-2",
  estimated: "bg-[var(--sunken)] text-ink-3",
};

const ORDINALS = ["", "1st", "2nd", "3rd"];

function ordinal(place: number): string {
  return ORDINALS[place] ?? `${place}th`;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function RecruitSearch({
  campaignId,
  classYear,
  gender,
  hasDistance,
  collegeId,
  rosterMedians,
  rosterScoredCount,
  conferenceMeet,
  initialRuledOut,
}: {
  campaignId: string;
  classYear: number;
  gender: Gender;
  hasDistance: boolean;
  collegeId: string | null;
  rosterMedians: Partial<Record<EventCode, number>>;
  rosterScoredCount: number;
  conferenceMeet: ConferenceMeetCoverage | null;
  initialRuledOut: RuledOutRecruit[];
}) {
  const router = useRouter();
  const conferenceEventOptions = conferenceMeet?.events ?? [];
  const conferenceAvailable = conferenceEventOptions.length > 0;
  const deepestField = Math.min(
    CONFERENCE_PLACE_MAX,
    Math.max(1, ...conferenceEventOptions.map((option) => option.fieldSize)),
  );

  const [mode, setMode] = useState<Mode>("event");
  const [event, setEvent] = useState<EventCode>("100FR");
  const [niche, setNiche] = useState(NICHES[0].key);
  const [conferencePlace, setConferencePlace] = useState(
    Math.min(DEFAULT_CONFERENCE_PLACE, deepestField),
  );
  const [conferenceEvents, setConferenceEvents] = useState<EventCode[]>(
    conferenceEventOptions[0] ? [conferenceEventOptions[0].event] : [],
  );
  const [targetScore, setTargetScore] = useState(rosterMedians["100FR"] ?? DEFAULT_RECRUIT_SCORE);
  const [timeDirection, setTimeDirection] = useState<RecruitTimeDirection>("around");
  const [radiusMiles, setRadiusMiles] = useState(DEFAULT_RADIUS_MILES);
  const [lsc, setLsc] = useState("");
  const [hits, setHits] = useState<RecruitHit[] | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [coverage, setCoverage] = useState<SearchCoverage | null>(null);
  const [conference, setConference] = useState<ConferencePlaceContext | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [ruledOut, setRuledOut] = useState<RuledOutRecruit[]>(initialRuledOut);
  const [showRuledOut, setShowRuledOut] = useState(false);
  const [ruledOutMsg, setRuledOutMsg] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(50);
  const [busy, start] = useTransition();

  const selectedNiche = NICHES.find((item) => item.key === niche) ?? NICHES[0];
  const selectedEvents = mode === "event"
    ? [event]
    : mode === "niche" ? selectedNiche.events : conferenceEvents;
  const currentRosterMedians = selectedEvents
    .map((eventCode) => rosterMedians[eventCode])
    .filter((value): value is number => value != null);
  const rosterMedian = mode === "event" ? rosterMedians[event] ?? null : average(currentRosterMedians);
  const preferredRadiusMiles = hasDistance && radiusMiles < RADIUS_MAX_MILES ? radiusMiles : null;

  const primaryEvent = mode === "event" ? event : selectedEvents[0] ?? selectedNiche.events[0];
  const targetSeconds = performanceScoreToSeconds(
    { event: primaryEvent, course: "SCY", points: targetScore },
    gender,
  );
  const liveTargetTime = targetSeconds == null ? null : fmtClock(targetSeconds);
  const distanceShare = Math.round(proximityWeightFor(preferredRadiusMiles) * 100);

  function chooseEvent(nextEvent: EventCode) {
    setEvent(nextEvent);
    setTargetScore(rosterMedians[nextEvent] ?? DEFAULT_RECRUIT_SCORE);
  }

  function chooseNiche(nextNiche: string) {
    setNiche(nextNiche);
    const definition = NICHES.find((item) => item.key === nextNiche);
    const medians = definition?.events
      .map((eventCode) => rosterMedians[eventCode])
      .filter((value): value is number => value != null) ?? [];
    setTargetScore(average(medians) ?? DEFAULT_RECRUIT_SCORE);
  }

  function chooseMode(nextMode: Mode) {
    setMode(nextMode);
    if (nextMode === "event") {
      setTargetScore(rosterMedians[event] ?? DEFAULT_RECRUIT_SCORE);
    } else if (nextMode === "niche") {
      const medians = selectedNiche.events
        .map((eventCode) => rosterMedians[eventCode])
        .filter((value): value is number => value != null);
      setTargetScore(average(medians) ?? DEFAULT_RECRUIT_SCORE);
    }
  }

  function toggleConferenceEvent(eventCode: EventCode) {
    setConferenceEvents((previous) => previous.includes(eventCode)
      ? previous.filter((selected) => selected !== eventCode)
      : [...previous, eventCode]);
  }

  function run() {
    setMsg(null);
    setHits(null);
    setSummary(null);
    setCoverage(null);
    setConference(null);
    setVisibleCount(50);
    start(async () => {
      const res = await searchRecruits({
        campaignId,
        event: mode === "event" ? event : undefined,
        niche: mode === "niche" ? niche : undefined,
        conferencePlace: mode === "conference" ? conferencePlace : undefined,
        conferenceEvents: mode === "conference" ? conferenceEvents : undefined,
        targetScore,
        timeDirection,
        preferredRadiusMiles,
        lscCode: lsc || undefined,
      });
      setConference(res.conference);
      if (!res.ok) {
        setMsg(res.error);
        return;
      }
      setHits(res.hits);
      setCoverage(res.coverage);
      const showing = res.returnedCount < res.matchedCount ? ` Showing the top ${res.returnedCount}.` : "";
      setSummary(
        `${res.matchedCount} possible class of ${classYear} ${res.matchedCount === 1 ? "match" : "matches"} ` +
          `from ${res.consideredCount} ranked swimmers.${showing}`,
      );
      if (res.hits.length === 0) {
        setMsg("No class matches were found in this pool. Clear the LSC filter or try another event.");
      }
    });
  }

  function clearResults() {
    setHits(null);
    setSummary(null);
    setCoverage(null);
    setConference(null);
    setMsg(null);
    setVisibleCount(50);
  }

  function add(hit: RecruitHit) {
    start(async () => {
      const res = await addRecruitToCampaign({
        campaignId,
        memberId: hit.memberId,
        fullName: hit.fullName,
        classRange: hit.classRange,
        classConfidence: hit.classConfidence,
        lsc: hit.lsc,
        club: hit.club,
        clubCode: hit.clubCode,
        bestEvent: EVENT_LABELS[hit.event],
        bestTime: hit.time,
      });
      if (res.ok) {
        setAdded((previous) => new Set(previous).add(hit.memberId));
        router.refresh();
      } else {
        setMsg(res.error);
        if (/already/i.test(res.error ?? "")) setAdded((previous) => new Set(previous).add(hit.memberId));
      }
    });
  }

  function ruleOut(hit: RecruitHit) {
    setMsg(null);
    const index = hits?.findIndex((row) => row.memberId === hit.memberId) ?? -1;
    setHits((previous) => previous?.filter((row) => row.memberId !== hit.memberId) ?? previous);
    setRuledOut((previous) => [
      {
        memberId: hit.memberId,
        fullName: hit.fullName,
        lsc: hit.lsc || null,
        club: hit.club || null,
        bestEvent: EVENT_LABELS[hit.event],
        bestTime: hit.time,
        ruledOutAt: new Date().toISOString(),
      },
      ...previous.filter((row) => row.memberId !== hit.memberId),
    ]);
    start(async () => {
      const res = await ruleOutRecruit({
        campaignId,
        memberId: hit.memberId,
        fullName: hit.fullName,
        lsc: hit.lsc,
        club: hit.club,
        bestEvent: EVENT_LABELS[hit.event],
        bestTime: hit.time,
      });
      if (res.ok) return;
      setMsg(res.error);
      setRuledOut((previous) => previous.filter((row) => row.memberId !== hit.memberId));
      setHits((previous) => {
        if (!previous || previous.some((row) => row.memberId === hit.memberId)) return previous;
        const restored = [...previous];
        restored.splice(index < 0 ? restored.length : index, 0, hit);
        return restored;
      });
    });
  }

  function restore(memberIds?: string[]) {
    setRuledOutMsg(null);
    const previousRuledOut = ruledOut;
    setRuledOut(memberIds == null
      ? []
      : previousRuledOut.filter((row) => !memberIds.includes(row.memberId)));
    start(async () => {
      const res = await restoreRuledOutRecruits({ campaignId, memberIds });
      if (res.ok) {
        setRuledOutMsg(
          `${res.restored} ${res.restored === 1 ? "swimmer is" : "swimmers are"} back in the pool. Run the search again to see them.`,
        );
        return;
      }
      setRuledOut(previousRuledOut);
      setRuledOutMsg(res.error);
    });
  }

  const canSearch = mode !== "conference" || conferenceEvents.length > 0;

  return (
    <div className="space-y-3">
      <div className="wr-card space-y-5 p-4">
        <div className="recruit-filter-toolbar">
          <div className="recruit-filter-group recruit-filter-group--mode">
            <span className="wr-field-label block">Search by</span>
            <div className="segmented-control" role="group" aria-label="Search target type">
              <button type="button" aria-pressed={mode === "event"} onClick={() => chooseMode("event")}>Event</button>
              <button type="button" aria-pressed={mode === "niche"} onClick={() => chooseMode("niche")}>Niche</button>
              {conferenceAvailable ? (
                <button type="button" aria-pressed={mode === "conference"} onClick={() => chooseMode("conference")}>Conference</button>
              ) : null}
            </div>
          </div>

          {mode === "event" ? (
            <label className="recruit-filter-group recruit-filter-group--target">
              <span className="wr-field-label block">Event</span>
              <FormControl.Select className="wr-control" value={event} onChange={(change) => chooseEvent(change.target.value as EventCode)}>
                {EVENT_ORDER.map((eventCode) => <option key={eventCode} value={eventCode}>{EVENT_LABELS[eventCode]}</option>)}
              </FormControl.Select>
            </label>
          ) : mode === "niche" ? (
            <label className="recruit-filter-group recruit-filter-group--target">
              <span className="wr-field-label block">Niche</span>
              <FormControl.Select className="wr-control" value={niche} onChange={(change) => chooseNiche(change.target.value)}>
                {NICHES.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
              </FormControl.Select>
            </label>
          ) : (
            <label className="recruit-filter-group recruit-filter-group--target">
              <span className="wr-field-label block">Would place</span>
              <FormControl.Select
                className="wr-control"
                value={conferencePlace}
                onChange={(change) => setConferencePlace(Number(change.target.value))}
              >
                {Array.from({ length: deepestField }, (_, index) => index + 1).map((place) => (
                  <option key={place} value={place}>Top {place}</option>
                ))}
              </FormControl.Select>
            </label>
          )}

          <label className="recruit-filter-group recruit-filter-group--region">
            <span className="wr-field-label block">USA Swimming region</span>
            <FormControl.Select className="wr-control" value={lsc} onChange={(change) => setLsc(change.target.value)}>
              <option value="">All regions</option>
              {LSC_CODES.map((code) => (
                <option key={code} value={code}>{LSC_GEO[code]?.name ?? code} ({code})</option>
              ))}
            </FormControl.Select>
          </label>

          <div className="recruit-filter-group recruit-filter-group--direction">
            <span className="wr-field-label block">Result times</span>
            <div className="segmented-control recruit-direction-control" role="group" aria-label="Result time direction">
              {(["around", "faster", "slower"] as const).map((direction) => (
                <button
                  key={direction}
                  type="button"
                  aria-pressed={timeDirection === direction}
                  title={direction === "around" ? (mode === "conference" ? "Closest to the place time" : "Closest to the recruiting bar") : undefined}
                  onClick={() => setTimeDirection(direction)}
                >
                  {direction === "around" ? "Near" : direction === "faster" ? "Faster" : "Slower"}
                </button>
              ))}
            </div>
          </div>

          <div className="recruit-filter-actions">
            <button type="button" className="wr-btn wr-btn--primary" disabled={busy || !canSearch} onClick={run}>
              {busy ? "Searching..." : "Find recruits"}
            </button>
            <button
              type="button"
              className="wr-btn wr-btn--neutral"
              disabled={busy || (hits == null && summary == null && coverage == null && msg == null)}
              onClick={clearResults}
            >
              Clear
            </button>
          </div>
        </div>

        {mode === "conference" ? (
          <div className="recruit-filter-subpanel space-y-3">
            <div>
              <span className="wr-field-label block">Events at the conference meet</span>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {conferenceEventOptions.map((option) => {
                  const selected = conferenceEvents.includes(option.event);
                  return (
                    <button
                      key={option.event}
                      type="button"
                      onClick={() => toggleConferenceEvent(option.event)}
                      aria-pressed={selected}
                      title={`${option.fieldSize} recorded finishers`}
                      className="recruit-filter-chip"
                    >
                      {EVENT_LABELS[option.event]}
                    </button>
                  );
                })}
              </div>
            </div>
            <p className="text-xs text-ink-2">
              {conferenceEvents.length === 0
                ? "Pick at least one event."
                : `Using the published ${ordinal(conferencePlace)}-place ${conferenceEvents.length === 1 ? "time" : "times"} at ` +
                  `${conferenceMeet?.conferenceName ?? "your conference"}${conferenceMeet?.seasonLabel ? ` (${conferenceMeet.seasonLabel})` : ""}; closest matches rank first.`}
            </p>
            {conference && conference.targets.length > 0 ? (
              <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-[var(--line)] pt-2 text-xs text-ink-2">
                {conference.targets.map((target) => (
                  <span key={target.event} className="tabular-nums">
                    <span className="text-ink-3">{EVENT_LABELS[target.event]}</span> {target.time}
                  </span>
                ))}
              </div>
            ) : null}
            {conference && conference.unavailableEvents.length > 0 ? (
              <p className="text-xs text-ink-3">
                No {ordinal(conference.place)} place result is published for{" "}
                {conference.unavailableEvents.map((eventCode) => EVENT_LABELS[eventCode]).join(", ")}, so{" "}
                {conference.unavailableEvents.length === 1 ? "it was" : "they were"} left out of this search.
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          {mode === "conference" ? null : (
            <label className="wr-slider-card">
              <span className="flex items-start justify-between gap-3">
                <span>
                  <span className="wr-field-label block">Recruiting bar</span>
                  <span className="mt-1 block text-xs text-ink-3">College Index target for this search</span>
                </span>
                <output className="wr-slider-value tabular-nums">
                  {targetScore}
                  {liveTargetTime ? (
                    <span className="ml-2 text-xs font-normal text-ink-3">
                      {liveTargetTime} {EVENT_LABELS[primaryEvent]}
                    </span>
                  ) : null}
                </output>
              </span>
              <FormControl.Input
                type="range"
                min={RECRUIT_SCORE_MIN}
                max={RECRUIT_SCORE_MAX}
                step={RECRUIT_SCORE_STEP}
                value={targetScore}
                onChange={(change) => setTargetScore(Number(change.target.value))}
                className="wr-range mt-3 w-full"
              />
              <span className="mt-2 block text-xs text-ink-2">
                {rosterMedian != null
                  ? `Your roster median${mode === "event" ? ` in ${EVENT_LABELS[event]}` : " across this niche"} is ${rosterMedian}.`
                  : "No scored roster median is available here yet. The default 700 bar is a neutral starting point."}
                {" "}This bar affects recruit priority ranking, specific to your institution.
              </span>
            </label>
          )}

          <label className={`wr-slider-card ${hasDistance ? "" : "opacity-60"}`}>
            <span className="flex items-start justify-between gap-3">
              <span>
                <span className="wr-field-label block">Preferred radius</span>
                <span className="mt-1 block text-xs text-ink-3">Approximate distance from campus</span>
              </span>
              <output className="wr-slider-value tabular-nums">
                {!hasDistance ? "Unavailable" : radiusMiles >= RADIUS_MAX_MILES ? "National" : `${radiusMiles.toLocaleString("en-US")} mi`}
              </output>
            </span>
            <FormControl.Input
              type="range"
              min={RADIUS_MIN_MILES}
              max={RADIUS_MAX_MILES}
              step={RADIUS_STEP_MILES}
              value={radiusMiles}
              disabled={!hasDistance}
              onChange={(change) => setRadiusMiles(Number(change.target.value))}
              className="wr-range mt-3 w-full"
            />
            <span className="mt-2 block text-xs text-ink-2">
              {!hasDistance
                ? "This program does not have campus coordinates, so distance cannot affect ranking."
                : preferredRadiusMiles == null
                  ? "Distance is switched off at National, so recruits rank on ability and roster need alone."
                  : `Distance is currently ${distanceShare} percent of the ranking. Pull the radius in to make it matter more.`
                    + " Swimmers outside the radius are still shown, ranked lower. Distance uses the center of each USA Swimming LSC."}
            </span>
          </label>
        </div>

        <div className="rounded-md border border-[var(--line)] bg-[var(--sunken)] px-3 py-2 text-xs text-ink-2">
          {mode === "conference" ? (
            <p>
              <strong className="text-ink-1">How ranking works:</strong> nearness to the place time leads, then roster gap, then distance
              from campus at the share the radius slider sets. Swimmers wide of the time in either direction stay in the list, ranked lower.
            </p>
          ) : rosterScoredCount > 0 ? (
            <p>
              <strong className="text-ink-1">How ranking works:</strong> College Index against your bar leads, then roster gap, then distance from
              campus at the share the radius slider sets. All plausible class matches remain in the results.
            </p>
          ) : (
            <p>
              <strong className="text-ink-1">Roster fit is off:</strong> results are ranked by College Index and distance until scored roster times exist.{" "}
              <a href={collegeId ? `/c/roster?college=${collegeId}` : "/c/roster"} className="underline underline-offset-2">Import the roster</a> to turn on gap-aware ranking.
            </p>
          )}
        </div>

        <RuledOutPanel
          ruledOut={ruledOut}
          open={showRuledOut}
          busy={busy}
          message={ruledOutMsg}
          onToggle={() => setShowRuledOut((open) => !open)}
          onRestore={restore}
        />
      </div>

      {summary ? <p className="text-sm text-ink-2">{summary}</p> : null}
      {coverage ? <p className="text-sm text-ink-3">{coverageSentence(coverage)}</p> : null}
      {msg ? <p className="text-sm text-ink-2">{msg}</p> : null}

      {hits && hits.length > 0 ? (
        <div className="wr-card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--line)] text-left text-xs text-ink-3">
                <th className="px-3 py-2 font-normal">Rank</th>
                <th className="px-3 py-2 font-normal">Swimmer</th>
                <th className="px-3 py-2 font-normal">Class</th>
                <th className="px-3 py-2 font-normal">Best in search</th>
                <th className="px-3 py-2 font-normal">College Index</th>
                <th className="px-3 py-2 font-normal">Why here</th>
                <th className="px-3 py-2 font-normal">LSC</th>
                {hasDistance ? <th className="px-3 py-2 font-normal">Approx. miles</th> : null}
                <th className="px-3 py-2 font-normal" />
              </tr>
            </thead>
            <tbody>
              {hits.slice(0, visibleCount).map((hit, index) => (
                <tr key={hit.memberId} className="border-b border-[var(--line)] last:border-0">
                  <td className="px-3 py-2 tabular-nums text-ink-3">{index + 1}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{hit.fullName}</div>
                    {hit.club ? <div className="text-xs text-ink-3">{hit.club}</div> : null}
                  </td>
                  <td className="px-3 py-2">
                    <span className="whitespace-nowrap tabular-nums">{hit.classDisplay}</span>
                    <span className={`ml-1 rounded px-1.5 py-0.5 text-[10px] ${CONFIDENCE_STYLE[hit.classConfidence]}`}>{hit.classConfidenceLabel}</span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                    {EVENT_LABELS[hit.event]} {hit.time}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-ink-2">{hit.abilityScore ?? "Not scored"}</td>
                  <td className="px-3 py-2 text-xs text-ink-2">
                    <div className={DIRECTION_STYLE[hit.direction]}>
                      {hit.placeMatch && conference
                        ? placeComparison(hit, conference.place)
                        : abilityComparison(hit.abilityDelta, hit.direction)}
                    </div>
                    {rosterScoredCount > 0 ? <div className="text-ink-3">{needLabel(hit.rosterNeed)}</div> : null}
                  </td>
                  <td className="px-3 py-2 text-ink-2">{hit.lsc || "Unknown"}</td>
                  {hasDistance ? (
                    <td className="px-3 py-2 tabular-nums text-ink-3">
                      {hit.proximityMiles != null ? Math.round(hit.proximityMiles).toLocaleString("en-US") : "Unknown"}
                    </td>
                  ) : null}
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1.5">
                      <a href={hit.swimcloudSearchUrl} target="_blank" rel="noreferrer" className="wr-btn wr-btn--neutral wr-btn--small">
                        <span>SwimCloud</span><span aria-hidden>↗</span>
                      </a>
                      <button
                        type="button"
                        className="wr-btn wr-btn--neutral wr-btn--small"
                        disabled={busy || added.has(hit.memberId)}
                        onClick={() => add(hit)}
                      >
                        {added.has(hit.memberId) ? "Added" : "Add"}
                      </button>
                      <button
                        type="button"
                        className="wr-btn wr-btn--neutral wr-btn--small"
                        title="Hide this swimmer from every future search in this campaign"
                        onClick={() => ruleOut(hit)}
                      >
                        Rule out
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {visibleCount < hits.length ? (
            <div className="border-t border-[var(--line)] p-3 text-center">
              <button type="button" className="wr-btn wr-btn--neutral" onClick={() => setVisibleCount((count) => count + 50)}>
                Show 50 more
              </button>
            </div>
          ) : null}
          <p className="border-t border-[var(--line)] px-3 py-2 text-[11px] text-ink-3">
            A two-year class label is intentionally unresolved. It means USA Swimming age history supports both years. The app stores that range until a later sighting confirms one year.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function RuledOutPanel({
  ruledOut,
  open,
  busy,
  message,
  onToggle,
  onRestore,
}: {
  ruledOut: RuledOutRecruit[];
  open: boolean;
  busy: boolean;
  message: string | null;
  onToggle: () => void;
  onRestore: (memberIds?: string[]) => void;
}) {
  if (ruledOut.length === 0 && !message) return null;

  return (
    <div className="border-t border-[var(--line)] pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="text-xs text-ink-2 underline underline-offset-2" onClick={onToggle}>
          {open ? "Hide" : "Show"} ruled out ({ruledOut.length})
        </button>
        {open && ruledOut.length > 0 ? (
          <button type="button" className="wr-btn wr-btn--neutral wr-btn--small" disabled={busy} onClick={() => onRestore()}>
            Restore all
          </button>
        ) : null}
        {message ? <span className="text-xs text-ink-3">{message}</span> : null}
      </div>
      {open ? (
        ruledOut.length > 0 ? (
          <ul className="mt-2 divide-y divide-[var(--line)] border-t border-[var(--line)]">
            {ruledOut.map((row) => (
              <li key={row.memberId} className="flex items-center justify-between gap-3 py-1.5 text-sm">
                <span className="min-w-0">
                  <span className="font-medium">{row.fullName}</span>
                  <span className="ml-2 text-xs text-ink-3 tabular-nums">
                    {[row.club, row.lsc, row.bestEvent && row.bestTime ? `${row.bestEvent} ${row.bestTime}` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <button
                  type="button"
                  className="wr-btn wr-btn--neutral wr-btn--small shrink-0"
                  disabled={busy}
                  onClick={() => onRestore([row.memberId])}
                >
                  Restore
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-ink-3">Nobody is ruled out of this campaign.</p>
        )
      ) : null}
    </div>
  );
}

function coverageSentence(coverage: SearchCoverage): string {
  const regions = `${coverage.regionsCovered} ${coverage.regionsCovered === 1 ? "region" : "regions"}`;
  if (coverage.coveredToTime == null) {
    return `Coverage for ${regions} is still being gathered, so this list may be incomplete.`;
  }
  const base = `Complete to ${coverage.coveredToTime} across ${regions}.`;
  const beyond = coverage.targetBeyondCoverage
    ? coverage.timeDirection === "slower"
      ? " A slower-only search extends beyond that proven depth, so slower swimmers may still be missing."
      : " Your bar is slower than that, so swimmers below it may still be missing; a deeper sweep is queued."
    : "";
  const saturated = coverage.saturatedRegions > 0
    ? ` ${coverage.saturatedRegions} ${coverage.saturatedRegions === 1 ? "region" : "regions"} hit the upstream row cap on a busy meet day and may be short a few names.`
    : "";
  return `${base}${beyond}${saturated}`;
}

const DIRECTION_STYLE: Record<BandDirection, string> = {
  in_band: "text-[var(--good)]",
  above_band: "text-ink-3",
  below_band: "text-ink-2",
};

function abilityComparison(delta: number | null, direction: BandDirection): string {
  if (delta == null) return "No comparable score";
  if (direction === "above_band") return `${delta} above bar, likely out of reach`;
  if (direction === "below_band") return `${Math.abs(delta)} below bar`;
  if (delta === 0) return "At recruiting bar";
  return delta > 0 ? `${delta} above bar, in range` : `${Math.abs(delta)} below bar, in range`;
}

function placeComparison(hit: RecruitHit, place: number): string {
  const match = hit.placeMatch;
  if (!match || match.delta == null) return "No comparable time in these events";
  const event = EVENT_LABELS[match.event];
  if (match.delta === 0) return `On the ${ordinal(place)} place time in ${event}`;
  return match.delta > 0
    ? `${match.delta} inside the ${ordinal(place)} place time in ${event}`
    : `${Math.abs(match.delta)} outside the ${ordinal(place)} place time in ${event}`;
}

function needLabel(need: number): string {
  if (need >= 0.75) return "High roster need";
  if (need >= 0.5) return "Some roster need";
  return "Roster has depth";
}
