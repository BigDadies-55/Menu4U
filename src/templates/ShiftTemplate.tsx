"use client";
/**
 * TEMPLATE: Shift Manager — "Mission Control"
 *
 * Innovation vs. current:
 *  - Floor map is the ENTIRE screen (no sidebar stealing space)
 *  - Tables show rich live info: timer arc + course dots + guest count
 *  - Floating glass KPI bar at top (semi-transparent, always visible)
 *  - Bottom command drawer (slides up) with 3 tabs:
 *      🔥 Expediter | ⏳ Waitlist | 📊 Summary
 *  - Table tap → floating detail card (not a side panel)
 *  - Color-coded heat intensity on occupied tables (cold → hot by duration)
 *  - SLA-breached tables pulse with red shadow
 *
 * Mock data inlined — replace with real state.
 */
import React, { useState, useEffect, useRef } from "react";
import { T } from "@/lib/ui";

// ── Types ──────────────────────────────────────────────────
type TableStatus = "free" | "occupied" | "bill" | "seated";
type MockTable   = {
  id: string; num: number; x: number; y: number; w: number; h: number;
  status: TableStatus; guests: number; sinceMin: number;
  waiter: string; courses: ("done" | "firing" | "held" | "none")[];
};
type HeldCourse  = { tableNum: number; course: number; items: string[]; count: number };
type WaitParty   = { id: string; name: string; guests: number; sinceMin: number };

// ── Mock data ──────────────────────────────────────────────
const MOCK_TABLES: MockTable[] = [
  { id:"t1",  num:1,  x:30,  y:30,  w:80, h:70, status:"free",     guests:0, sinceMin:0,  waiter:"דניאל", courses:["none","none","none"] },
  { id:"t2",  num:2,  x:130, y:30,  w:80, h:70, status:"occupied", guests:4, sinceMin:42, waiter:"מיכל",  courses:["done","firing","held"] },
  { id:"t3",  num:3,  x:230, y:30,  w:80, h:70, status:"occupied", guests:2, sinceMin:18, waiter:"דניאל", courses:["done","done","none"] },
  { id:"t4",  num:4,  x:330, y:30,  w:80, h:70, status:"bill",     guests:6, sinceMin:61, waiter:"אריאל", courses:["done","done","done"] },
  { id:"t5",  num:5,  x:430, y:30,  w:80, h:70, status:"free",     guests:0, sinceMin:0,  waiter:"מיכל",  courses:["none","none","none"] },
  { id:"t6",  num:6,  x:30,  y:130, w:80, h:70, status:"occupied", guests:3, sinceMin:8,  waiter:"אריאל", courses:["firing","none","none"] },
  { id:"t7",  num:7,  x:130, y:130, w:80, h:70, status:"occupied", guests:5, sinceMin:35, waiter:"דניאל", courses:["done","held","none"] },
  { id:"t8",  num:8,  x:230, y:130, w:80, h:70, status:"seated",   guests:2, sinceMin:3,  waiter:"מיכל",  courses:["none","none","none"] },
  { id:"t9",  num:9,  x:330, y:130, w:80, h:70, status:"free",     guests:0, sinceMin:0,  waiter:"אריאל", courses:["none","none","none"] },
  { id:"t10", num:10, x:430, y:130, w:80, h:70, status:"occupied", guests:4, sinceMin:52, waiter:"דניאל", courses:["done","done","held"] },
  { id:"t11", num:11, x:30,  y:230, w:80, h:70, status:"occupied", guests:2, sinceMin:14, waiter:"מיכל",  courses:["done","none","none"] },
  { id:"t12", num:12, x:130, y:230, w:80, h:70, status:"free",     guests:0, sinceMin:0,  waiter:"אריאל", courses:["none","none","none"] },
  { id:"t13", num:13, x:230, y:230, w:80, h:70, status:"bill",     guests:3, sinceMin:48, waiter:"דניאל", courses:["done","done","done"] },
  { id:"t14", num:14, x:330, y:230, w:80, h:70, status:"occupied", guests:6, sinceMin:27, waiter:"מיכל",  courses:["done","firing","none"] },
  { id:"t15", num:15, x:430, y:230, w:80, h:70, status:"free",     guests:0, sinceMin:0,  waiter:"אריאל", courses:["none","none","none"] },
];
const MOCK_HELD: HeldCourse[] = [
  { tableNum: 2,  course: 3, items: ["קרם ברולה", "פונדן שוקולד"], count: 2 },
  { tableNum: 7,  course: 2, items: ["אנטריקוט 300g", "פרגית גריל", "פילה סלמון"], count: 3 },
  { tableNum: 10, course: 3, items: ["פנה קוטה"], count: 1 },
];
const MOCK_WAITLIST: WaitParty[] = [
  { id:"w1", name: "משפחת לוי",    guests: 4, sinceMin: 22 },
  { id:"w2", name: "קבוצת רונן",   guests: 8, sinceMin: 11 },
  { id:"w3", name: "יעל + 2",       guests: 3, sinceMin: 4  },
];
const KPI = {
  revenue: 6840, orders: 31, freeTables: 5, totalTables: 15,
  slaBreached: 3, avgWait: 8,
};

// ── Status config ──────────────────────────────────────────
const STATUS_CFG: Record<TableStatus, { stripe: string; glow: string; label: string }> = {
  free:     { stripe: T.green,  glow: `rgba(34,197,94,0.15)`,  label: "פנוי"   },
  occupied: { stripe: T.orange, glow: `rgba(249,115,22,0.15)`, label: "תפוס"   },
  bill:     { stripe: T.red,    glow: `rgba(239,68,68,0.15)`,  label: "חשבון"  },
  seated:   { stripe: "#a78bfa",glow: `rgba(167,139,250,0.12)`,label: "הושב"   },
};

// Heat color for occupied tables (cool → warm by minutes)
function heatColor(mins: number): string {
  if (mins < 20) return T.orange;
  if (mins < 40) return "#fb923c";
  return "#ef4444";
}

// Course dot colors
const COURSE_DOT: Record<string, string> = {
  done:    T.green,
  firing:  T.orange,
  held:    "#facc15",
  none:    "#2a1a0a",
};
const COURSE_LABELS = ["ר", "ע", "ק"];

// ── SVG timer arc ──────────────────────────────────────────
function TimerArc({ mins, sla = 45, r = 30 }: { mins: number; sla?: number; r?: number }) {
  const pct    = Math.min(1, mins / sla);
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - pct);
  const color  = pct < 0.6 ? T.green : pct < 0.85 ? T.yellow : T.red;
  const cx = r + 4; const cy = r + 4;
  return (
    <svg width={cx * 2} height={cy * 2} style={{ position: "absolute", top: 0, left: 0, opacity: 0.7, pointerEvents: "none" }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={`${color}22`} strokeWidth={3} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={3}
        strokeDasharray={circumference} strokeDashoffset={offset}
        strokeLinecap="round" transform={`rotate(-90 ${cx} ${cy})`} />
    </svg>
  );
}

// ── Main component ─────────────────────────────────────────
export default function ShiftTemplate() {
  const [tick, setTick]           = useState(0);
  const [drawerTab, setDrawerTab] = useState<"expediter" | "waitlist" | "summary">("expediter");
  const [drawerH, setDrawerH]     = useState<"peek" | "open">("peek");
  const [selected, setSelected]   = useState<MockTable | null>(null);
  const [firingKey, setFiringKey] = useState("");
  const [waitlist, setWaitlist]   = useState<WaitParty[]>(MOCK_WAITLIST);
  const [pulse, setPulse]         = useState(false);
  const sla = 45;

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const id = setInterval(() => setPulse(p => !p), 1800);
    return () => clearInterval(id);
  }, []);

  async function fireHeld(h: HeldCourse) {
    const key = `${h.tableNum}:${h.course}`;
    setFiringKey(key);
    await new Promise(r => setTimeout(r, 1200));
    setFiringKey("");
  }

  const COURSE_LBLS = ["", "ראשון", "עיקרי", "קינוח"];
  const COURSE_EMOJ = ["", "🥗", "🍖", "🍮"];

  return (
    <div style={{
      height: "calc(100vh - 64px)", background: T.bg, color: T.text,
      fontFamily: "system-ui,sans-serif", direction: "rtl",
      position: "relative", overflow: "hidden",
    }}>
      <style>{`
        @keyframes sla-pulse { 0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0)} 50%{box-shadow:0 0 0 6px rgba(239,68,68,0.35)} }
        @keyframes drawer-peek { from{transform:translateY(100%)} to{transform:translateY(0)} }
      `}</style>

      {/* ── Floating glass KPI bar ──────────────────────── */}
      <div style={{
        position: "absolute", top: 0, right: 0, left: 0, zIndex: 50,
        padding: "10px 20px",
        background: "rgba(10,4,2,0.78)", backdropFilter: "blur(14px)",
        borderBottom: `1px solid rgba(212,160,23,0.12)`,
        display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
      }}>
        <span style={{ fontSize: 14, fontWeight: 900, color: T.gold, marginLeft: 6 }}>🎯 Mission Control</span>
        <div style={{ width: 1, height: 20, background: T.border }} />
        {[
          { label: "הכנסה", value: `₪${KPI.revenue.toLocaleString()}`, color: T.gold   },
          { label: "הזמנות", value: KPI.orders,                         color: T.blue   },
          { label: "פנויים", value: `${KPI.freeTables}/${KPI.totalTables}`, color: T.green  },
          { label: "SLA",    value: KPI.slaBreached,                    color: KPI.slaBreached ? T.red : T.green },
          { label: "המתנה",  value: waitlist.length,                    color: waitlist.length ? T.orange : T.muted },
        ].map(k => (
          <div key={k.label} style={{ padding: "4px 12px", borderRadius: T.rFull, background: `${k.color}14`, border: `1px solid ${k.color}30`, display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 15, fontWeight: 900, color: k.color }}>{k.value}</span>
            <span style={{ fontSize: 11, color: T.muted }}>{k.label}</span>
          </div>
        ))}
        <div style={{ marginRight: "auto", display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: T.green, opacity: pulse ? 1 : 0.35, transition: "opacity 0.4s" }} />
          <span style={{ fontSize: 11, color: T.green, fontWeight: 700 }}>LIVE</span>
        </div>
      </div>

      {/* ── Floor canvas (full screen) ──────────────────── */}
      <div style={{ position: "absolute", inset: 0, top: 52, bottom: drawerH === "open" ? 340 : 52, overflow: "auto", padding: 20 }}>
        <div style={{ position: "relative", width: 540, height: 330 }}>
          {MOCK_TABLES.map(t => {
            const cfg    = STATUS_CFG[t.status];
            const heat   = t.status === "occupied" ? heatColor(t.sinceMin) : cfg.stripe;
            const breached = t.status === "occupied" && t.sinceMin >= sla;
            const isSelected = selected?.id === t.id;
            return (
              <div
                key={t.id}
                onClick={() => setSelected(selected?.id === t.id ? null : t)}
                style={{
                  position: "absolute", left: t.x, top: t.y, width: t.w, height: t.h,
                  borderRadius: 10, overflow: "hidden", cursor: "pointer",
                  background: "#0e0c0a",
                  border: `${isSelected ? 2 : 1.5}px solid ${isSelected ? T.gold : heat + "88"}`,
                  boxShadow: breached
                    ? undefined
                    : isSelected ? `0 0 0 2px ${T.gold}55` : `0 0 12px ${cfg.glow}`,
                  animation: breached ? "sla-pulse 1.2s infinite" : undefined,
                  transition: "border-color 0.3s",
                  display: "flex", flexDirection: "column",
                }}
              >
                {/* Top stripe */}
                <div style={{ height: 3, background: heat, flexShrink: 0 }} />

                {/* Timer arc (absolute, decorative) */}
                {t.status === "occupied" && t.sinceMin > 0 && (
                  <TimerArc mins={t.sinceMin} sla={sla} r={26} />
                )}

                {/* Body */}
                <div style={{ flex: 1, padding: "6px 8px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  {/* Top: badge + table num */}
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                    <div style={{ background: `${heat}22`, borderRadius: T.rFull, padding: "1px 6px", fontSize: 9, fontWeight: 700, color: heat }}>{cfg.label}</div>
                    {t.status !== "free" && t.guests > 0 && (
                      <span style={{ fontSize: 9, color: T.muted }}>👤{t.guests}</span>
                    )}
                  </div>

                  {/* Center: table number */}
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", lineHeight: 1 }}>שולחן</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: "#fff", lineHeight: 1 }}>{t.num}</div>
                  </div>

                  {/* Bottom: course dots + timer */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                    <div style={{ display: "flex", gap: 3 }}>
                      {t.courses.map((c, i) => (
                        <div key={i} title={COURSE_LBLS[i+1]} style={{
                          width: 10, height: 10, borderRadius: "50%", background: COURSE_DOT[c],
                          border: `1px solid ${COURSE_DOT[c] === "#2a1a0a" ? "#3a2a1a" : "transparent"}`,
                        }} />
                      ))}
                    </div>
                    {t.status === "occupied" && (
                      <span style={{ fontSize: 9, fontWeight: 700, color: breached ? "#fca5a5" : "#fcd34d", fontVariantNumeric: "tabular-nums" }}>
                        {t.sinceMin}′
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Legend ──────────────────────────────────────── */}
      <div style={{ position: "absolute", bottom: drawerH === "open" ? 348 : 60, right: 16, display: "flex", flexDirection: "column", gap: 5, zIndex: 40 }}>
        {/* Course dot legend */}
        <div style={{ background: "rgba(0,0,0,0.75)", borderRadius: T.rMd, padding: "8px 10px", backdropFilter: "blur(6px)", display: "flex", flexDirection: "column", gap: 4 }}>
          {[["done","✓"],["firing","יוצא"],["held","ממתין"],["none","—"]].map(([s,l]) => (
            <div key={s} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 9 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: COURSE_DOT[s] }} />
              <span style={{ color: T.muted }}>{l}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Table detail floating card ──────────────────── */}
      {selected && (
        <div style={{
          position: "absolute", top: 62, right: 16, zIndex: 80, width: 210,
          background: "rgba(22,8,5,0.96)", backdropFilter: "blur(12px)",
          border: `1px solid ${T.gold}55`, borderRadius: T.rXl,
          padding: 16, display: "flex", flexDirection: "column", gap: 10,
          boxShadow: "0 8px 32px rgba(0,0,0,0.7)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 18, fontWeight: 900, color: T.gold }}>שולחן {selected.num}</span>
            <div style={{ background: `${STATUS_CFG[selected.status].stripe}22`, borderRadius: T.rFull, padding: "1px 8px", fontSize: 10, fontWeight: 700, color: STATUS_CFG[selected.status].stripe }}>
              {STATUS_CFG[selected.status].label}
            </div>
            <button onClick={() => setSelected(null)} style={{ marginRight: "auto", background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 18 }}>✕</button>
          </div>
          {selected.status !== "free" && (
            <>
              <div style={{ display: "flex", gap: 16 }}>
                <div><div style={{ fontSize: 18, fontWeight: 900, color: T.text }}>{selected.guests}</div><div style={{ fontSize: 10, color: T.muted }}>אורחים</div></div>
                <div><div style={{ fontSize: 18, fontWeight: 900, color: selected.sinceMin >= sla ? T.red : T.gold }}>{selected.sinceMin}′</div><div style={{ fontSize: 10, color: T.muted }}>זמן שהייה</div></div>
                <div><div style={{ fontSize: 13, fontWeight: 700, color: T.sub }}>{selected.waiter}</div><div style={{ fontSize: 10, color: T.muted }}>מלצר</div></div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: T.muted, marginBottom: 6 }}>מצב קורסים</div>
                <div style={{ display: "flex", gap: 8 }}>
                  {selected.courses.map((c, i) => (
                    <div key={i} style={{ flex: 1, textAlign: "center" }}>
                      <div style={{ fontSize: 14 }}>{COURSE_EMOJ[i+1]}</div>
                      <div style={{ width: 12, height: 12, borderRadius: "50%", background: COURSE_DOT[c], margin: "4px auto 0" }} />
                      <div style={{ fontSize: 9, color: T.muted, marginTop: 2 }}>{COURSE_LBLS[i+1]}</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
          <div style={{ display: "flex", gap: 6 }}>
            <button style={{ flex: 1, padding: "7px 0", borderRadius: T.rMd, background: T.gold, border: "none", color: "#000", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>💰 חשבון</button>
            <button style={{ flex: 1, padding: "7px 0", borderRadius: T.rMd, background: T.overlay, border: `1px solid ${T.border}`, color: T.sub, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>📋 פרטים</button>
          </div>
        </div>
      )}

      {/* ── Bottom command drawer ───────────────────────── */}
      <div style={{
        position: "absolute", bottom: 0, right: 0, left: 0, zIndex: 60,
        background: "rgba(16,6,3,0.97)", backdropFilter: "blur(14px)",
        borderTop: `1px solid ${T.border}`,
        borderTopLeftRadius: drawerH === "open" ? T.rXl : 0,
        borderTopRightRadius: drawerH === "open" ? T.rXl : 0,
        transition: "height 0.3s ease",
        height: drawerH === "open" ? 340 : 52,
        display: "flex", flexDirection: "column", overflow: "hidden",
      }}>
        {/* Drawer tabs / peek bar */}
        <div
          onClick={() => setDrawerH(h => h === "peek" ? "open" : "peek")}
          style={{ padding: "0 20px", height: 52, display: "flex", alignItems: "center", gap: 8, cursor: "pointer", flexShrink: 0 }}
        >
          <div style={{ width: 36, height: 4, borderRadius: 2, background: T.border, margin: "0 auto", position: "absolute", right: "calc(50% - 18px)" }} />
          {(["expediter","waitlist","summary"] as const).map(tab => {
            const labels = { expediter: `🔥 להוצאה (${MOCK_HELD.length})`, waitlist: `⏳ המתנה (${waitlist.length})`, summary: "📊 סטטוס" };
            return (
              <button key={tab} onClick={e => { e.stopPropagation(); setDrawerTab(tab); setDrawerH("open"); }} style={{
                padding: "5px 14px", borderRadius: T.rFull, border: `1px solid ${drawerTab === tab && drawerH === "open" ? T.gold : T.border}`,
                background: drawerTab === tab && drawerH === "open" ? `${T.gold}18` : "transparent",
                color: drawerTab === tab && drawerH === "open" ? T.gold : T.muted,
                fontSize: 12, fontWeight: 700, cursor: "pointer",
              }}>{labels[tab]}</button>
            );
          })}
          <div style={{ marginRight: "auto", fontSize: 16, color: T.muted }}>{drawerH === "open" ? "⌄" : "⌃"}</div>
        </div>

        {/* Drawer content */}
        {drawerH === "open" && (
          <div style={{ flex: 1, overflowY: "auto", padding: "0 20px 16px" }}>

            {/* ── Expediter ── */}
            {drawerTab === "expediter" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {MOCK_HELD.map(h => {
                  const key    = `${h.tableNum}:${h.course}`;
                  const firing = firingKey === key;
                  return (
                    <div key={key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: T.surface, borderRadius: T.rLg, border: `1px solid ${T.border}` }}>
                      <div style={{ fontSize: 28 }}>{COURSE_EMOJ[h.course]}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>
                          שולחן {h.tableNum} — {COURSE_LBLS[h.course]}
                        </div>
                        <div style={{ fontSize: 11, color: T.muted }}>{h.count}× {h.items.join(", ")}</div>
                      </div>
                      <button
                        onClick={() => fireHeld(h)}
                        disabled={firing}
                        style={{
                          padding: "8px 20px", borderRadius: T.rMd, border: "none",
                          background: firing ? T.overlay : T.orange,
                          color: firing ? T.muted : "#fff",
                          fontWeight: 900, fontSize: 16, cursor: firing ? "default" : "pointer",
                          transition: "background 0.2s",
                        }}
                      >
                        {firing ? "..." : "🔥"}
                      </button>
                    </div>
                  );
                })}
                {MOCK_HELD.length === 0 && <div style={{ textAlign: "center", color: T.muted, padding: 32, fontSize: 13 }}>✓ אין קורסים ממתינים</div>}
              </div>
            )}

            {/* ── Waitlist ── */}
            {drawerTab === "waitlist" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {waitlist.map((p, i) => {
                  const urgent = p.sinceMin >= 20;
                  return (
                    <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: urgent ? `${T.red}0a` : T.surface, borderRadius: T.rLg, border: `1px solid ${urgent ? T.red + "44" : T.border}` }}>
                      <span style={{ fontSize: 20, fontWeight: 900, color: T.muted, minWidth: 24 }}>#{i+1}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: urgent ? T.red : T.muted }}>👤{p.guests} · {p.sinceMin}′ {urgent ? "⚠️" : ""}</div>
                      </div>
                      <button onClick={() => setWaitlist(w => w.filter(x => x.id !== p.id))} style={{ padding: "6px 16px", borderRadius: T.rMd, background: T.green, border: "none", color: "#000", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>הושב</button>
                    </div>
                  );
                })}
                {waitlist.length === 0 && <div style={{ textAlign: "center", color: T.muted, padding: 32, fontSize: 13 }}>אין ממתינים</div>}
              </div>
            )}

            {/* ── Summary ── */}
            {drawerTab === "summary" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                {[
                  { label: "הכנסה היום", value: `₪${KPI.revenue.toLocaleString()}`, color: T.gold   },
                  { label: "הזמנות",     value: KPI.orders,                          color: T.blue   },
                  { label: "פנויים",     value: `${KPI.freeTables}/${KPI.totalTables}`, color: T.green  },
                  { label: "SLA חריגות", value: KPI.slaBreached,                    color: KPI.slaBreached ? T.red : T.green },
                  { label: "ממוצע המתנה", value: `${KPI.avgWait}′`,                color: T.sub    },
                  { label: "ממתינים",    value: waitlist.length,                    color: waitlist.length ? T.orange : T.muted },
                ].map(k => (
                  <div key={k.label} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.rLg, padding: "14px 16px", textAlign: "center" }}>
                    <div style={{ fontSize: 24, fontWeight: 900, color: k.color }}>{k.value}</div>
                    <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>{k.label}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
