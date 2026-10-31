import type { PublicProgramFitBenchmark } from "./public-programs";

function datasetKey(benchmark: PublicProgramFitBenchmark): string {
  return [
    benchmark.gender,
    benchmark.course,
    benchmark.scope,
    benchmark.rankCutoff ?? "score",
  ].join(":");
}

function seasonEndYear(seasonLabel: string): number {
  const years = seasonLabel.match(/\d{2,4}/g) ?? [];
  if (years.length === 0) return 0;

  const firstLabel = years[0];
  if (!firstLabel) return 0;
  const first = Number.parseInt(firstLabel, 10);
  const last = Number.parseInt(years.at(-1) ?? firstLabel, 10);
  if (!Number.isFinite(last)) return 0;
  if (last >= 100) return last;
  if (!Number.isFinite(first) || first < 1000) return last;

  const century = Math.floor(first / 100) * 100;
  const candidate = century + last;
  return candidate < first ? candidate + 100 : candidate;
}

function datasetIdentity(benchmark: PublicProgramFitBenchmark): string {
  return benchmark.provenance.releaseId
    ?? `legacy:${benchmark.seasonLabel}:${benchmark.sourceSnapshotId}`;
}

function compareDatasetRecency(
  left: PublicProgramFitBenchmark,
  right: PublicProgramFitBenchmark,
): number {
  const leftMeetDate = left.provenance.meetDate ?? "";
  const rightMeetDate = right.provenance.meetDate ?? "";
  if (leftMeetDate !== rightMeetDate) return leftMeetDate.localeCompare(rightMeetDate);

  const yearDifference = seasonEndYear(left.seasonLabel) - seasonEndYear(right.seasonLabel);
  if (yearDifference !== 0) return yearDifference;
  if (left.seasonLabel !== right.seasonLabel) {
    return left.seasonLabel.localeCompare(right.seasonLabel);
  }

  return datasetIdentity(left).localeCompare(datasetIdentity(right));
}

export function selectPreferredBenchmarkDatasets(
  benchmarks: PublicProgramFitBenchmark[],
): PublicProgramFitBenchmark[] {
  const grouped = new Map<string, PublicProgramFitBenchmark[]>();
  for (const benchmark of benchmarks) {
    const key = datasetKey(benchmark);
    grouped.set(key, [...(grouped.get(key) ?? []), benchmark]);
  }

  return [...grouped.values()].flatMap((rows) => {
    const verified = rows.filter(
      (row) => row.provenance.kind === "verified_championship_release",
    );
    const eligible = verified.length > 0 ? verified : rows;
    const newest = eligible.reduce((current, candidate) =>
      compareDatasetRecency(candidate, current) > 0 ? candidate : current);
    const identity = datasetIdentity(newest);
    return eligible.filter((row) => datasetIdentity(row) === identity);
  });
}
