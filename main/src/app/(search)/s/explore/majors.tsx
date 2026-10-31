"use client";

import { useState } from "react";

export function Majors({ titles }: { titles: string[] }) {
  const [open, setOpen] = useState(false);
  if (titles.length === 0) return null;
  if (titles.length <= 6) {
    return <p className="mt-3 text-xs text-ink-2">{titles.join(" · ")}</p>;
  }
  const shown = open ? titles : titles.slice(0, 6);
  return (
    <p className="mt-3 text-xs text-ink-2">
      {shown.join(" · ")}{" "}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-accent whitespace-nowrap"
      >
        {open ? "Show less" : `+${titles.length - 6} more majors`}
      </button>
    </p>
  );
}
