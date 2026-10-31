
export type LscGeo = { code: string; name: string; lat: number; lon: number };

export const LSC_GEO: Record<string, LscGeo> = {
  AD: { code: "AD", name: "Adirondack", lat: 43.1, lon: -73.8 },
  AK: { code: "AK", name: "Alaska", lat: 61.2, lon: -149.9 },
  AM: { code: "AM", name: "Allegheny Mountain", lat: 40.4, lon: -79.9 },
  AZ: { code: "AZ", name: "Arizona", lat: 33.4, lon: -112.1 },
  AR: { code: "AR", name: "Arkansas", lat: 34.7, lon: -92.3 },
  BD: { code: "BD", name: "Border", lat: 31.8, lon: -106.4 },
  CC: { code: "CC", name: "Central California", lat: 36.7, lon: -119.8 },
  CO: { code: "CO", name: "Colorado", lat: 39.7, lon: -104.9 },
  CT: { code: "CT", name: "Connecticut", lat: 41.6, lon: -72.7 },
  FG: { code: "FG", name: "Florida Gold Coast", lat: 26.1, lon: -80.1 },
  FL: { code: "FL", name: "Florida", lat: 28.5, lon: -81.4 },
  GA: { code: "GA", name: "Georgia", lat: 33.7, lon: -84.4 },
  GU: { code: "GU", name: "Gulf", lat: 29.8, lon: -95.4 },
  HI: { code: "HI", name: "Hawaiian", lat: 21.3, lon: -157.9 },
  IL: { code: "IL", name: "Illinois", lat: 41.9, lon: -87.6 },
  IN: { code: "IN", name: "Indiana", lat: 39.8, lon: -86.2 },
  IE: { code: "IE", name: "Inland Empire", lat: 47.7, lon: -117.4 },
  IA: { code: "IA", name: "Iowa", lat: 41.6, lon: -93.6 },
  KY: { code: "KY", name: "Kentucky", lat: 38.0, lon: -84.5 },
  LE: { code: "LE", name: "Lake Erie", lat: 41.5, lon: -81.7 },
  LA: { code: "LA", name: "Louisiana", lat: 30.5, lon: -91.1 },
  ME: { code: "ME", name: "Maine", lat: 43.7, lon: -70.3 },
  MD: { code: "MD", name: "Maryland", lat: 39.3, lon: -76.6 },
  MR: { code: "MR", name: "Metropolitan", lat: 40.7, lon: -74.0 },
  MI: { code: "MI", name: "Michigan", lat: 42.7, lon: -84.6 },
  MA: { code: "MA", name: "Middle Atlantic", lat: 39.95, lon: -75.2 },
  MW: { code: "MW", name: "Midwestern", lat: 37.7, lon: -97.3 },
  MN: { code: "MN", name: "Minnesota", lat: 44.98, lon: -93.3 },
  MS: { code: "MS", name: "Mississippi", lat: 32.3, lon: -90.2 },
  MV: { code: "MV", name: "Missouri Valley", lat: 39.1, lon: -94.6 },
  MT: { code: "MT", name: "Montana", lat: 46.6, lon: -112.0 },
  NE: { code: "NE", name: "New England", lat: 42.4, lon: -71.4 },
  NJ: { code: "NJ", name: "New Jersey", lat: 40.2, lon: -74.7 },
  NM: { code: "NM", name: "New Mexico", lat: 35.1, lon: -106.6 },
  NI: { code: "NI", name: "Niagara", lat: 43.0, lon: -78.8 },
  NC: { code: "NC", name: "North Carolina", lat: 35.8, lon: -78.6 },
  ND: { code: "ND", name: "North Dakota", lat: 46.8, lon: -100.8 },
  NT: { code: "NT", name: "North Texas", lat: 32.8, lon: -96.8 },
  OH: { code: "OH", name: "Ohio", lat: 40.0, lon: -83.0 },
  OHO: { code: "OHO", name: "Ohio (Old)", lat: 40.0, lon: -83.0 },
  OK: { code: "OK", name: "Oklahoma", lat: 35.5, lon: -97.5 },
  OR: { code: "OR", name: "Oregon", lat: 45.5, lon: -122.7 },
  OZ: { code: "OZ", name: "Ozark", lat: 38.6, lon: -90.2 },
  PN: { code: "PN", name: "Pacific Northwest", lat: 47.6, lon: -122.3 },
  PC: { code: "PC", name: "Pacific", lat: 37.8, lon: -122.3 },
  PV: { code: "PV", name: "Potomac Valley", lat: 38.9, lon: -77.0 },
  SI: { code: "SI", name: "San Diego-Imperial", lat: 32.8, lon: -117.1 },
  SN: { code: "SN", name: "Sierra Nevada", lat: 38.6, lon: -121.5 },
  SR: { code: "SR", name: "Snake River", lat: 43.6, lon: -116.2 },
  SC: { code: "SC", name: "South Carolina", lat: 34.0, lon: -81.0 },
  SD: { code: "SD", name: "South Dakota", lat: 43.5, lon: -96.7 },
  ST: { code: "ST", name: "South Texas", lat: 29.4, lon: -98.5 },
  SE: { code: "SE", name: "Southeastern", lat: 34.7, lon: -86.6 },
  CA: { code: "CA", name: "Southern California", lat: 34.05, lon: -118.2 },
  US: { code: "US", name: "USA Swimming", lat: 39.8, lon: -98.6 },  
  UT: { code: "UT", name: "Utah", lat: 40.8, lon: -111.9 },
  VA: { code: "VA", name: "Virginia", lat: 37.5, lon: -77.4 },
  WT: { code: "WT", name: "West Texas", lat: 33.6, lon: -101.9 },
  WV: { code: "WV", name: "West Virginia", lat: 38.3, lon: -81.6 },
  WI: { code: "WI", name: "Wisconsin", lat: 43.1, lon: -89.4 },
  WY: { code: "WY", name: "Wyoming", lat: 42.9, lon: -106.3 },
};

const EARTH_RADIUS_MI = 3958.8;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function haversineMiles(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_MI * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function milesFromCollegeToLsc(
  college: { latitude: number | null; longitude: number | null },
  lscCode: string | null,
): number | null {
  if (college.latitude == null || college.longitude == null || !lscCode) return null;
  const lsc = LSC_GEO[lscCode.toUpperCase()];
  if (!lsc) return null;
  return haversineMiles(college.latitude, college.longitude, lsc.lat, lsc.lon);
}

export function nearestLscCodes(college: { latitude: number | null; longitude: number | null }): string[] {
  if (college.latitude == null || college.longitude == null) return [];
  return Object.values(LSC_GEO)
    .map((lsc) => ({ code: lsc.code, miles: haversineMiles(college.latitude!, college.longitude!, lsc.lat, lsc.lon) }))
    .sort((a, b) => a.miles - b.miles)
    .map((entry) => entry.code);
}
