"use client";
/**
 * TEMPLATE: Dashboard — "Command Center"
 *
 * Innovation vs. current:
 *  - Bento grid layout (asymmetric, content-driven sizing)
 *  - Revenue hero with animated pulse + trend vs. yesterday
 *  - Live order pipeline (visual horizontal funnel)
 *  - Mini floor heat-map (dot grid, color = table status)
 *  - Insight strip (AI-style contextual alerts)
 *  - Live activity feed (right column)
 *  - Glassmorphism top bar with greeting + clock
 *
 * Mock data is inlined — replace with real API calls.
 */
import React, { useState, useEffect } from "react";
import { T } from "@/lib/ui";

// ── Mock data ─────────────────────────────────────────────
const MOCK = {
  managerName: "יוסי",
  revenue:     { today: 6840, yesterday: 6100 },
  pipeline:    { waiting: 4, preparing: 7, ready: 2, paid: 31 },
  tables:      { total: 24, free: 8, occupied: 13, bill: 3 },
  slaBreached: 2,
  avgWait:     8,
  team: [
    { name: "דניאל", role: "מלצר", active: true,  orders: 9  },
    { name: "מיכל",  role: "מלצרית", active: true, orders: 11 },
    { name: "אריאל", role: "מלצר",  active: true,  orders: 6  },
    { name: "ליהי",  role: "מטבח",  active: true,  orders: 0  },
    { name: "רון",   role: "מנהל",  active: false, orders: 0  },
  ],
  feed: [
    { time: "19:52", text: "שולחן 7 — ביקש חשבון", color: "#ef4444" },
    { time: "19:48", text: "שולחן 12 — הזמנה חדשה (₪320)", color: "#22c55e" },
    { time: "19:44", text: "שולחן 3 — קורס עיקרי הוצת", color: "#f97316" },
    { time: "19:41", text: "שולחן 9 — נסגר · ₪580", color: "#a78bfa" },
    { time: "19:38", text: "שולחן 5 — Comp מאושר (₪45)", color: "#facc15" },
    { time: "19:31", text: "שולחן 2 — הזמנה חדשה (₪210)", color: "#22c55e" },
    { time: "19:25", text: "פריט '86': נתחי עוף", color: "#ef4444" },
  ],
  insights: [
    { icon: "📈", text: "הקצב הנוכחי צפוי לשיא שבועי — עוד ₪1,200 לשיא" },
    { icon: "⚠️", text: `${2} שולחנות חרגו SLA — שולחן 4 ממתין 54 דק'` },
    { icon: "🔥", text: "הפריט הנמכר ביותר הערב: פילה סלמון (×18)" },
  ],
  floorGrid: [
    // status: 0=empty slot, 1=free, 2=occupied, 3=bill
    [0,1,2,2,1,0],
    [1,2,2,3,2,1],
    [0,2,0,2,1,0],
    [1,2,2,2,0,1],
  ],
};

const TABLE_DOT: Record<number, string> = {
  0: "transparent",
  1: T.green,
  2: T.orange,
  3: T.red,
};

// ── Sparkline (pure SVG) ───────────────────────────────────
function Sparkline({ values, color }: { values: number[]; color: string }) {
  const h = 36; const w = 120;
  const max = Math.max(...values); const min = Math.min(...values);
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / (max - min || 1)) * h;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ── Pipeline bar ───────────────────────────────────────────
function PipelineBar({ label, count, color, total }: { label: string; count: number; color: string; total: number }) {
  const pct = Math.max(4, (count / total) * 100);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flex: 1 }}>
      <div style={{ width: "100%", background: `${color}22`, borderRadius: T.rMd, height: 8, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", right: 0, top: 0, height: "100%", width: `${pct}%`, background: color, borderRadius: T.rMd, transition: "width 0.6s ease" }} />
      </div>
      <div style={{ fontSize: 22, fontWeight: 900, color }}>{count}</div>
      <div style={{ fontSize: 10, color: T.muted, textAlign: "center" }}>{label}</div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────
export default function DashboardTemplate() {
  const [now, setNow] = useState(new Date());
  const [insightIdx, setInsightIdx] = useState(0);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const id = setInterval(() => setInsightIdx(i => (i + 1) % MOCK.insights.length), 5000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const id = setInterval(() => setPulse(p => !p), 2000);
    return () => clearInterval(id);
  }, []);

  const revDiff  = MOCK.revenue.today - MOCK.revenue.yesterday;
  const revPct   = Math.round((revDiff / MOCK.revenue.yesterday) * 100);
  const hour     = now.getHours();
  const greeting = hour < 12 ? "בוקר טוב" : hour < 17 ? "צהריים טובים" : "ערב טוב";
  const pipelineTotal = Object.values(MOCK.pipeline).reduce((a, b) => a + b, 0);
  const sparkValues   = [3100, 3400, 3200, 3800, 4200, 5100, 5600, 6100, 6840];

  return (
    <div style={{
      height: "calc(100vh - 64px)", background: T.bg, color: T.text,
      fontFamily: "system-ui,sans-serif", direction: "rtl",
      display: "flex", flexDirection: "column", overflow: "hidden",
    }}>

      {/* ── Glass top bar ─────────────────────────────────── */}
      <div style={{
        padding: "14px 28px", display: "flex", alignItems: "center", gap: 12,
        background: "rgba(22,8,5,0.85)", backdropFilter: "blur(12px)",
        borderBottom: `1px solid ${T.border}`, flexShrink: 0,
      }}>
        <div>
          <span style={{ fontSize: 20, fontWeight: 900, color: T.gold }}>{greeting}, {MOCK.managerName}</span>
          <span style={{ fontSize: 13, color: T.muted, marginRight: 10 }}>
            {now.toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" })}
          </span>
        </div>
        <div style={{ marginRight: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          {/* Live indicator */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: T.rFull, background: `${T.green}18`, border: `1px solid ${T.green}44` }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: T.green, opacity: pulse ? 1 : 0.4, transition: "opacity 0.4s" }} />
            <span style={{ fontSize: 12, color: T.green, fontWeight: 700 }}>LIVE</span>
          </div>
          <div style={{ fontSize: 26, fontWeight: 900, color: T.text, fontVariantNumeric: "tabular-nums" }}>
            {now.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>
      </div>

      {/* ── Bento grid ────────────────────────────────────── */}
      <div style={{
        flex: 1, overflow: "hidden",
        display: "grid",
        gridTemplateColumns: "2fr 1.5fr 1fr",
        gridTemplateRows: "auto auto 1fr",
        gap: 12, padding: 16,
      }}>

        {/* ① Revenue hero ── col 1, row 1 */}
        <div style={{
          background: `linear-gradient(135deg, #1e0a04 0%, #2a1006 60%, #1a0c04 100%)`,
          border: `1px solid ${T.border}`,
          borderRadius: T.rXl, padding: "20px 24px",
          display: "flex", flexDirection: "column", gap: 8,
          gridColumn: "1", gridRow: "1",
          position: "relative", overflow: "hidden",
        }}>
          {/* Background glow */}
          <div style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, background: `${T.gold}08`, borderRadius: "50%", pointerEvents: "none" }} />
          <div style={{ fontSize: 12, color: T.muted, fontWeight: 600, letterSpacing: "0.06em" }}>הכנסה היום</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 16 }}>
            <div style={{
              fontSize: 52, fontWeight: 900, lineHeight: 1,
              background: `linear-gradient(135deg, ${T.gold}, #f5c842)`,
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>
              ₪{MOCK.revenue.today.toLocaleString()}
            </div>
            <div style={{ paddingBottom: 8, display: "flex", flexDirection: "column", gap: 2 }}>
              <Sparkline values={sparkValues} color={T.gold} />
              <div style={{ fontSize: 12, fontWeight: 700, color: revDiff >= 0 ? T.green : T.red }}>
                {revDiff >= 0 ? "▲" : "▼"} {revPct}% מאתמול
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 4 }}>
            {[
              { label: "אורחים", value: 87 },
              { label: "הזמנות", value: pipelineTotal },
              { label: "ממוצע / שולחן", value: `₪${Math.round(MOCK.revenue.today / MOCK.tables.occupied)}` },
            ].map(k => (
              <div key={k.label}>
                <div style={{ fontSize: 18, fontWeight: 800, color: T.text }}>{k.value}</div>
                <div style={{ fontSize: 10, color: T.muted }}>{k.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ② Order pipeline ── col 2, row 1 */}
        <div style={{
          background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.rXl, padding: "18px 20px",
          display: "flex", flexDirection: "column", gap: 14,
          gridColumn: "2", gridRow: "1",
        }}>
          <div style={{ fontSize: 12, color: T.muted, fontWeight: 600, letterSpacing: "0.06em" }}>PIPELINE הזמנות</div>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flex: 1 }}>
            <PipelineBar label="ממתין" count={MOCK.pipeline.waiting}   color={T.yellow}  total={pipelineTotal} />
            <div style={{ color: T.border, fontSize: 18, paddingBottom: 28 }}>›</div>
            <PipelineBar label="מכין"   count={MOCK.pipeline.preparing} color={T.blue}    total={pipelineTotal} />
            <div style={{ color: T.border, fontSize: 18, paddingBottom: 28 }}>›</div>
            <PipelineBar label="מוכן"   count={MOCK.pipeline.ready}     color={T.orange}  total={pipelineTotal} />
            <div style={{ color: T.border, fontSize: 18, paddingBottom: 28 }}>›</div>
            <PipelineBar label="שולם"   count={MOCK.pipeline.paid}      color={T.green}   total={pipelineTotal} />
          </div>
        </div>

        {/* ③ Team pulse ── col 3, row 1 */}
        <div style={{
          background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.rXl, padding: "18px 16px",
          display: "flex", flexDirection: "column", gap: 10,
          gridColumn: "3", gridRow: "1",
        }}>
          <div style={{ fontSize: 12, color: T.muted, fontWeight: 600, letterSpacing: "0.06em" }}>צוות במשמרת</div>
          {MOCK.team.map(m => (
            <div key={m.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: m.active ? T.green : T.muted, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: m.active ? T.text : T.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</div>
                <div style={{ fontSize: 10, color: T.muted }}>{m.role}</div>
              </div>
              {m.orders > 0 && (
                <div style={{ fontSize: 11, fontWeight: 700, color: T.gold, background: `${T.gold}18`, borderRadius: T.rFull, padding: "1px 7px" }}>{m.orders}</div>
              )}
            </div>
          ))}
        </div>

        {/* ④ Floor heat map ── col 1-2, row 2 */}
        <div style={{
          background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.rXl, padding: "18px 20px",
          gridColumn: "1 / 3", gridRow: "2",
          display: "flex", flexDirection: "column", gap: 12,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 12, color: T.muted, fontWeight: 600, letterSpacing: "0.06em" }}>מצב רצפה</div>
            {[
              { color: T.green,  label: `${MOCK.tables.free} פנויים` },
              { color: T.orange, label: `${MOCK.tables.occupied} תפוסים` },
              { color: T.red,    label: `${MOCK.tables.bill} חשבון` },
            ].map(s => (
              <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: s.color }} />
                <span style={{ fontSize: 11, color: T.sub }}>{s.label}</span>
              </div>
            ))}
            <div style={{ marginRight: "auto", fontSize: 11, color: MOCK.slaBreached ? T.red : T.green, fontWeight: 700 }}>
              {MOCK.slaBreached ? `⚠️ ${MOCK.slaBreached} חריגות SLA` : "✓ ללא חריגות SLA"}
            </div>
          </div>
          {/* Dot grid */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-start" }}>
            {MOCK.floorGrid.map((row, ri) => (
              <div key={ri} style={{ display: "flex", gap: 10 }}>
                {row.map((cell, ci) => (
                  <div key={ci} style={{
                    width: 36, height: 36, borderRadius: T.rMd,
                    background: cell === 0 ? "transparent" : `${TABLE_DOT[cell]}22`,
                    border: cell === 0 ? "none" : `1px solid ${TABLE_DOT[cell]}55`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: cell > 1 ? `0 0 8px ${TABLE_DOT[cell]}44` : "none",
                    transition: "all 0.4s",
                  }}>
                    {cell > 0 && <div style={{ width: 10, height: 10, borderRadius: "50%", background: TABLE_DOT[cell] }} />}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* ⑤ Insights strip ── col 3, row 2 */}
        <div style={{
          background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.rXl, padding: "18px 16px",
          gridColumn: "3", gridRow: "2",
          display: "flex", flexDirection: "column", gap: 10,
        }}>
          <div style={{ fontSize: 12, color: T.muted, fontWeight: 600, letterSpacing: "0.06em" }}>תובנות</div>
          {MOCK.insights.map((ins, i) => (
            <div key={i} style={{
              padding: "10px 12px", borderRadius: T.rMd, fontSize: 12, lineHeight: 1.5,
              background: i === insightIdx ? `${T.gold}12` : T.raised,
              border: `1px solid ${i === insightIdx ? T.gold + "44" : T.borderSub}`,
              color: i === insightIdx ? T.text : T.muted,
              transition: "all 0.5s",
            }}>
              <span style={{ marginLeft: 6 }}>{ins.icon}</span>{ins.text}
            </div>
          ))}
        </div>

        {/* ⑥ Activity feed ── col 1-2, row 3 */}
        <div style={{
          background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.rXl,
          gridColumn: "1 / 3", gridRow: "3",
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}>
          <div style={{ padding: "14px 20px 10px", fontSize: 12, color: T.muted, fontWeight: 600, letterSpacing: "0.06em", borderBottom: `1px solid ${T.borderSub}`, flexShrink: 0 }}>
            פעילות אחרונה
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {MOCK.feed.map((ev, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 20px", borderBottom: `1px solid ${T.borderSub}` }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: ev.color, flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: T.muted, flexShrink: 0 }}>{ev.time}</span>
                <span style={{ fontSize: 13, color: T.sub }}>{ev.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ⑦ Quick stats ── col 3, row 3 */}
        <div style={{
          background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.rXl, padding: "18px 16px",
          gridColumn: "3", gridRow: "3",
          display: "flex", flexDirection: "column", gap: 12,
        }}>
          <div style={{ fontSize: 12, color: T.muted, fontWeight: 600, letterSpacing: "0.06em" }}>סטטוס מהיר</div>
          {[
            { label: "ממוצע המתנה",  value: `${MOCK.avgWait} דק'`, color: MOCK.avgWait > 15 ? T.red : T.green },
            { label: "SLA חריגות",   value: MOCK.slaBreached,      color: MOCK.slaBreached ? T.red : T.green },
            { label: "ממתינים בכניסה", value: 3,                  color: T.yellow },
          ].map(s => (
            <div key={s.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: T.muted }}>{s.label}</span>
              <span style={{ fontSize: 18, fontWeight: 900, color: s.color }}>{s.value}</span>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
