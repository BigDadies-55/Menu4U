"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { computeDailyHoursByRole, sumBreakdowns } from "@/lib/hours";
import MonthlyDetailReport from "@/components/attendance/MonthlyDetailReport";
import { type PeriodType, periodRange, prevPeriod, recentPeriods, periodLabel } from "@/lib/attendancePeriod";

// Employee self sign-off of the monthly attendance report — a trimmed, waiter-facing
// version of attendance-manager/SignoffTab. The waiter reviews this month's totals
// and digitally signs that they are accurate; once signed the month is locked.

type AttRecord = { id: string; userId: string; type: string; date: string; timestamp: string };
type Signoff = { userId: string; signatureName: string; signedAt: string };

const GB = "rgba(255,255,255,0.15)";
const GM = "rgba(255,255,255,0.55)";

function fmtDateTime(ts: string): string {
  return new Date(ts).toLocaleString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" });
}

export default function SelfSignoffModal({
  restaurantId, userId, userName, onClose, showToast,
}: {
  restaurantId: string; userId: string; userName: string;
  onClose: () => void; showToast: (msg: string) => void;
}) {
  const [periodType, setPeriodType] = useState<PeriodType>("month");
  const [month, setMonth] = useState(() => prevPeriod("month"));
  const [records, setRecords] = useState<AttRecord[]>([]);
  const [signoffs, setSignoffs] = useState<Signoff[]>([]);
  const [released, setReleased] = useState(false);
  const [loading, setLoading] = useState(false);
  const [signature, setSignature] = useState(userName);
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  const load = useCallback(async () => {
    if (!restaurantId) return;
    const { from, to } = periodRange(periodType, month);
    setLoading(true);
    try {
      const [attRes, sgRes, relRes] = await Promise.all([
        fetch(`/api/admin/attendance?restaurantId=${restaurantId}&from=${from}&to=${to}`),
        fetch(`/api/admin/attendance/signoff?restaurantId=${restaurantId}&month=${month}`),
        fetch(`/api/admin/attendance/month-release?restaurantId=${restaurantId}&month=${month}&periodType=${periodType}`),
      ]);
      const attData = await attRes.json();
      const sgData = await sgRes.json();
      const relData = await relRes.json();
      setRecords((attData.records ?? []).filter((r: AttRecord) => r.type !== "DELETED"));
      setSignoffs(sgData.signoffs ?? []);
      setReleased(!!relData.released);
    } catch { /* ignore */ }
    finally { setLoading(false); setConfirmed(false); }
  }, [restaurantId, month, periodType]);

  useEffect(() => { load(); }, [load]);

  const myTotal = useMemo(() => {
    const mine = records.filter(r => r.userId === userId);
    const byDate: Record<string, AttRecord[]> = {};
    for (const r of mine) (byDate[r.date] ??= []).push(r);
    return sumBreakdowns(Object.values(byDate).map(recs => computeDailyHoursByRole(recs)));
  }, [records, userId]);

  const myRecords = useMemo(() => records.filter(r => r.userId === userId), [records, userId]);
  const mySignoff = signoffs.find(s => s.userId === userId);
  const fmtH = (n: number) => n.toFixed(1);

  async function sign() {
    const sig = signature.trim();
    if (!sig || !confirmed || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/attendance/signoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId, month, periodType,
          netHours: myTotal.netHours, regularHours: myTotal.regularHours,
          ot125Hours: myTotal.overtime125Hours, ot150Hours: myTotal.overtime150Hours,
          payableHours: myTotal.payableUnits, signatureName: sig,
        }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error ?? "שגיאה באישור"); return; }
      showToast(data.alreadySigned ? "הדוח כבר אושר קודם" : "הדוח אושר ונחתם ✓");
      load();
    } finally { setSaving(false); }
  }

  const inputBox: React.CSSProperties = {
    background: "rgba(255,255,255,0.07)", border: `1px solid ${GB}`, borderRadius: 8,
    color: "#fff", padding: "5px 10px", fontSize: 13, fontFamily: "inherit", outline: "none",
  };

  return createPortal(
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 10001, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()} dir="rtl" style={{
        background: "rgba(15,14,22,0.98)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
        border: `1px solid ${GB}`, borderRadius: 18, width: "100%", maxWidth: 560, maxHeight: "88vh", overflowY: "auto",
        boxShadow: "0 20px 60px rgba(0,0,0,0.6)", fontFamily: "'Heebo', sans-serif", color: "#fff",
      }}>
        <div style={{ padding: "18px 22px 14px", borderBottom: `1px solid ${GB}`, display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "rgba(15,14,22,0.98)", borderRadius: "18px 18px 0 0" }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>📝 אישור נוכחות</div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.08)", border: `1px solid ${GB}`, borderRadius: 8, width: 32, height: 32, fontSize: 17, cursor: "pointer", color: "#fff" }}>✕</button>
        </div>

        <div style={{ padding: "16px 22px 22px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,0.06)", border: `1px solid ${GB}`, borderRadius: 9, padding: 3 }}>
              {([["month", "חודשי"], ["week", "שבועי"]] as const).map(([t, lbl]) => (
                <button key={t} onClick={() => { setPeriodType(t); setMonth(prevPeriod(t)); }} style={{ padding: "5px 14px", borderRadius: 7, border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", background: periodType === t ? "rgba(245,158,11,0.25)" : "transparent", color: periodType === t ? "#F59E0B" : GM }}>{lbl}</button>
              ))}
            </div>
            <select value={month} onChange={e => setMonth(e.target.value)} style={{ ...inputBox, cursor: "pointer", colorScheme: "dark" }}>
              {recentPeriods(periodType, periodType === "week" ? 8 : 6).map(p => (
                <option key={p} value={p} style={{ background: "#0f0e16" }}>{periodLabel(periodType, p)}</option>
              ))}
            </select>
            {loading && <span style={{ fontSize: 11, color: GM }}>טוען...</span>}
          </div>

          <div style={{ fontSize: 12, color: GM, marginBottom: 14 }}>בחתימתך הינך מצהיר/ה כי הנתונים משקפים במדויק את שעות עבודתך והפסקותיך ב{periodLabel(periodType, month)}.</div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
            {[
              { label: 'סה"כ נטו', val: `${fmtH(myTotal.netHours)} ש׳`, color: "#FBBF24" },
              { label: "רגיל 100%", val: `${fmtH(myTotal.regularHours)} ש׳`, color: "#fff" },
              { label: "נוספות 125%", val: `${fmtH(myTotal.overtime125Hours)} ש׳`, color: "#FB923C" },
              { label: "נוספות 150%", val: `${fmtH(myTotal.overtime150Hours)} ש׳`, color: "#F87171" },
              { label: "שווה-ערך", val: `${fmtH(myTotal.payableUnits)} ש׳`, color: "#34D399" },
            ].map(c => (
              <div key={c.label} style={{ flex: "1 1 110px", background: "rgba(0,0,0,0.2)", border: `1px solid ${GB}`, borderRadius: 10, padding: "8px 12px" }}>
                <div style={{ fontSize: 11, color: GM, marginBottom: 3 }}>{c.label}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: c.color }}>{c.val}</div>
              </div>
            ))}
          </div>

          <div style={{ marginBottom: 16 }}>
            <button onClick={() => setShowDetail(v => !v)} style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${GB}`, borderRadius: 9, padding: "8px 14px", fontSize: 12, fontWeight: 700, color: "#fff", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}>
              📊 {showDetail ? "הסתר דוח מפורט" : "הצג דוח מפורט"}
            </button>
            {showDetail && <MonthlyDetailReport records={myRecords} />}
          </div>

          {mySignoff ? (
            <div style={{ background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.35)", borderRadius: 12, padding: "14px 16px", color: "#34D399" }}>
              <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>✓ הדוח אושר ונחתם</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>חתימה: {mySignoff.signatureName} · {fmtDateTime(mySignoff.signedAt)}</div>
            </div>
          ) : !released ? (
            <div style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.35)", borderRadius: 12, padding: "14px 16px", color: "#FBBF24" }}>
              <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>⏳ הדוח טרם אושר ע״י המנהל</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>ניתן יהיה לחתום על {periodLabel(periodType, month)} רק לאחר שהמנהל יסיים לעדכן ויאשר את הדוח.</div>
            </div>
          ) : (
            <>
              <label style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 12, cursor: "pointer", fontSize: 13, color: "rgba(255,255,255,0.85)" }}>
                <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} style={{ marginTop: 3, accentColor: "#F59E0B", width: 16, height: 16, cursor: "pointer" }} />
                <span>אני מאשר/ת שהנתונים שלעיל נכונים ומשקפים את שעות עבודתי והפסקותיי בפועל.</span>
              </label>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <input value={signature} onChange={e => setSignature(e.target.value)} placeholder="חתימה דיגיטלית (שם מלא)" style={{ ...inputBox, flex: "1 1 220px", padding: "9px 12px" }} />
                <button onClick={sign} disabled={!confirmed || !signature.trim() || saving} style={{ padding: "10px 22px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#D97706,#F59E0B)", color: "#fff", fontWeight: 800, fontSize: 14, cursor: confirmed && signature.trim() ? "pointer" : "not-allowed", fontFamily: "inherit", opacity: (!confirmed || !signature.trim() || saving) ? 0.5 : 1 }}>
                  {saving ? "חותם..." : "מאשר וחותם"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
