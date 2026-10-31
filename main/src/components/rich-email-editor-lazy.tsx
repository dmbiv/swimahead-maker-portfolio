"use client";

import dynamic from "next/dynamic";

export const RichEmailEditor = dynamic(
  () => import("./rich-email-editor").then((module) => module.RichEmailEditor),
  {
    ssr: false,
    loading: () => (
      <div className="wr-control min-h-40 text-sm text-ink-3" aria-live="polite">
        Loading the editor…
      </div>
    ),
  },
);
