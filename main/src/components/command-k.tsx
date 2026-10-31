"use client";

import * as FormControl from "@/components/form-control";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { announceNavigationStart } from "./navigation-feedback";

export interface CmdItem { group: string; label: string; hint?: string; href: string }

export function CommandK({ items }: { items: CmdItem[] }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o); setQ(""); setSel(0);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 10);
    return () => {
      window.clearTimeout(timer);
      previousFocus.current?.focus();
    };
  }, [open]);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items.slice(0, 12);
    return items
      .map((it) => {
        const hay = `${it.label} ${it.hint ?? ""} ${it.group}`.toLowerCase();
        let score = 0;
        if (hay.includes(needle)) score = 100 - hay.indexOf(needle);
        else {
          const words = needle.split(/\s+/);
          if (words.every((w) => hay.includes(w))) score = 40;
        }
        return { it, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12)
      .map((x) => x.it);
  }, [q, items]);

  if (!open) return null;
  return (
    <div className="command-backdrop fixed inset-0 z-[60] flex items-start justify-center p-4 pt-[12vh]" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Search pages and records"
        className="command-panel w-full max-w-md overflow-hidden"
        onKeyDown={(e) => {
          if (e.key !== "Tab") return;
          const focusable = panelRef.current?.querySelectorAll<HTMLElement>('input, button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])');
          if (!focusable?.length) return;
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
          if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }}
      >
        <FormControl.Input
          ref={inputRef}
          value={q}
          onChange={(e) => { setQ(e.target.value); setSel(0); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(results.length - 1, s + 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
            if (e.key === "Enter" && results[sel]) { setOpen(false); announceNavigationStart(results[sel].href); router.push(results[sel].href); }
          }}
          placeholder="Search pages and records…"
          className="command-input w-full px-4 outline-none"
        />
        <div className="max-h-72 overflow-auto wr-scroll py-1">
          {results.length === 0 && <div className="px-4 py-3 text-sm text-ink-3">No matches.</div>}
          {results.map((r, i) => (
            <button
              key={`${r.href}-${i}`}
              onMouseEnter={() => setSel(i)}
              onClick={() => { setOpen(false); announceNavigationStart(r.href); router.push(r.href); }}
              className="command-result w-full text-left px-4 py-2 flex items-baseline gap-2"
              data-selected={i === sel}
            >
              <span className="text-sm font-medium truncate">{r.label}</span>
              {r.hint && <span className="text-xs truncate text-ink-3">{r.hint}</span>}
              <span className="ml-auto font-data text-[11px] text-ink-3">{r.group}</span>
            </button>
          ))}
        </div>
        <div className="px-4 py-2 border-t border-line font-data text-[11px] text-ink-3">↑↓ navigate · ↵ open · esc close</div>
      </div>
    </div>
  );
}
