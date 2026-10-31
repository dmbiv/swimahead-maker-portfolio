import { EVENT_GROUPS, canonicalEvent } from "./events";
import { parsePastedTimes } from "./paste";
import {
  classYearForStanding,
  currentSeasonEndYear,
  type RosterClassStanding,
} from "./roster-season";
import type { Course } from "./types";

export type { RosterClassStanding };

export type ParsedRosterTextSwimmer = {
  fullName: string;
  classYear: number | null;
  classStanding: RosterClassStanding | null;
  hometown: string | null;
  swimcloudUrl: string | null;
  isDiver: boolean;
  times: { event: string; course: Course; seconds: number }[];
};

const TIME_ON_LINE = /\b\d{1,2}:\d{2}\.\d{1,2}\b|\b\d{1,3}\.\d{1,2}\b/;
const EXPLICIT_CLASS = /\b(20\d{2})\b/;
const STANDING = /\b(fr(?:eshman)?|so(?:phomore)?|jr|junior|sr|senior|gr(?:aduate)?|gs|5y)\b/i;
const STANDING_GLOBAL = /\b(fr(?:eshman)?|so(?:phomore)?|jr|junior|sr|senior|gr(?:aduate)?|gs|5y)\b/gi;
const SEASON_RANGE = /\b((?:19|20)\d{2})\s*[-\u2013\u2014]\s*((?:19|20)?\d{2})\b/g;
const NON_NAME = /^(name|swimmer|athlete|class|year|hometown|events?|times?|roster|coaches?|staff|men'?s swimming|women'?s swimming|swimming and diving|open roster|season)$/i;
const EVENT_WORD = /^(free(style)?|back(stroke)?|breast(stroke)?|fly|butterfly|individual medley|im|relay)$/i;
const MARKDOWN_LINK = /\[([^\]\r\n]+)\]\(\s*(https?:\/\/[^)\s]+)\s*\)/giu;
const HTML_LINK = /<a\b[^>]*\bhref\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/giu;
const URL_TOKEN = /https?:\/\/[^\s<>"')\]]+/giu;
const RANK_START = /^\s*\d{1,3}(?:[.)](?:\s|$)|(?=\s|\t|$))/;

type RosterCandidate = Omit<ParsedRosterTextSwimmer, "times">;

type ProfileAnchor = {
  index: number;
  end: number;
  label: string;
  url: string;
};

type RosterRowMeta = {
  nameCell: string | null;
  hometown: string | null;
  classStanding: RosterClassStanding;
};

function titleToken(token: string): string {
  if (/^(ii|iii|iv|jr|sr)\.?$/i.test(token)) return token.replace(/\.$/, "").toUpperCase();
  if (token !== token.toLocaleUpperCase() && token !== token.toLocaleLowerCase()) {
    return `${token[0].toLocaleUpperCase()}${token.slice(1)}`;
  }
  return token
    .split("-")
    .map((part) => part ? `${part[0].toLocaleUpperCase()}${part.slice(1).toLocaleLowerCase()}` : part)
    .join("-");
}

function cleanName(value: string): string | null {
  const withoutMeta = value
    .replace(/^\s*(?:\d+[.)]\s*|[-\u2022]\s*)/, "")
    .replace(EXPLICIT_CLASS, " ")
    .replace(STANDING, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!withoutMeta || NON_NAME.test(withoutMeta) || TIME_ON_LINE.test(withoutMeta)) return null;
  if (/\d|https?:|@/.test(withoutMeta)) return null;

  let ordered = withoutMeta;
  const comma = /^([\p{L}'\u2019.-]+),\s*([\p{L}'\u2019.-]+(?:\s+[\p{L}'\u2019.-]+){0,3})$/u.exec(withoutMeta);
  if (comma) ordered = `${comma[2]} ${comma[1]}`;

  const tokens = ordered.split(/\s+/).filter(Boolean);
  if (tokens.length < 2 || tokens.length > 5 || tokens.some((token) => !/^[\p{L}][\p{L}'\u2019.-]*$/u.test(token))) {
    return null;
  }
  if (tokens.some((token) => EVENT_WORD.test(token))) return null;

  return tokens.map(titleToken).join(" ");
}

export function normalizeSwimCloudSwimmerUrl(value: string): string | null {
  try {
    const decoded = value.trim().replaceAll("&amp;", "&");
    const url = decoded.startsWith("/")
      ? new URL(decoded, "https://www.swimcloud.com")
      : new URL(decoded);
    const host = url.hostname.toLocaleLowerCase().replace(/^www\./, "");
    const swimmerId = url.pathname.match(/^\/swimmer\/(\d+)\/?$/)?.[1];
    if ((url.protocol !== "https:" && url.protocol !== "http:") || host !== "swimcloud.com" || !swimmerId) {
      return null;
    }
    return `https://www.swimcloud.com/swimmer/${swimmerId}`;
  } catch {
    return null;
  }
}

function markupToText(value: string): string {
  return value
    .replace(HTML_LINK, (_match, _quote, _href, label: string) => ` ${label} `)
    .replace(MARKDOWN_LINK, (_match, label: string) => ` ${label} `)
    .replace(/<[^>]*>/g, " ")
    .replace(/[*_~`]+/g, "")
    .replace(/&(nbsp|#160);/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#(?:39|x27);/gi, "'")
    .replace(/\u00a0/g, " ");
}

function seasonEndingYear(text: string): number | null {
  for (const match of text.matchAll(SEASON_RANGE)) {
    const start = Number(match[1]);
    const rawEnd = match[2];
    const end = rawEnd.length === 2
      ? Math.floor(start / 100) * 100 + Number(rawEnd)
      : Number(rawEnd);
    if (end === start + 1) return end;
  }
  return null;
}

function normalizeStanding(value: string): RosterClassStanding | null {
  const standing = value.toLocaleLowerCase().replaceAll(".", "").trim();
  if (standing === "fr" || standing === "freshman") return "FR";
  if (standing === "so" || standing === "sophomore") return "SO";
  if (standing === "jr" || standing === "junior") return "JR";
  if (standing === "sr" || standing === "senior") return "SR";
  if (standing === "gr" || standing === "graduate" || standing === "gs" || standing === "5y") return "GR";
  return null;
}

function standingCell(value: string): RosterClassStanding | null {
  return normalizeStanding(markupToText(value).replace(/\s+/g, " ").trim());
}

function firstStanding(value: string): { standing: RosterClassStanding; index: number } | null {
  for (const match of value.matchAll(STANDING_GLOBAL)) {
    const standing = normalizeStanding(match[1]);
    if (standing && match.index != null) return { standing, index: match.index };
  }
  return null;
}

function lastStanding(value: string): RosterClassStanding | null {
  const matches = [...value.matchAll(STANDING_GLOBAL)];
  return normalizeStanding(matches.at(-1)?.[1] ?? "");
}

function classYearFrom(value: string, seasonEnd: number | null = null): number | null {
  const withoutSeasonRanges = value.replace(SEASON_RANGE, " ");
  const explicit = withoutSeasonRanges.match(EXPLICIT_CLASS)?.[1];
  if (explicit) return Number(explicit);
  return classYearForStanding(lastStanding(withoutSeasonRanges), seasonEnd);
}

const DIVING_TEAM_PHRASE = /swimming\s*(?:and|&|\+|\/)\s*diving/gi;
const DIVER_MARKER = /\b(divers?|diving)\b/i;

function mentionsDiving(value: string): boolean {
  return DIVER_MARKER.test(value.replace(DIVING_TEAM_PHRASE, " "));
}

function cleanHometown(value: string): string | null {
  const clean = markupToText(value).replace(/\s+/g, " ").trim();
  if (!clean || clean.length > 100 || /https?:|\d{4}/i.test(clean)) return null;
  return clean;
}

function trailingHometown(value: string): string | null {
  const match = value.match(/([\p{L}][\p{L}\s.'\u2019-]{0,60},\s*[A-Z]{2,3})\s*$/u);
  return match ? cleanHometown(match[1]) : null;
}

function rosterRowMeta(cells: string[]): RosterRowMeta | null {
  for (let index = 1; index < cells.length; index += 1) {
    const classStanding = standingCell(cells[index]);
    if (!classStanding) continue;
    const hometown = cleanHometown(cells[index - 1]);
    if (!hometown) continue;
    return {
      nameCell: index >= 2 ? cells[index - 2] : null,
      hometown,
      classStanding,
    };
  }
  return null;
}

function rosterCells(lines: string[]): string[] {
  return lines.flatMap((line) => markupToText(line)
    .split(/\t+|\s+\|\s+/)
    .map((cell) => cell.replace(/\s+/g, " ").trim())
    .filter(Boolean));
}

function profileAnchors(text: string): ProfileAnchor[] {
  const anchors: ProfileAnchor[] = [];
  for (const match of text.matchAll(MARKDOWN_LINK)) {
    const url = normalizeSwimCloudSwimmerUrl(match[2]);
    const label = cleanName(markupToText(match[1]));
    if (url && label && match.index != null) {
      anchors.push({ index: match.index, end: match.index + match[0].length, label, url });
    }
  }
  for (const match of text.matchAll(HTML_LINK)) {
    const url = normalizeSwimCloudSwimmerUrl(match[2]);
    const label = cleanName(markupToText(match[3]));
    if (url && label && match.index != null) {
      anchors.push({ index: match.index, end: match.index + match[0].length, label, url });
    }
  }
  return anchors.sort((left, right) => left.index - right.index);
}

function profileUrlFrom(value: string): string | null {
  const anchor = profileAnchors(value)[0];
  if (anchor) return anchor.url;
  for (const match of value.matchAll(URL_TOKEN)) {
    const url = normalizeSwimCloudSwimmerUrl(match[0]);
    if (url) return url;
  }
  return null;
}

function linkedRosterCandidates(text: string, seasonEnd: number | null): RosterCandidate[] {
  const anchors = profileAnchors(text);
  return anchors.map((anchor, index) => {
    const next = anchors[index + 1];
    const contextEnd = next?.index ?? Math.min(text.length, anchor.end + 1_000);
    const afterAnchor = text.slice(anchor.end, contextEnd);
    const context = markupToText(afterAnchor).replace(/\s+/g, " ").trim();
    const meta = rosterRowMeta(rosterCells(afterAnchor.split(/\r?\n/)));
    const standingMatch = firstStanding(context);
    const classStanding = meta?.classStanding ?? standingMatch?.standing ?? null;
    const hometown = meta?.hometown
      ?? (standingMatch ? trailingHometown(context.slice(0, standingMatch.index)) : null);
    return {
      fullName: anchor.label,
      classYear: classYearForStanding(classStanding, seasonEnd),
      classStanding,
      hometown,
      swimcloudUrl: anchor.url,
      isDiver: mentionsDiving(context),
    };
  });
}

function flattenedRosterName(value: string): string | null {
  const withoutRank = value.replace(RANK_START, "").trim();
  const standingMatches = [...withoutRank.matchAll(STANDING_GLOBAL)];
  const standing = standingMatches.at(-1);
  if (!standing || standing.index == null) return null;

  const beforeClass = withoutRank.slice(0, standing.index).trim();
  if (!beforeClass.includes(",")) return null;
  const tokens = beforeClass.split(/\s+/).filter(Boolean);
  if (tokens.length < 3) return null;

  return cleanName(tokens.slice(0, 2).join(" "));
}

function rankedRosterCandidates(text: string, seasonEnd: number | null): RosterCandidate[] {
  const lines = text.split(/\r?\n/);
  const rankLines: number[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (RANK_START.test(markupToText(lines[index]).trim())) rankLines.push(index);
  }

  const candidates: RosterCandidate[] = [];
  for (let rankIndex = 0; rankIndex < rankLines.length; rankIndex += 1) {
    const start = rankLines[rankIndex];
    const end = rankLines[rankIndex + 1] ?? lines.length;
    const segmentLines = lines.slice(start, Math.min(end, start + 8));
    const segment = segmentLines.join("\n");
    const anchors = profileAnchors(segment);
    const firstLine = markupToText(segmentLines[0]).replace(/\u00a0/g, " ").trim();
    const cells = firstLine.split(/\t+|\s+\|\s+/).map((cell) => cell.trim()).filter(Boolean);
    const meta = rosterRowMeta(rosterCells(segmentLines));
    const firstCell = cells[0] ?? "";
    let name: string | null = anchors[0]?.label ?? (meta?.nameCell ? cleanName(meta.nameCell) : null);

    if (!name && /^\d{1,3}[.)]?$/.test(firstCell) && cells[1]) {
      name = cleanName(cells[1]);
    }
    if (!name) {
      const rankAndName = /^\d{1,3}(?:[.)])?\s+(.+)$/.exec(firstCell)?.[1];
      if (rankAndName) name = cleanName(rankAndName);
    }
    if (!name && /^\d{1,3}[.)]?$/.test(firstCell)) {
      for (const following of segmentLines.slice(1, 4)) {
        name = cleanName(markupToText(following).trim());
        if (name) break;
      }
    }
    if (!name) name = flattenedRosterName(firstLine);
    if (!name) continue;

    const plainSegment = markupToText(segment);
    const fallbackStanding = firstStanding(plainSegment)?.standing ?? null;
    const classStanding = meta?.classStanding ?? fallbackStanding;
    const hasRosterShape = Boolean(classStanding) || cells.length >= 4 || anchors.length > 0;
    if (!hasRosterShape) continue;
    candidates.push({
      fullName: name,
      classYear: classYearForStanding(classStanding, seasonEnd) ?? classYearFrom(plainSegment, seasonEnd),
      classStanding,
      hometown: meta?.hometown ?? null,
      swimcloudUrl: anchors[0]?.url ?? profileUrlFrom(segment),
      isDiver: mentionsDiving(plainSegment),
    });
  }
  return candidates;
}

function mergeRosterCandidates(candidates: RosterCandidate[]): ParsedRosterTextSwimmer[] {
  const merged = new Map<string, ParsedRosterTextSwimmer>();
  for (const candidate of candidates) {
    const key = normalizeRosterName(candidate.fullName);
    if (!key) continue;
    const prior = merged.get(key);
    if (prior) {
      prior.classYear ??= candidate.classYear;
      prior.classStanding ??= candidate.classStanding;
      prior.hometown ??= candidate.hometown;
      prior.swimcloudUrl ??= candidate.swimcloudUrl;
      prior.isDiver ||= candidate.isDiver;
      continue;
    }
    merged.set(key, { ...candidate, times: [] });
    if (merged.size >= 100) break;
  }
  return [...merged.values()];
}

function nameFromLegacyLine(line: string): string | null {
  const cells = line.split(/\t|\s+\|\s+/).map((cell) => cell.trim()).filter(Boolean);
  if (cells.length > 1) return cleanName(markupToText(cells[0]));
  return cleanName(markupToText(line));
}

function dedupeTimes(times: ParsedRosterTextSwimmer["times"]): ParsedRosterTextSwimmer["times"] {
  const best = new Map<string, ParsedRosterTextSwimmer["times"][number]>();
  for (const time of times) {
    const key = `${time.event}|${time.course}`;
    const prior = best.get(key);
    if (!prior || time.seconds < prior.seconds) best.set(key, time);
  }
  return [...best.values()];
}

function parseLegacyRosterText(text: string): ParsedRosterTextSwimmer[] {
  const blocks: { fullName: string; classYear: number | null; body: string[] }[] = [];

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;

    const name = nameFromLegacyLine(line);
    if (name && !TIME_ON_LINE.test(line)) {
      blocks.push({ fullName: name, classYear: classYearFrom(line), body: [] });
      if (blocks.length >= 100) break;
      continue;
    }

    if (blocks.length > 0) blocks[blocks.length - 1].body.push(line);
  }

  const seen = new Set<string>();
  const swimmers: ParsedRosterTextSwimmer[] = [];
  for (const block of blocks) {
    const key = normalizeRosterName(block.fullName);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const times = parsePastedTimes(block.body.join("\n"))
      .map((swim) => ({
        event: canonicalEvent(swim.event, swim.course) ?? swim.event,
        course: swim.course,
        seconds: swim.seconds,
      }))
      .filter((swim) => EVENT_GROUPS[swim.event as keyof typeof EVENT_GROUPS] !== undefined);
    swimmers.push({
      fullName: block.fullName,
      classYear: block.classYear,
      classStanding: null,
      hometown: null,
      swimcloudUrl: null,
      isDiver: mentionsDiving(block.body.join(" ")),
      times: dedupeTimes(times),
    });
  }
  return swimmers;
}

export function parseRosterText(
  text: string,
  options: { today?: Date } = {},
): ParsedRosterTextSwimmer[] {
  const limited = text.slice(0, 100_000);
  const seasonEnd = seasonEndingYear(limited) ?? currentSeasonEndYear(options.today);
  const roster = mergeRosterCandidates([
    ...linkedRosterCandidates(limited, seasonEnd),
    ...rankedRosterCandidates(limited, seasonEnd),
  ]);
  return roster.length > 0 ? roster : parseLegacyRosterText(limited);
}

export function normalizeRosterName(value: string): string {
  const comma = /^([^,]+),\s*(.+)$/.exec(value.trim());
  const ordered = comma ? `${comma[2]} ${comma[1]}` : value;
  return ordered
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase()
    .replace(/\b(jr|sr|ii|iii|iv)\b/g, "")
    .replace(/['\u2019]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}
