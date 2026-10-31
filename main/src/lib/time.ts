export function parseClock(raw: string): number | null {
  const s = raw.trim().replace(",", ".");
  const m = s.match(/^(?:(\d{1,2}):)?(\d{1,2}(?:\.\d{1,2})?)$/);
  if (!m) return null;
  const mm = m[1] ? parseInt(m[1], 10) : 0;
  const ss = parseFloat(m[2]);
  if (mm > 0 && ss >= 60) return null;
  const total = mm * 60 + ss;
  return total > 0 && total < 3600 ? total : null;
}

export function fmtClock(seconds: number | null | undefined): string {
  if (seconds == null || !isFinite(seconds)) return "-";
  const hundredths = Math.round(seconds * 100);
  const mm = Math.floor(hundredths / 6000);
  const withinMinute = hundredths - mm * 6000;
  const ss = Math.floor(withinMinute / 100);
  const hh = withinMinute % 100;
  const frac = hh.toString().padStart(2, "0");
  return mm > 0
    ? `${mm}:${ss.toString().padStart(2, "0")}.${frac}`
    : `${ss}.${frac}`;
}

export function fmtDelta(mine: number, target: number): string {
  const d = mine - target;
  const sign = d <= 0 ? "−" : "+";
  return `${sign}${Math.abs(d).toFixed(2)}`;
}

export function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

export function usd(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

export function fmtDate(iso: string): string {
  const d = new Date(iso + (iso.length === 10 ? "T12:00:00" : ""));
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function fmtDateTime(iso: string): string {
  const d = new Date(iso + (iso.length === 10 ? "T12:00:00" : ""));
  if (Number.isNaN(d.valueOf())) return iso;
  if (iso.length === 10) return fmtDate(iso);
  return d.toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  });
}

export function todayISO(date = new Date()): string {
  const timeZone = process.env.NEXT_PUBLIC_APP_TIME_ZONE || "America/New_York";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function nowISO(): string {
  return new Date().toISOString();
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}
