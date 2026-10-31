import type { Division } from "./types";

export interface ContactRule {
  open: boolean;
  opensOn: string | null;  
  label: string;
  detail: string;
}

function dateInTimeZone(date: Date, timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const value = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((part) => part.type === type)?.value ?? "";
    return `${value("year")}-${value("month")}-${value("day")}`;
  } catch {
    return new Date(date.getTime() - 12 * 60 * 60 * 1000).toISOString().slice(0, 10);
  }
}

export function contactRule(
  gradYear: number,
  division: Division,
  now = new Date(),
  programTimeZone?: string | null,
): ContactRule {
  if (division === "D3" || division === "NAIA") {
    return {
      open: true,
      opensOn: null,
      label: "No platform date block",
      detail: `${division}: confirm current contact rules and institution policy with the compliance office.`,
    };
  }
  const opensOn = `${gradYear - 2}-06-15`;
  const effectiveTimeZone = programTimeZone || "Pacific/Honolulu";
  const usesConservativeFallback = !programTimeZone;
  if (dateInTimeZone(now, effectiveTimeZone) >= opensOn) {
    return {
      open: true, opensOn: null, label: "Contact OK",
      detail: usesConservativeFallback
        ? `Class of ${gradYear}: the initial-contact date has passed under the conservative US timezone fallback. Configure the program timezone and check the current recruiting calendar before sending.`
        : `Class of ${gradYear}: the configured initial-contact date has passed. Check the current recruiting calendar and any shutdown period before sending.`,
    };
  }
  return {
    open: false, opensOn, label: `Locked until Jun 15, ${gradYear - 2}`,
    detail: usesConservativeFallback
      ? `The ${division} date gate is using a conservative US timezone because this program has no verified timezone. Direct outreach remains blocked through the fallback cutoff.`
      : `The configured ${division} initial-contact rule blocks direct outreach to the class of ${gradYear} before June 15, ${gradYear - 2}, in the program's local time.`,
  };
}

export function daysUntil(iso: string, now = new Date()): number {
  const then = new Date(iso + "T00:00:00Z");
  return Math.ceil((then.getTime() - now.getTime()) / 86400000);
}

export function timelineFor(gradYear: number): { date: string; title: string; detail: string }[] {
  const y = gradYear;
  return [
    { date: `${y - 3}-09-01`, title: "Build your list", detail: "Freshman/sophomore year: profile, times, and a 20+ school long-list. Athletes may submit questionnaires before the direct-contact window; follow each program's instructions." },
    { date: `${y - 2}-06-15`, title: "D1/D2 contact opens", detail: "Coaches can call, text, and email you. Send your intro emails the week before so you're on top of the inbox." },
    { date: `${y - 2}-08-01`, title: "Official visits can begin (D1)", detail: "For swimming, expense-paid visits may begin August 1 before junior year. Each school generally may finance one visit." },
    { date: `${y - 1}-09-01`, title: "Narrow to a short list", detail: "Junior year: 8–12 schools, actively talking. Ask each coach where you sit on their board." },
    { date: `${y - 1}-11-01`, title: "Senior-year decision check", detail: "Compare written offers, admissions timelines, total aid, and the exact roster role each staff is offering." },
    { date: `${y}-04-15`, title: "Late-cycle roster check", detail: "Confirm remaining roster spots, admissions conditions, and the complete cost of attendance in writing." },
    { date: `${y}-06-01`, title: "Commit & confirm", detail: "Final transcripts, eligibility center, roster confirmation." },
  ];
}
