import type { ReactNode } from "react";
import * as FormControl from "@/components/form-control";

export function Card({ children, className = "", pad = true }: { children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <div className={`wr-card ${pad ? "p-4 sm:p-5" : "wr-card--flush"} ${className}`}>
      {children}
    </div>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="wr-section-title">
      <h2>{children}</h2>
      {right}
    </div>
  );
}

export type Tone = "neutral" | "accent" | "good" | "warn" | "bad" | "accent2";

const toneCls: Record<Tone, string> = {
  neutral: "bg-sunken/70 text-ink-2 border-line",
  accent: "bg-accent/10 text-accent border-accent",
  accent2: "bg-accent-2/10 text-accent-2 border-accent-2",
  good: "bg-good/10 text-good border-good/30",
  warn: "bg-warn/10 text-warn border-warn/30",
  bad: "bg-bad/10 text-bad border-bad/30",
};

export function Badge({ children, tone = "neutral", title }: { children: ReactNode; tone?: Tone; title?: string }) {
  return (
    <span title={title} className={`wr-badge ${toneCls[tone]}`}>
      {children}
    </span>
  );
}

export function Btn({
  children, onClick, tone = "neutral", type = "button", disabled, small, className = "", title,
}: {
  children: ReactNode; onClick?: () => void; tone?: "primary" | "neutral" | "danger" | "ghost";
  type?: "button" | "submit"; disabled?: boolean; small?: boolean; className?: string; title?: string;
}) {
  return (
    <button
      type={type} onClick={onClick} disabled={disabled} title={title}
      className={`wr-btn wr-btn--${tone} ${small ? "wr-btn--small" : ""} ${className}`}
    >
      {children}
    </button>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <FormControl.Input
      {...props}
      className={`wr-control ${props.className ?? ""}`}
    />
  );
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <FormControl.Textarea
      {...props}
      className={`wr-control ${props.className ?? ""}`}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <FormControl.Select
      {...props}
      className={`wr-control ${props.className ?? ""}`}
    />
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <div className="wr-field-label">{label}</div>
      {children}
    </label>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: string; tone?: Tone }) {
  return (
    <div className="min-w-0">
      <div className="wr-stat-label">{label}</div>
      <div className={`wr-stat-value ${tone === "good" ? "text-good" : tone === "bad" ? "text-bad" : tone === "warn" ? "text-warn" : ""}`}>{value}</div>
      {hint && <div className="wr-stat-hint">{hint}</div>}
    </div>
  );
}

export function EmptyState({ title, hint, children }: { title: string; hint?: string; children?: ReactNode }) {
  return (
    <div className="wr-empty">
      <div className="font-display text-sm font-semibold text-ink">{title}</div>
      {hint && <div className="text-xs text-ink-3 mt-1 max-w-sm mx-auto">{hint}</div>}
      {children && <div className="mt-3 flex justify-center gap-2">{children}</div>}
    </div>
  );
}

export function Meter({ value, tone = "accent", label = "Score" }: { value: number; tone?: "accent" | "good" | "warn" | "bad"; label?: string }) {
  const color = { accent: "var(--accent)", good: "var(--good)", warn: "var(--warn)", bad: "var(--bad)" }[tone];
  return (
    <div className="wr-meter" role="meter" aria-label={`${label}: ${Math.round(value)} out of 100`} aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <div style={{ width: `${Math.max(2, Math.min(100, value))}%`, background: color }} />
    </div>
  );
}
