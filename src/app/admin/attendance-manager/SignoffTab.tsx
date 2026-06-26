"use client";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { computeDailyHoursByRole, sumBreakdowns } from "@/lib/hours";
import {
  GB, GM, ACCENT_GRAD, monthRange, fmtDateTime,
  type AttRecord, type StaffMember,
} from "./attendanceShared";
import MonthlyDetailReport from "@/components/attendance/MonthlyDetailReport";

interface Props {
  restaurantId: string;
  staff: StaffMember[];
  isManager: boolean;
  currentUserId: string;
  currentUserName: string;
  showToast: (msg: string) => void;
}

type Signoff = {
  id: string; userId: string; userName: string | null; month: string;
  netHours: number; regularHours: number; ot125Hours: number; ot150Hours: number; payableHours: number;
  signatureName: string; signedAt: string;
};

// Step 3 — Employee monthly sign-off. The employee reviews the month's totals and
// digitally signs that they are accurate; once signed it is locked. Managers see a
// roster of who has / hasn't signed.
// Employees sign the previous (just-ended) month, not the current one.
function prevMonthStr() {
  const n = new Date();
  const d = new Date(n.getFullYear(), n.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function SignoffTab({ restaurantId, staff, isManager, currentUserId, currentUserName, showToast }: Props) {
  const [month, setMonth] = useState(prevMonthStr);
  const [records, setRecords] = useState<AttRecord[]>([]);
  const [signoffs, setSignoffs] = useState<Signoff[]>([]);
  const [released, setReleased] = useState(false);
  const [releaseBusy, setReleaseBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [signature, setSignature] = useState(currentUserName);
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  const load = useCallback(async () => {
    if (!restaurantId) return;
    const { from, to } = monthRange(month);
    setLoading(true);
    try {
      const [attRes, sgRes, relRes] = await Promise.all([
        fetch(`/api/admin/attendance?restaurantId=${restaurantId}&from=${from}&to=${to}`),
        fetch(`/api/admin/attendance/signoff?restaurantId=${restaurantId}&month=${month}`),
        fetch(`/api/admin/attendance/month-release?restaurantId=${restaurantId}&month=${month}`),
      ]);
      const attData = await attRes.json();
      const sgData = await sgRes.json();
      const relData = await relRes.json();
      setRecords((attData.records ?? []).filter((r: AttRecord) => r.type !== "DELETED"));
      setSignoffs(sgData.signoffs ?? []);
      setReleased(!!relData.released);
    } catch { /* ignore */ }
    finally { setLoading(false); setConfirmed(false); }
  }, [restaurantId, month]);

  useEffect(() => { load(); }, [load]);

  // My own monthly total (for the sign-off card).
  const myTotal = useMemo(() => {
    const mine = records.filter(r => r.userId === currentUserId);
    const byDate: Record<string, AttRecord[]> = {};
    for (const r of mine) (byDate[r.date] ??= []).push(r);
    return sumBreakdowns(Object.values(byDate).map(recs => computeDailyHoursByRole(recs)));
  }, [records, currentUserId]);

  const myRecords = useMemo(() => records.filter(r => r.userId === currentUserId), [records, currentUserId]);
  const mySignoff = signoffs.find(s => s.userId === currentUserId);
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
          restaurantId, month,
          netHours: myTotal.netHours, regularHours: myTotal.regularHours,
          ot125Hours: myTotal.overtime125Hours, ot150Hours: myTotal.overtime150Hours,
          payableHours: myTotal.payableUnits, signatureName: sig,
        }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error ?? "שגיאה באישור"); return; }
      showToast(data.alreadySigned ? "הדוח כבר אושר קודם" : "✓ הדוח אושר ונחתם");
      load();
    } finally { setSaving(false); }
  }

  async function toggleRelease() {
    if (releaseBusy) return;
    setReleaseBusy(true);
    try {
      const res = await fetch(`/api/admin/attendance/month-release${released ? `?restaurantId=${restaurantId}&month=${month}` : ""}`, {
        method: released ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: released ? undefined : JSON.stringify({ restaurantId, month }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error ?? "שגיאה"); return; }
      showToast(released ? "הדוח נפתח מחדש לעריכה" : "✓ הדוח אושר — נפתחה חתימה לעובדים");
      load();
    } finally { setReleaseBusy(false); }
  }

  const monthLabel = month;
  const inputBox: React.CSSProperties = {
    background: "rgba(255,255,255,0.07)", border: `1px solid ${GB}`, borderRadius: 8,
    color: "#fff", padding: "5px 10px", fontSize: 12, fontFamily: "inherit", outline: "none",
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, color: GM }}>חודש לאישור:</span>
        <input type="month" value={month} max={prevMonthStr()} onChange={e => setMonth(e.target.value)} style={{ ...inputBox, cursor: "pointer", colorScheme: "dark" }} />
        {loading && <span style={{ fontSize: 11, color: GM }}>טוען...</span>}
      </div>

      {/* Manager release gate — only after release can employees sign */}
      {isManager && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", background: released ? "rgba(52,211,153,0.08)" : "rgba(251,191,36,0.08)", border: `1px solid ${released ? "rgba(52,211,153,0.3)" : "rgba(251,191,36,0.3)"}`, borderRadius: 12, padding: "12px 16px", marginBottom: 16, maxWidth: 640 }}>
          <div style={{ flex: "1 1 240px" }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: released ? "#34D399" : "#FBBF24" }}>{released ? "✓ הדוח אושר — עובדים יכולים לחתום" : "⏳ הדוח טרם אושר לחתימה"}</div>
            <div style={{ fontSize: 11, color: GM, marginTop: 2 }}>{released ? `סיים לעדכן? אפשר לפתוח מחדש לעריכה.` : `סיים לעדכן את דוח ${monthLabel}, ואז אשר כדי לפתוח חתימה לעובדים.`}</div>
          </div>
          <button onClick={toggleRelease} disabled={releaseBusy} style={{ padding: "9px 18px", borderRadius: 10, border: "none", background: released ? "rgba(255,255,255,0.1)" : ACCENT_GRAD, color: "#fff", fontWeight: 800, fontSize: 13, cursor: releaseBusy ? "wait" : "pointer", fontFamily: "inherit", opacity: releaseBusy ? 0.6 : 1 }}>
            {releaseBusy ? "..." : released ? "פתח מחדש לעריכה" : "אשר דוח חודשי"}
          </button>
        </div>
      )}

      {/* My sign-off card */}
      <div style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${GB}`, borderRadius: 16, padding: 20, marginBottom: 18, maxWidth: 640 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", marginBottom: 4 }}>📝 אישור דוח נוכחות חודשי</div>
        <div style={{ fontSize: 12, color: GM, marginBottom: 16 }}>בחתימתך הינך מצהיר/ה כי הנתונים משקפים במדויק את שעות עבודתך והפסקותיך בחודש {monthLabel}.</div>

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
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>ניתן יהיה לחתום על דוח {monthLabel} רק לאחר אישור המנהל.</div>
          </div>
        ) : (
          <>
            <label style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 12, cursor: "pointer", fontSize: 13, color: "rgba(255,255,255,0.85)" }}>
              <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} style={{ marginTop: 3, accentColor: "#F59E0B", width: 16, height: 16, cursor: "pointer" }} />
              <span>אני מאשר/ת שהנתונים שלעיל נכונים ומשקפים את שעות עבודתי והפסקותיי בפועל.</span>
            </label>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <input value={signature} onChange={e => setSignature(e.target.value)} placeholder="חתימה דיגיטלית (שם מלא)" style={{ ...inputBox, flex: "1 1 220px", padding: "9px 12px", fontSize: 13 }} />
              <button onClick={sign} disabled={!confirmed || !signature.trim() || saving} style={{ padding: "10px 22px", borderRadius: 10, border: "none", background: ACCENT_GRAD, color: "#fff", fontWeight: 800, fontSize: 14, cursor: confirmed && signature.trim() ? "pointer" : "not-allowed", fontFamily: "inherit", opacity: (!confirmed || !signature.trim() || saving) ? 0.5 : 1, boxShadow: "0 4px 14px rgba(217,119,6,0.35)" }}>
                {saving ? "חותם..." : "מאשר וחותם"}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Manager roster */}
      {isManager && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#fff", marginBottom: 8 }}>סטטוס אישורים — {monthLabel}</div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["עובד", "סטטוס", "נטו שאושר", "חתימה", "מתי"].map(h => (
                  <th key={h} style={{ fontSize: 11, fontWeight: 700, color: GM, textAlign: "right", padding: "6px 10px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {staff.map(member => {
                const sg = signoffs.find(s => s.userId === member.id);
                return (
                  <tr key={member.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <td style={{ padding: "6px 10px", fontSize: 13, color: "#fff", fontWeight: 600 }}>{member.name}</td>
                    <td style={{ padding: "6px 10px" }}>
                      <span style={{ background: sg ? "rgba(52,211,153,0.15)" : "rgba(255,255,255,0.06)", color: sg ? "#34D399" : GM, borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>{sg ? "✓ אושר" : "ממתין"}</span>
                    </td>
                    <td style={{ padding: "6px 10px", fontSize: 12, color: "rgba(255,255,255,0.65)" }}>{sg ? `${sg.netHours.toFixed(1)} ש׳` : "–"}</td>
                    <td style={{ padding: "6px 10px", fontSize: 12, color: "rgba(255,255,255,0.65)" }}>{sg?.signatureName ?? "–"}</td>
                    <td style={{ padding: "6px 10px", fontSize: 12, color: GM, whiteSpace: "nowrap" }}>{sg ? fmtDateTime(sg.signedAt) : "–"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
