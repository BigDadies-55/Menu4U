// Shared helpers for attendance sign-off periods.
// A "period" is either a calendar month ("2026-05") or a work week keyed by its
// Sunday start date ("2026-05-17"). Israel's work week runs Sunday→Saturday.

export type PeriodType = "month" | "week";

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// The Sunday (00:00) that starts the week containing `d`.
export function sundayOf(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - x.getDay());
  return x;
}

// Inclusive from/to date range (YYYY-MM-DD) for a period.
export function periodRange(type: PeriodType, period: string): { from: string; to: string } {
  if (type === "week") {
    const [y, m, d] = period.split("-").map(Number);
    const start = new Date(y, (m ?? 1) - 1, d ?? 1);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { from: fmtDate(start), to: fmtDate(end) };
  }
  const [y, m] = period.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return { from: `${period}-01`, to: `${period}-${String(last).padStart(2, "0")}` };
}

// The previous, already-ended period (last month / last week).
export function prevPeriod(type: PeriodType): string {
  const n = new Date();
  if (type === "week") {
    const prevSun = sundayOf(n);
    prevSun.setDate(prevSun.getDate() - 7);
    return fmtDate(prevSun);
  }
  const d = new Date(n.getFullYear(), n.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// True only if the period has fully ended (not the current/future one).
export function isPastPeriod(type: PeriodType, period: string): boolean {
  const n = new Date();
  if (type === "week") {
    return period < fmtDate(sundayOf(n));
  }
  const cur = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
  return period < cur;
}

// The last `count` already-ended periods, newest first (for a picker).
export function recentPeriods(type: PeriodType, count: number): string[] {
  const out: string[] = [];
  const n = new Date();
  if (type === "week") {
    const sun = sundayOf(n);
    for (let i = 1; i <= count; i++) {
      const d = new Date(sun);
      d.setDate(sun.getDate() - 7 * i);
      out.push(fmtDate(d));
    }
    return out;
  }
  for (let i = 1; i <= count; i++) {
    const d = new Date(n.getFullYear(), n.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

export function periodLabel(type: PeriodType, period: string): string {
  if (type === "week") {
    const { from, to } = periodRange("week", period);
    const he = (s: string) => { const [y, m, d] = s.split("-"); return `${d}/${m}/${y}`; };
    return `שבוע ${he(from)}–${he(to)}`;
  }
  return period;
}
