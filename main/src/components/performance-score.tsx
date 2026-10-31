import { performanceScoreTitle, type PerformanceScore } from "@/lib/performance-points";

export function PerformanceScoreValue({ score, className = "" }: {
  score: PerformanceScore | null;
  className?: string;
}) {
  if (!score) {
    return <span className={`text-ink-3 ${className}`} title="No score is available for this event and course.">Not scored</span>;
  }

  return (
    <span
      className={`inline-flex items-baseline gap-1.5 whitespace-nowrap ${className}`}
      title={performanceScoreTitle(score)}
      aria-label={`${score.value} points, ${score.methodLabel}`}
    >
      <span className="font-data font-semibold tabular-nums">{score.value}</span>
      <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-semibold leading-none ${score.method === "world_aquatics" ? "border-accent-2/35 bg-accent-2/10 text-accent-2" : "border-accent/35 bg-accent/10 text-accent"}`}>
        {score.shortLabel}
      </span>
    </span>
  );
}

export function PerformanceScoreGuide() {
  return (
    <details className="rounded-[var(--radius)] border border-line bg-sunken/35 px-3 py-2.5 text-xs text-ink-2">
      <summary className="cursor-pointer font-semibold text-ink">How performance scores work</summary>
      <div className="mt-2 grid gap-2 leading-5 sm:grid-cols-2">
        <p>
          <strong className="text-accent-2">WA</strong> is the official World Aquatics score for SCM and LCM. It uses the current course-, event-, and sex-specific base time and truncates <span className="font-data">1000 × (base ÷ time)³</span>.
        </p>
        <p>
          <strong className="text-accent">College</strong> is SwimAhead’s SCY recruiting index. A score of 1,000 matches the current NCAA Division I standard for that event, which is based on the three-year average of the 72nd-fastest Division I performance. It is not an official NCAA, USA Swimming, or SwimCloud score.
        </p>
      </div>
      <p className="mt-2 text-[11px] leading-5 text-ink-3">
        College Index and WA Points are separate scales. The app never ranks or filters one against the other. Scores use your profile sex and exact course, with no course conversion or age adjustment. The SCY 1000 free uses a distance-event estimate because it is not an NCAA championship event. Sources: <a href="https://www.worldaquatics.com/swimming/points" target="_blank" rel="noreferrer" className="font-semibold text-accent-2 hover:underline">World Aquatics Points ↗</a> and <a href="https://ncaaorg.s3.amazonaws.com/championships/sports/swimdive/d1/2025-26D1XSW_QUALSTANDARDS.pdf" target="_blank" rel="noreferrer" className="font-semibold text-accent-2 hover:underline">NCAA Division I standards ↗</a>.
      </p>
    </details>
  );
}
