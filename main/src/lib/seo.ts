import { configuredSiteUrl } from "./env";

export const SITE_NAME = "SwimAhead";
export const SITE_DESCRIPTION =
  "SwimAhead is a college swimming recruiting platform for swimmers and coaches to find programs, compare fit, discover recruits, and manage outreach.";

export function siteUrl(): URL {
  return new URL(configuredSiteUrl() ?? "http://localhost:3000");
}

export function absoluteSiteUrl(path = "/"): string {
  return new URL(path, siteUrl()).toString();
}
