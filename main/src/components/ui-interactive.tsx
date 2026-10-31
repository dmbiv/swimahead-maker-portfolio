"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Btn } from "./ui";

export function Modal({ open, onClose, title, children, wide }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    ref.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previousFocus.current?.focus();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="wr-modal-backdrop fixed inset-0 z-50 flex items-start justify-center p-4 pt-[8vh]" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`wr-modal w-full ${wide ? "max-w-3xl" : "max-w-lg"} max-h-[80vh] overflow-auto wr-scroll`}
        onKeyDown={(event) => {
          if (event.key !== "Tab") return;
          const focusable = ref.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])');
          if (!focusable?.length) return;
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
          if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-line sticky top-0 bg-surface z-10">
          <div id={titleId} className="font-display text-sm font-semibold">{title}</div>
          <button onClick={onClose} className="grid size-9 place-items-center rounded-ui border border-line text-ink-2 hover:border-accent hover:text-accent text-xl leading-none" aria-label="Close dialog">×</button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

export function CopyBtn({ text, label = "Copy", small = true }: { text: string; label?: string; small?: boolean }) {
  const [status, setStatus] = useState<"idle" | "done" | "error">("idle");
  return (
    <Btn small={small} onClick={async () => {
      try {
        await navigator.clipboard.writeText(text);
        setStatus("done");
      } catch {
        setStatus("error");
      }
      window.setTimeout(() => setStatus("idle"), 1800);
    }}>
      <span aria-live="polite">{status === "done" ? "Copied ✓" : status === "error" ? "Copy failed" : label}</span>
    </Btn>
  );
}

export function Star({ n, onChange }: { n: number; onChange?: (n: number) => void }) {
  return (
    <span className="inline-flex" aria-label={`${n} of 5 rating`}>
      {[1, 2, 3, 4, 5].map((value) => (
        <button
          key={value}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(value === n ? 0 : value)}
          className={`grid size-7 place-items-center text-base leading-none ${value <= n ? "text-accent" : "text-line"} ${onChange ? "hover:bg-sunken" : "cursor-default"}`}
          aria-label={`Set rating to ${value}`}
          aria-pressed={value === n}
        >★</button>
      ))}
    </span>
  );
}
