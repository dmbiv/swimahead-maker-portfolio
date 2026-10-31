export function resultPageNumber(index: number, pageSize: number): number {
  if (!Number.isInteger(index) || index < 0 || !Number.isInteger(pageSize) || pageSize < 1) {
    throw new RangeError("Result index and page size must be positive integers.");
  }
  return Math.floor(index / pageSize) + 1;
}

export function programCardId(programId: string): string {
  return `program-${programId}`;
}

export function programListHref(pageHref: string, programId: string): string {
  return `${pageHref}#${encodeURIComponent(programCardId(programId))}`;
}

export function conferenceProgramsHref(
  conferenceId: string,
  returnHref?: string,
  squad?: "men" | "women" | "coed",
): string {
  const pathname = `/s/explore/conference/${encodeURIComponent(conferenceId)}`;
  const params = new URLSearchParams();
  if (returnHref) params.set("from", returnHref);
  if (squad) params.set("squad", squad);
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function safeExploreReturnHref(value: string | string[] | undefined): string {
  const candidate = (Array.isArray(value) ? value[0] : value)?.slice(0, 2_000);
  if (!candidate) return "/s/explore";

  try {
    const base = new URL("https://swimahead.local/s/explore");
    const target = new URL(candidate, base);
    if (target.origin !== base.origin || target.pathname !== "/s/explore") return "/s/explore";
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return "/s/explore";
  }
}
