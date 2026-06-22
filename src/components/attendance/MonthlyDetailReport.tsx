"use client";

import React, { useMemo } from "react";
import { computeDailyHoursByRole } from "@/lib/hours";

// Per-day breakdown of one employee's attendance for a month, shown under the
// monthly sign-off card. Shared between the manager SignoffTab and the waiter
// SelfSignoffModal so both render identical figures.

type Rec = { type: string; date: string; timestamp: string; roleCode?: string | null };

const GB = "rgba(255,255,255,0.12)";
const GM = "rgba(255,255,255,0.55)";

// Punch timestamps are stored as wall-clock-as-UTC → render with timeZone:"UTC".
function fmtT(ts?: string) {
  return ts ? new Date(ts).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) : "–";
}
function fmtDay(date: string) {
  const d = new Date(`${date}T00:00:00`);
  return d.toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", weekday: "short" });
}
const fmtH = (n: number) => (n > 0 ? n.toFixed(1) : "–");

export default function MonthlyDetailReport({ records }: { records: Rec[] }) {
  const days = useMemo(() => {
    const byDate: Record<string, Rec[]> = {};
    for (const r of records) (byDate[r.date] ??= []).push(r);
    return Object.keys(byDate).sort().map(date => {
      const recs = byDate[date].slice().sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      const firstIn = recs.find(r => r.type === "IN")?.timestamp;
      const lastOut = [...recs].reverse().find(r => r.type === "OUT")?.timestamp;
      const bd = computeDailyHoursByRole(recs);
      return { date, firstIn, lastOut, bd };
    });
  }, [records]);

  if (days.length === 0) {
    return <div style={{ fontSize: 13, color: GM, padding: "12px 4px" }}>אין רישומי נוכחות בחודש זה.</div>;
  }

  const th: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: GM, textAlign: "right", padding: "6px 8px", borderBottom: `1px solid ${GB}`, whiteSpace: "nowrap" };
  const td: React.CSSProperties = { fontSize: 12, color: "rgba(255,255,255,0.85)", padding: "6px 8px", borderBottom: "1px solid rgba(255,255,255,0.05)", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" };

  return (
    <div style={{ overflowX: "auto", marginTop: 4 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 480 }}>
        <thead>
          <tr>
            {["תאריך", "כניסה", "יציאה", "ברוטו", "הפסקה", "נטו", "125%", "150%"].map(h => (
              <th key={h} style={th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {days.map(d => (
            <tr key={d.date}>
              <td style={{ ...td, color: "#fff", fontWeight: 600 }}>{fmtDay(d.date)}</td>
              <td style={td}>{fmtT(d.firstIn)}</td>
              <td style={td}>{fmtT(d.lastOut)}</td>
              <td style={td}>{fmtH(d.bd.grossHours)}</td>
              <td style={td}>{fmtH(d.bd.breakHours)}</td>
              <td style={{ ...td, color: "#FBBF24", fontWeight: 700 }}>{fmtH(d.bd.netHours)}</td>
              <td style={{ ...td, color: "#FB923C" }}>{fmtH(d.bd.overtime125Hours)}</td>
              <td style={{ ...td, color: "#F87171" }}>{fmtH(d.bd.overtime150Hours)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
