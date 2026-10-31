export const LSC_CODES = [
  "AD", "AK", "AM", "AZ", "AR", "BD", "CC", "CO", "CT", "FG", "FL", "GA", "GU", "HI",
  "IL", "IN", "IE", "IA", "KY", "LE", "LA", "ME", "MD", "MR", "MI", "MA", "MW", "MN",
  "MS", "MV", "MT", "NE", "NJ", "NM", "NI", "NC", "ND", "NT", "OH", "OK", "OR", "OZ",
  "OHO", "PN", "PC", "PV", "SI", "SN", "SR", "SC", "SD", "ST", "SE", "CA", "UT", "VA",
  "WT", "US", "WV", "WI", "WY",
] as const;

export const DEFAULT_NEARBY_LSC_COUNT = 14;

export function prospectPoolSlices(
  lscCodes?: readonly string[],
  nearLscCodes?: readonly string[],
): (string | null)[] {
  const known = new Set<string>(LSC_CODES);

  if (lscCodes && lscCodes.length > 0) {
    const requested = lscCodes.map((code) => code.trim().toUpperCase()).filter((code) => known.has(code));
    return [...new Set(requested)];
  }

  const nearby = (nearLscCodes ?? LSC_CODES)
    .map((code) => code.trim().toUpperCase())
    .filter((code) => known.has(code))
    .slice(0, DEFAULT_NEARBY_LSC_COUNT);

  return [null, ...new Set(nearby)];
}
