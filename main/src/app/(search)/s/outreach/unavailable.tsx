import Link from "@/components/app-link";

export function OutreachUnavailable({ message }: { message: string }) {
  return (
    <section className="wr-card mx-auto max-w-2xl p-8 text-center" role="alert">
      <h1 className="text-lg font-semibold">Outreach workspace unavailable</h1>
      <p className="mx-auto mt-2 max-w-lg text-sm text-ink-2">{message}</p>
      <div className="mt-4 flex justify-center gap-2">
        <Link href="/s" className="wr-btn wr-btn--neutral">Back home</Link>
        <Link href="/s/times" className="wr-btn wr-btn--primary">Review My Times</Link>
      </div>
    </section>
  );
}

export function OutreachDatabaseUpdateNotice() {
  return (
    <section className="rounded-[var(--radius)] border border-warn/35 bg-warn/5 px-4 py-3 text-xs leading-5 text-ink-2" role="status">
      <strong className="text-warn">Saving is temporarily unavailable.</strong>{" "}
      Existing folders remain visible while saving is paused. Please try again later.
    </section>
  );
}
