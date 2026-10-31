"use server";

import { revalidatePath } from "next/cache";
import { requireCoachWorkspace } from "./auth";
import { getCoachCollege } from "./coach-college";
import { createClient } from "./supabase/server";
import { createAdminClient } from "./supabase/admin";
import { listRoster } from "./coach-roster";
import { analyzeRoster, rosterEventStats } from "./coach-roster-analysis";
import { SWIMS_EVENT_IDS, type SwimsProspect } from "./swims";
import { queryProspectPool, CURRENT_SEASON_KEY } from "./recruit-pool-query";
import { resolveClassesFromCache } from "./class-resolver";
import { classInferenceDisplay, matchesClass, CLASS_CONFIDENCE_LABEL, type ClassInference } from "./class-inference";
import { rankProspects, type BandDirection } from "./recruit-fit";
import { recommendTarget, type TargetBasis } from "./recruit-targets";
import { profilesFor } from "./recruit-enrichment";
import { coverageFor } from "./recruit-coverage";
import {
  agesForGraduatingClass,
  clampPreferredRadius,
  clampRecruitScore,
  normalizeRecruitTimeDirection,
  CONFERENCE_PLACE_TOLERANCE,
  type RecruitTimeDirection,
} from "./recruit-controls";
import { conferencePlaceTargets } from "./conference-place";
import { clampConferencePlace, type ConferencePlaceTarget } from "./conference-place-defs";
import { nicheByKey } from "./niches";
import { buildSwimCloudResolverPath } from "./swimcloud-links";
import { performanceScore, performanceScoreToSeconds } from "./performance-points";
import { fmtClock } from "./time";
import { EVENT_ORDER } from "./events";
import { LSC_CODES } from "./swims-pool";
import type { EventCode, Gender } from "./types";

export type Campaign = {
  id: string;
  name: string;
  classYear: number;
  gender: Gender;
  status: "active" | "archived";
  collegeId: string | null;
  recruitCount: number;
};

type CampaignRow = {
  id: string;
  name: string;
  class_year: number;
  gender: Gender;
  status: "active" | "archived";
  college_id: string | null;
};

export async function listCampaigns(collegeId: string): Promise<Campaign[]> {
  const { membership } = await requireCoachWorkspace();
  const supabase = await createClient();
  const [{ data: campaigns }, { data: counts }] = await Promise.all([
    supabase
      .from("recruiting_campaigns")
      .select("id,name,class_year,gender,status,college_id")
      .eq("workspace_id", membership.workspaceId)
      .eq("college_id", collegeId)
      .order("class_year", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("campaign_recruits")
      .select("campaign_id")
      .eq("workspace_id", membership.workspaceId),
  ]);

  const countByCampaign = new Map<string, number>();
  for (const r of (counts ?? []) as { campaign_id: string }[]) {
    countByCampaign.set(r.campaign_id, (countByCampaign.get(r.campaign_id) ?? 0) + 1);
  }

  return ((campaigns ?? []) as CampaignRow[]).map((c) => ({
    id: c.id,
    name: c.name,
    classYear: c.class_year,
    gender: c.gender,
    status: c.status,
    collegeId: c.college_id,
    recruitCount: countByCampaign.get(c.id) ?? 0,
  }));
}

export async function getCampaign(id: string): Promise<Campaign | null> {
  const { membership } = await requireCoachWorkspace();
  const supabase = await createClient();
  const { data } = await supabase
    .from("recruiting_campaigns")
    .select("id,name,class_year,gender,status,college_id")
    .eq("id", id)
    .eq("workspace_id", membership.workspaceId)
    .maybeSingle();
  if (!data) return null;
  const c = data as CampaignRow;
  return {
    id: c.id,
    name: c.name,
    classYear: c.class_year,
    gender: c.gender,
    status: c.status,
    collegeId: c.college_id,
    recruitCount: 0,
  };
}

export async function createCampaign(input: {
  name: string;
  classYear: number;
  gender: Gender;
  collegeId: string;
}): Promise<{ ok: boolean; id: string | null; error: string | null }> {
  const { context, membership } = await requireCoachWorkspace();
  const name = input.name.trim();
  if (name.length < 1 || name.length > 120) return { ok: false, id: null, error: "Name your campaign." };
  if (!Number.isInteger(input.classYear) || input.classYear < 2000 || input.classYear > 2100) {
    return { ok: false, id: null, error: "Pick a valid class year." };
  }
  if (input.gender !== "M" && input.gender !== "F") return { ok: false, id: null, error: "Pick a squad." };

  const college = await getCoachCollege(membership, input.collegeId);
  if (!college) return { ok: false, id: null, error: "Pick one of your programs." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recruiting_campaigns")
    .insert({
      workspace_id: membership.workspaceId,
      college_id: input.collegeId,
      name,
      class_year: input.classYear,
      gender: input.gender,
      created_by: context.userId,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, id: null, error: "Could not create the campaign. Try again." };
  revalidatePath("/c/campaigns");
  return { ok: true, id: data.id, error: null };
}

export async function deleteCampaign(
  campaignId: string,
): Promise<{ ok: boolean; error: string | null }> {
  const { membership } = await requireCoachWorkspace();
  if (!/^[0-9a-f-]{36}$/i.test(campaignId)) return { ok: false, error: "Invalid campaign." };
  if (membership.role === "viewer") {
    return { ok: false, error: "You do not have permission to delete campaigns." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recruiting_campaigns")
    .delete()
    .eq("id", campaignId)
    .eq("workspace_id", membership.workspaceId)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: "The campaign could not be deleted. Try again." };
  if (!data) return { ok: false, error: "Campaign not found." };

  revalidatePath("/c/campaigns");
  revalidatePath(`/c/campaigns/${campaignId}`);
  return { ok: true, error: null };
}


export type RecruitHit = {
  memberId: string;
  fullName: string;
  lsc: string;
  club: string;
  clubCode: string | null;
  age: number | null;
  time: string;
  event: EventCode;
  abilityScore: number | null;
  abilityDelta: number | null;
  aboveThreshold: boolean;
  direction: BandDirection;
  bandScore: number;
  rankScore: number;
  rosterNeed: number;
  proximityMiles: number | null;
  classDisplay: string;
  classConfidence: ClassInference["confidence"];
  classConfidenceLabel: string;
  classRange: [number, number];
  swimcloudSearchUrl: string;
  placeMatch: { event: EventCode; delta: number | null } | null;
};

export type ConferencePlaceContext = {
  conferenceName: string | null;
  seasonLabel: string | null;
  place: number;
  targets: { event: EventCode; time: string; targetScore: number; fieldSize: number }[];
  unavailableEvents: EventCode[];
};

export type SearchContext = {
  targetScore: number;
  rosterMedian: number | null;
  rosterTop: number | null;
  rosterDepth: number;
  hasRoster: boolean;
  targetTime: string | null;
  targetBasis: TargetBasis;
};

export type SearchCoverage = {
  coveredToTime: string | null;
  coveredToSeconds: number | null;
  saturatedRegions: number;
  regionsCovered: number;
  targetBeyondCoverage: boolean;
  timeDirection: RecruitTimeDirection;
  lastSweptAt: string | null;
};

export type RecruitSearchResult = {
  ok: boolean;
  error: string | null;
  hits: RecruitHit[];
  context: SearchContext | null;
  coverage: SearchCoverage | null;
  conference: ConferencePlaceContext | null;
  consideredCount: number;
  matchedCount: number;
  returnedCount: number;
};

export async function searchRecruits(input: {
  campaignId: string;
  event?: EventCode;
  niche?: string;
  conferencePlace?: number;
  conferenceEvents?: EventCode[];
  targetScore: number;
  timeDirection?: RecruitTimeDirection;
  preferredRadiusMiles: number | null;
  lscCode?: string;
}): Promise<RecruitSearchResult> {
  const fail = (error: string | null): RecruitSearchResult => ({
    ok: error === null,
    error,
    hits: [],
    context: null,
    coverage: null,
    conference: null,
    consideredCount: 0,
    matchedCount: 0,
    returnedCount: 0,
  });

  const { membership } = await requireCoachWorkspace();
  const campaign = await getCampaign(input.campaignId);
  if (!campaign) return fail("Campaign not found.");
  const college = campaign.collegeId ? await getCoachCollege(membership, campaign.collegeId) : null;

  const conferenceMode = input.conferencePlace != null;
  let placeTargets: ConferencePlaceTarget[] = [];
  let conference: ConferencePlaceContext | null = null;
  let events: EventCode[];

  if (conferenceMode) {
    if (!college) return fail("Attach this campaign to one of your programs to search against its conference meet.");
    const requested = [...new Set(input.conferenceEvents ?? [])]
      .filter((event): event is EventCode => (EVENT_ORDER as readonly string[]).includes(event));
    if (requested.length === 0) return fail("Pick at least one conference event.");
    const place = clampConferencePlace(input.conferencePlace);
    try {
      placeTargets = (await conferencePlaceTargets({
        athleticProgramId: college.athleticProgramId,
        gender: campaign.gender,
        place,
        events: requested,
      })).filter((target) => target.targetScore != null);
    } catch {
      return fail("The conference championship times could not be read. Try again shortly.");
    }
    events = placeTargets.map((target) => target.event);
    conference = {
      conferenceName: placeTargets[0]?.conferenceName ?? null,
      seasonLabel: placeTargets[0]?.seasonLabel ?? null,
      place,
      targets: placeTargets.map((target) => ({
        event: target.event,
        time: target.time,
        targetScore: target.targetScore!,
        fieldSize: target.fieldSize,
      })),
      unavailableEvents: requested.filter((event) => !events.includes(event)),
    };
    if (events.length === 0) {
      return {
        ...fail(`No published result for this program's conference meet reached place ${place} in the events you picked.`),
        conference,
      };
    }
  } else {
    events = input.event ? [input.event] : (nicheByKey(input.niche ?? "")?.events ?? []);
    if (events.length === 0) return fail("Pick an event or niche.");
  }

  const roster = college ? analyzeRoster(await listRoster(college.id)) : null;
  const ages = agesForGraduatingClass(campaign.classYear);
  const requestedLsc = input.lscCode?.trim().toUpperCase() || null;
  if (requestedLsc && !(LSC_CODES as readonly string[]).includes(requestedLsc)) {
    return fail("Enter a valid USA Swimming LSC code.");
  }

  const minAge = Math.min(...ages);
  const maxAge = Math.max(...ages);
  const targetScore = clampRecruitScore(input.targetScore);
  const timeDirection = normalizeRecruitTimeDirection(input.timeDirection);
  const bestByMember = new Map<string, { prospect: SwimsProspect; event: EventCode; ability: number | null }>();

  const placeTargetFor = (event: EventCode) => placeTargets.find((target) => target.event === event) ?? null;
  const targetScoreFor = (event: EventCode) =>
    clampRecruitScore(placeTargetFor(event)?.targetScore ?? targetScore);
  const targetSecondsFor = (event: EventCode) =>
    placeTargetFor(event)?.seconds
      ?? performanceScoreToSeconds({ event, course: "SCY", points: targetScore }, campaign.gender);

  const excludedMemberIds = await ruledOutMemberIds(membership.workspaceId, campaign.id);

  const pools = await Promise.all(
    events
      .filter((event) => SWIMS_EVENT_IDS[event])
      .map(async (event) => ({
        event,
        pool: await queryProspectPool({
          gender: campaign.gender,
          event,
          seasonKey: CURRENT_SEASON_KEY,
          minAge,
          maxAge,
          lscCode: requestedLsc,
          targetSeconds: targetSecondsFor(event),
          timeDirection,
          excludeMemberIds: excludedMemberIds,
        }),
      })),
  );

  for (const { event, pool } of pools) {
    for (const p of pool) {
      const ability = p.seconds == null
        ? null
        : performanceScore({ event, course: "SCY", seconds: p.seconds }, campaign.gender)?.value ?? null;
      const prior = bestByMember.get(p.memberId);
      const better = !prior
        || (conferenceMode
          ? placeDistance(ability, targetScoreFor(event)) < placeDistance(prior.ability, targetScoreFor(prior.event))
          : (ability ?? -1) > (prior.ability ?? -1));
      if (better) bestByMember.set(p.memberId, { prospect: p, event, ability });
    }
  }

  const consideredCount = bestByMember.size;
  if (consideredCount === 0) {
    return {
      ...fail("The recruit pool for this event is still being gathered. Check back shortly."),
      consideredCount: 0,
    };
  }

  const memberIds = [...bestByMember.keys()];
  const [classes, profiles] = await Promise.all([
    resolveClassesFromCache(memberIds),
    profilesFor(memberIds),
  ]);

  const targets = events.map((event) => ({ event, targetScore: targetScoreFor(event) }));

  const hits: RecruitHit[] = [];
  for (const [memberId, { prospect, event }] of bestByMember) {
    const inference = classes.get(memberId);
    if (!inference || !matchesClass(inference, campaign.classYear)) continue;

    const [ranked] = rankProspects([prospect], {
      event,
      gender: campaign.gender,
      targetScore: targetScoreFor(event),
      targets: targets.length > 1 ? targets : undefined,
      bestOf: conferenceMode ? 1 : undefined,
      slowerTolerance: conferenceMode ? CONFERENCE_PLACE_TOLERANCE : undefined,
      fasterTolerance: conferenceMode ? CONFERENCE_PLACE_TOLERANCE : undefined,
      preferredRadiusMiles: clampPreferredRadius(input.preferredRadiusMiles),
      college: { latitude: college?.latitude ?? null, longitude: college?.longitude ?? null },
      roster,
    }, profiles);
    const leadMatch = conferenceMode
      ? [...ranked.matches].sort((left, right) => right.band - left.band)[0] ?? null
      : null;

    hits.push({
      memberId,
      fullName: prospect.fullName,
      lsc: prospect.lsc,
      club: prospect.club,
      clubCode: prospect.clubCode,
      age: prospect.age,
      time: prospect.time,
      event,
      abilityScore: ranked.abilityScore,
      abilityDelta: ranked.abilityDelta,
      aboveThreshold: ranked.aboveThreshold,
      direction: ranked.direction,
      bandScore: ranked.bandScore,
      rankScore: ranked.fit,
      rosterNeed: ranked.needBonus,
      proximityMiles: ranked.proximityMiles,
      classDisplay: classInferenceDisplay(inference),
      classConfidence: inference.confidence,
      classConfidenceLabel: CLASS_CONFIDENCE_LABEL[inference.confidence],
      classRange: inference.range,
      swimcloudSearchUrl: buildSwimCloudResolverPath({
        fullName: prospect.fullName,
        classYears: inference.range[0] === inference.range[1]
          ? [inference.range[0]]
          : [inference.range[0], inference.range[1]],
        lscCode: prospect.lsc,
      }),
      placeMatch: leadMatch ? { event: leadMatch.event, delta: leadMatch.delta } : null,
    });
  }

  hits.sort(conferenceMode
    ? (a, b) => b.rankScore - a.rankScore || placeGap(a) - placeGap(b)
    : (a, b) => b.rankScore - a.rankScore || (b.abilityScore ?? -1) - (a.abilityScore ?? -1));

  const primaryEvent = conferenceMode ? events[0] : input.event ?? events[0];
  const es = rosterEventStats(roster, primaryEvent);
  const recommended = recommendTarget(roster, primaryEvent, campaign.gender);
  const targetSeconds = targetSecondsFor(primaryEvent);
  const context: SearchContext = {
    targetScore: targetScoreFor(primaryEvent),
    rosterMedian: es?.medianScore ?? null,
    rosterTop: es?.topScore ?? null,
    rosterDepth: es?.scoredCount ?? 0,
    hasRoster: Boolean(roster && roster.scoredCount > 0),
    targetTime: targetSeconds == null ? null : fmtClock(targetSeconds),
    targetBasis: recommended.basis,
  };

  const coverage = await summarizeCoverage({
    event: primaryEvent,
    gender: campaign.gender,
    minAge,
    maxAge,
    lscCode: requestedLsc,
    targetSeconds,
    timeDirection,
  });

  const matchedCount = hits.length;
  const surfaced = hits.slice(0, 400);
  return {
    ok: true,
    error: null,
    hits: surfaced,
    context,
    coverage,
    conference,
    consideredCount,
    matchedCount,
    returnedCount: surfaced.length,
  };
}

function placeDistance(ability: number | null, target: number): number {
  return ability == null ? Number.POSITIVE_INFINITY : Math.abs(ability - target);
}

function placeGap(hit: RecruitHit): number {
  return hit.placeMatch?.delta == null ? Number.POSITIVE_INFINITY : Math.abs(hit.placeMatch.delta);
}


export type RuledOutRecruit = {
  memberId: string;
  fullName: string;
  lsc: string | null;
  club: string | null;
  bestEvent: string | null;
  bestTime: string | null;
  ruledOutAt: string;
};

type ExclusionRow = {
  member_id: string;
  full_name: string;
  lsc_code: string | null;
  club_name: string | null;
  best_event: string | null;
  best_time: string | null;
  created_at: string;
};

function normalizedMemberId(value: string): string | null {
  const memberId = value.trim().toUpperCase();
  return /^[A-Z0-9]{6,20}$/.test(memberId) ? memberId : null;
}

async function ruledOutMemberIds(workspaceId: string, campaignId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("campaign_recruit_exclusions")
    .select("member_id")
    .eq("workspace_id", workspaceId)
    .eq("campaign_id", campaignId);
  return ((data ?? []) as { member_id: string }[]).map((row) => row.member_id);
}

export async function listRuledOutRecruits(campaignId: string): Promise<RuledOutRecruit[]> {
  const { membership } = await requireCoachWorkspace();
  const campaign = await getCampaign(campaignId);
  if (!campaign) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("campaign_recruit_exclusions")
    .select("member_id,full_name,lsc_code,club_name,best_event,best_time,created_at")
    .eq("workspace_id", membership.workspaceId)
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false });
  return ((data ?? []) as ExclusionRow[]).map((row) => ({
    memberId: row.member_id,
    fullName: row.full_name,
    lsc: row.lsc_code,
    club: row.club_name,
    bestEvent: row.best_event,
    bestTime: row.best_time,
    ruledOutAt: row.created_at,
  }));
}

export async function ruleOutRecruit(input: {
  campaignId: string;
  memberId: string;
  fullName: string;
  lsc?: string | null;
  club?: string | null;
  bestEvent?: string | null;
  bestTime?: string | null;
}): Promise<{ ok: boolean; error: string | null }> {
  const { context, membership } = await requireCoachWorkspace();
  if (membership.role === "viewer") return { ok: false, error: "Your workspace role cannot change this campaign." };
  const campaign = await getCampaign(input.campaignId);
  if (!campaign) return { ok: false, error: "Campaign not found." };
  const memberId = normalizedMemberId(input.memberId);
  if (!memberId) return { ok: false, error: "Invalid USA Swimming member." };
  const fullName = input.fullName.trim().slice(0, 120);
  if (!fullName) return { ok: false, error: "This swimmer has no name to record." };

  const organizationCode = (value: string | null | undefined): string | null => {
    const normalized = value?.trim().toUpperCase() ?? "";
    return /^[A-Z0-9]{2,8}$/.test(normalized) ? normalized : null;
  };

  const supabase = await createClient();
  const { error } = await supabase
    .from("campaign_recruit_exclusions")
    .upsert({
      campaign_id: input.campaignId,
      workspace_id: membership.workspaceId,
      member_id: memberId,
      full_name: fullName,
      lsc_code: organizationCode(input.lsc),
      club_name: input.club?.trim().slice(0, 200) || null,
      best_event: input.bestEvent?.trim().slice(0, 40) || null,
      best_time: input.bestTime?.trim().slice(0, 20) || null,
      ruled_out_by: context.userId,
    }, { onConflict: "campaign_id,member_id" });
  if (error) return { ok: false, error: "Could not rule out this swimmer. Try again." };

  revalidatePath(`/c/campaigns/${input.campaignId}`);
  return { ok: true, error: null };
}

export async function restoreRuledOutRecruits(input: {
  campaignId: string;
  memberIds?: string[];
}): Promise<{ ok: boolean; restored: number; error: string | null }> {
  const { membership } = await requireCoachWorkspace();
  if (membership.role === "viewer") {
    return { ok: false, restored: 0, error: "Your workspace role cannot change this campaign." };
  }
  const campaign = await getCampaign(input.campaignId);
  if (!campaign) return { ok: false, restored: 0, error: "Campaign not found." };

  const supabase = await createClient();
  const query = supabase
    .from("campaign_recruit_exclusions")
    .delete()
    .eq("workspace_id", membership.workspaceId)
    .eq("campaign_id", input.campaignId);
  const scoped = input.memberIds == null
    ? query
    : query.in("member_id", input.memberIds.flatMap((value) => {
        const memberId = normalizedMemberId(value);
        return memberId ? [memberId] : [];
      }));
  const { data, error } = await scoped.select("member_id");
  if (error) return { ok: false, restored: 0, error: "Could not restore these swimmers. Try again." };

  revalidatePath(`/c/campaigns/${input.campaignId}`);
  return { ok: true, restored: ((data ?? []) as { member_id: string }[]).length, error: null };
}

async function summarizeCoverage(input: {
  event: EventCode;
  gender: Gender;
  minAge: number;
  maxAge: number;
  lscCode: string | null;
  targetSeconds: number | null;
  timeDirection: RecruitTimeDirection;
}): Promise<SearchCoverage | null> {
  const rows = await coverageFor({
    event: input.event,
    gender: input.gender,
    seasonKey: CURRENT_SEASON_KEY,
    minAge: input.minAge,
    maxAge: input.maxAge,
    lscCode: input.lscCode,
  });
  if (rows.length === 0) return null;

  const depths = rows
    .map((row) => (row.covered_to_seconds == null ? null : Number(row.covered_to_seconds)))
    .filter((value): value is number => value != null);
  const shallowest = depths.length === rows.length && depths.length > 0 ? Math.min(...depths) : null;
  const sweeps = rows.map((row) => row.swept_at).filter((value): value is string => Boolean(value)).sort();

  return {
    coveredToTime: shallowest == null ? null : fmtClock(shallowest),
    coveredToSeconds: shallowest,
    saturatedRegions: rows.filter((row) => row.saturated).length,
    regionsCovered: rows.length,
    targetBeyondCoverage: shallowest != null && input.targetSeconds != null
      ? input.timeDirection === "slower" || input.targetSeconds > shallowest
      : false,
    timeDirection: input.timeDirection,
    lastSweptAt: sweeps[0] ?? null,
  };
}


export async function addRecruitToCampaign(input: {
  campaignId: string;
  memberId: string;
  fullName: string;
  classRange: [number, number];
  classConfidence: ClassInference["confidence"];
  lsc?: string | null;
  club?: string | null;
  clubCode?: string | null;
  bestEvent?: string | null;
  bestTime?: string | null;
  swimcloudUrl?: string | null;
}): Promise<{ ok: boolean; error: string | null }> {
  const { context, membership } = await requireCoachWorkspace();
  const campaign = await getCampaign(input.campaignId);
  if (!campaign) return { ok: false, error: "Campaign not found." };
  if (membership.role === "viewer") {
    return { ok: false, error: "Your workspace role cannot add recruits." };
  }
  const memberId = input.memberId.trim().toUpperCase();
  if (!/^[A-Z0-9]{6,20}$/.test(memberId)) return { ok: false, error: "Invalid USA Swimming member." };
  const admin = createAdminClient();
  const { data: trustedRows, error: trustedError } = await admin
    .from("recruit_prospects")
    .select("member_id,full_name,lsc_code,club_name,club_code,ingested_at")
    .eq("member_id", memberId)
    .eq("gender", campaign.gender)
    .order("ingested_at", { ascending: false })
    .limit(1);
  const trusted = (trustedRows?.[0] ?? null) as {
    member_id: string;
    full_name: string;
    lsc_code: string | null;
    club_name: string | null;
    club_code: string | null;
    ingested_at: string;
  } | null;
  if (trustedError || !trusted || trusted.member_id.trim().toUpperCase() !== memberId) {
    return { ok: false, error: "This swimmer is no longer present in the verified recruiting pool. Refresh search and try again." };
  }
  const exactOrganizationCode = (value: string | null): string | null => {
    const normalized = value?.trim().toUpperCase() ?? "";
    return /^[A-Z0-9]{2,8}$/.test(normalized) ? normalized : null;
  };
  const trustedLscCode = exactOrganizationCode(trusted.lsc_code);
  const trustedClubCode = exactOrganizationCode(trusted.club_code);
  const trustedInference = (await resolveClassesFromCache([memberId])).get(memberId);
  if (!trustedInference || !matchesClass(trustedInference, campaign.classYear)) {
    return { ok: false, error: "That swimmer is no longer a verified class match for this campaign. Refresh search and try again." };
  }
  const [classMin, classMax] = trustedInference.range;
  const confirmedClass = trustedInference.confidence === "exact" && classMin === classMax
    ? classMin
    : null;
  const verifiedAt = Number.isFinite(Date.parse(trusted.ingested_at))
    ? new Date(trusted.ingested_at)
    : new Date();
  const assertionExpiresAt = new Date(Math.max(Date.now(), verifiedAt.getTime()) + 366 * 24 * 60 * 60 * 1000);
  const recruitRow = {
    campaign_id: input.campaignId,
    workspace_id: membership.workspaceId,
    swims_member_id: memberId,
    full_name: trusted.full_name.trim().slice(0, 120),
    gender: campaign.gender,
    class_year: confirmedClass,
    class_year_min: classMin,
    class_year_max: classMax,
    class_confidence: trustedInference.confidence,
    lsc_code: trustedLscCode,
    club_name: trusted.club_name,
    best_event: input.bestEvent ?? null,
    best_time: input.bestTime ?? null,
    swimcloud_url: input.swimcloudUrl ?? null,
    bucket: "ledger",
    added_by: context.userId,
  };
  const { data: inserted, error: insertError } = await admin
    .from("campaign_recruits")
    .insert(recruitRow)
    .select("id")
    .single();
  if (insertError || typeof inserted?.id !== "string") {
    if (insertError && (insertError.code === "23505" || /duplicate|unique/i.test(insertError.message))) {
      return { ok: false, error: "Already in this campaign." };
    }
    if (insertError) console.error("Unable to add recruit", insertError.code);
    return { ok: false, error: "Could not add the recruit. Try again." };
  }
  const insertedId = inserted.id;

  const { error: identityError } = await admin.from("recruit_contact_identity_assertions").insert({
    recruit_id: insertedId,
    workspace_id: membership.workspaceId,
    member_id: memberId,
    lsc_code: trustedLscCode,
    club_code: trustedClubCode,
    source_type: "verified_recruit_pool",
    source_record_id: `recruit_prospects:${memberId}`,
    verified_at: verifiedAt.toISOString(),
    expires_at: assertionExpiresAt.toISOString(),
  });
  if (identityError) console.error("Unable to add recruit contact identity assertion", identityError.code);

  const supabase = await createClient();
  const { data: prospects } = await admin
    .from("recruit_prospects")
    .select("event,seconds,swim_time,swim_date")
    .eq("member_id", memberId)
    .eq("gender", campaign.gender)
    .eq("season_key", CURRENT_SEASON_KEY);
  const snapshots = ((prospects ?? []) as { event: string; seconds: number; swim_time: string; swim_date: string | null }[]).map((p) => ({
    recruit_id: insertedId,
    workspace_id: membership.workspaceId,
    event: p.event,
    course: "SCY",
    seconds: p.seconds,
    swim_time: p.swim_time,
    swim_date: p.swim_date,
    source: "pool",
  }));
  if (snapshots.length > 0) {
    await supabase.from("recruit_time_snapshots").upsert(snapshots, { onConflict: "recruit_id,event,course,seconds", ignoreDuplicates: true });
  }

  revalidatePath(`/c/campaigns/${input.campaignId}`);
  return { ok: true, error: null };
}
