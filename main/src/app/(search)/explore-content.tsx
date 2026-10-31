import { Explorer } from "./s/explore/explorer";
import { Skel } from "@/components/skeleton";
import {
  filterPublicPrograms,
  parsePublicProgramFilters,
  type PublicProgramSearchParams,
} from "@/lib/public-programs";
import { loadExploreDirectory, loadPublicSwimmingStrength } from "@/lib/explore-programs";

function requestedPage(params: PublicProgramSearchParams): number {
  const raw = params.page;
  const value = Array.isArray(raw) ? raw[0] : raw;
  const page = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

function DirectoryState({ title, detail }: { title: string; detail: string }) {
  return (
    <section className="wr-card p-8 text-center">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mx-auto mt-2 max-w-lg text-sm text-ink-3">{detail}</p>
    </section>
  );
}

export function ExploreFallback() {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Skel w="min(320px, 60%)" h={26} />
        <Skel w={132} h={28} radius="var(--radius)" />
      </div>
      <div className="wr-card flex flex-wrap gap-2 p-3 sm:p-4">
        {[120, 90, 90, 110, 80].map((w, i) => <Skel key={i} w={w} h={32} radius="var(--radius)" />)}
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]">
        <div className="order-2 space-y-3 lg:order-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="wr-card space-y-2.5 p-4 sm:p-5">
              <Skel w="70%" h={16} />
              <Skel w="45%" h={12} />
              <Skel w="90%" h={12} />
            </div>
          ))}
        </div>
        <div className="order-1 lg:order-2">
          <Skel w="100%" h={320} radius="var(--radius)" />
        </div>
      </div>
    </div>
  );
}

export async function ExploreContent({ params }: { params: Promise<PublicProgramSearchParams> }) {
  const resolvedParams = await params;
  const filters = parsePublicProgramFilters(resolvedParams);
  const [{ result, facets }, swimmingStrength] = await Promise.all([
    loadExploreDirectory(),
    filters.sort === "swimming-strength"
      ? loadPublicSwimmingStrength()
      : Promise.resolve({ scores: {}, coveredProgramCount: 0 }),
  ]);

  if (result.status === "unconfigured") {
    return (
      <DirectoryState
        title="College data isn’t connected yet"
        detail="Add a Supabase connection to load the college directory. Search, filters, and the map light up automatically once it’s in place."
      />
    );
  }
  if (result.status === "error") {
    return <DirectoryState title="Programs couldn’t load" detail={result.message} />;
  }
  if (result.status === "empty") {
    return (
      <DirectoryState
        title="No programs published yet"
        detail="The directory is connected but has no active swimming programs. Load the program dataset to populate search."
      />
    );
  }

  const programs = filterPublicPrograms(result.programs, filters, swimmingStrength.scores);
  return (
    <Explorer
      allPrograms={result.programs}
      facets={facets}
      programs={programs}
      filters={filters}
      requestedPage={requestedPage(resolvedParams)}
      swimmingStrength={swimmingStrength.scores}
      swimmingStrengthCoverage={swimmingStrength.coveredProgramCount}
    />
  );
}
