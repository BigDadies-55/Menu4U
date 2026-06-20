// Shared design tokens + helpers for the attendance-manager tabs.
import type { CSSProperties } from "react";

export const GB           = "rgba(255,255,255,0.14)";   // glass border
export const GC           = "rgba(255,255,255,0.04)";   // glass card bg
export const GM           = "rgba(255,255,255,0.55)";   // glass muted text
export const ACCENT_GRAD  = "linear-gradient(135deg,#D97706,#F59E0B)";
export const MODAL_BG     = "rgba(18,18,30,0.98)";
export const MODAL_BORDER = "rgba(255,255,255,0.18)";

export const MONTHS_HE = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];

export type AttRoleCfg = { code: string; label: string; payCode: string; color: string; hourlyRate?: number };
export type StaffMember = { id: string; name: string; email?: string };
export type ShiftRow = {
  id: string; userId: string; userName: string; date: string; shiftType: string;
  startTime: string; endTime: string; role: string | null; notes: string | null; status: string;
};
export type AttRecord = {
  id: string; userId: string; type: string; date: string; timestamp: string;
  note: string | null; roleCode?: string | null; unscheduled?: boolean; outOfWindow?: boolean;
  isCorrection?: boolean;
};

export function formatDateISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

// Attendance punch timestamps are stored as Israel wall-clock encoded in the UTC
// fields of the value (see the POST handler). They must therefore be *displayed*
// with timeZone:"UTC" to recover the original wall time, and "now" must be taken
// in the same wall convention for any duration/elapsed comparison.
export function fmtTime(ts: string): string {
  return new Date(ts).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
}

/** "Now" in the same wall-clock-as-UTC convention as stored punches (ms). */
export function nowWallMs(): number {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jerusalem" })).getTime();
}

// Real instants (createdAt / signedAt / decidedAt) are genuine UTC — render them
// in Israel local time.
export function fmtDateTime(ts: string): string {
  return new Date(ts).toLocaleString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" });
}

export function exportCsv(rows: string[][], filename: string) {
  const csv = "﻿" + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  a.download = filename;
  a.click();
}

export const inputStyle: CSSProperties = {
  background: "rgba(255,255,255,0.07)", border: `1px solid ${GB}`, borderRadius: 8,
  color: "#fff", padding: "5px 10px", fontSize: 12, fontFamily: "inherit", outline: "none",
};
