import "server-only";

export function isSwimsIngestionLicensed(): boolean {
  return process.env.SWIMS_INGESTION_LICENSE_CONFIRMED?.trim().toLowerCase() === "true";
}
