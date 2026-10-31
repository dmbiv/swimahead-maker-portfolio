"use client";

import Link from "@/components/app-link";
import { useEffect } from "react";

export default function SwimmerError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Swimmer workspace error", error);
  }, [error]);

  return (
    <section className="mx-auto max-w-xl wr-card p-6 text-center sm:p-8" role="alert">
      <h1>That page didn’t load</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-ink-2">Your saved work is still intact. Try the page again, or return home and continue somewhere else.</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <button type="button" className="wr-btn wr-btn--primary" onClick={reset}>Try again</button>
        <Link href="/s" className="wr-btn wr-btn--neutral">Back to home</Link>
      </div>
    </section>
  );
}
