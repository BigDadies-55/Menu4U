"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { T, btnGhost } from "@/lib/ui";
import { computeInsights as computeCustom, type CustomRule } from "@/lib/waiter-insights";

// ── Types ──────────────────────────────────────────────────────────────────
interface TLItem {
  id: string; name: string; basePrice: number; quantity: number; price: number;
  notes: string | null; itemStatus: string; course: number;
  heldUntilFired: boolean; firedAt: string | null; doneAt: string | null;
  servedAt: string | null; createdAt: string; isComped: boolean;
}
interface TLOrder {
  id: string; orderNumber: number | null; status: string; totalAmount: number;
  coversCount: number | null; createdAt: string; items: TLItem[];
}
interface TableData {
  tableNumber: string; status: "green" | "red" | "purple"; statusTag: string;
  coversCount: number; totalAmount: number; ageMin: number; startedAt: string;
  itemCount: number; orders: TLOrder[];
}
interface Insight {
  kind: "alert" | "upsell" | "info";
  icon: string; title: string; body: string; tableRef?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function fmt(iso: string) {
  return new Date(iso).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
}
function diffMin(a: string, b: string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000);
}
function nowIso() { return new Date().toISOString(); }

function meColor(item: TLItem) {
  if (item.basePrice >= 80) return "#fbbf24";
  if (item.basePrice >= 35) return "#60a5fa";
  return "#d1cdc7";
}
function statusColor(s: TableData["status"]) {
  return s === "red" ? T.red : s === "purple" ? T.purple : T.green;
}
function statusBg(s: TableData["status"]) {
  return s === "red" ? T.redSub : s === "purple" ? T.purpleSub : T.greenSub;
}
function itemStatusLabel(s: string) {
  return ({ PENDING: "ממתין", PREPARING: "מכין 🔥", DONE: "מוכן ✓", DELIVERED: "הוגש" } as Record<string, string>)[s] ?? s;
}
function itemStatusColor(s: string) {
  if (s === "DONE")      return T.green;
  if (s === "PREPARING") return T.orange;
  if (s === "DELIVERED") return T.muted;
  return T.blue;
}
function prepBadge(item: TLItem): { label: string; color: string } | null {
  if (!item.firedAt) return null;
  const m = diffMin(item.firedAt, item.doneAt ?? nowIso());
  if (item.doneAt) return { label: `${m} דק׳`, color: m > 15 ? T.red : T.green };
  return { label: `${m} דק׳ 🔥`, color: m > 15 ? T.red : T.orange };
}

function computeInsights(tables: TableData[]): Insight[] {
  const ins: Insight[] = [];
  for (const t of tables) {
    const allItems = t.orders.flatMap(o => o.items);
    const delayed = allItems.filter(i =>
      i.itemStatus === "PREPARING" && i.firedAt && diffMin(i.firedAt, nowIso()) > 15
    );
    if (delayed.length > 0) {
      ins.push({ kind: "alert", icon: "⚠️", title: `שולחן ${t.tableNumber} — עיכוב הכנה`, body: `${delayed.length} מנה/ות בגריל מעל 15 דק׳`, tableRef: t.tableNumber });
    }
    const mains = allItems.filter(i => i.course === 2);
    if (mains.length > 0 && mains.every(i => ["DONE", "DELIVERED"].includes(i.itemStatus))) {
      const minDone = Math.min(...mains.map(i => i.doneAt ? diffMin(i.doneAt, nowIso()) : 0));
      if (minDone > 5) {
        ins.push({ kind: "upsell", icon: "🍷", title: `שולחן ${t.tableNumber} — הצע קינוח`, body: "עיקריות הוגשו לפחות 5 דקות — רגע טוב להציע קינוח", tableRef: t.tableNumber });
      }
    }
    if (t.ageMin > 50 && t.status !== "red") {
      ins.push({ kind: "alert", icon: "⏱", title: `שולחן ${t.tableNumber} — שהייה ארוכה`, body: `${t.ageMin} דקות פעיל — בדוק שהשולחן מרוצה`, tableRef: t.tableNumber });
    }
    const readyNotServed = allItems.filter(i => i.itemStatus === "DONE" && !i.servedAt);
    if (readyNotServed.length >= 2) {
      ins.push({ kind: "upsell", icon: "🍽️", title: `שולחן ${t.tableNumber} — ${readyNotServed.length} מנות מחכות`, body: "מנות מוכנות בחלון — לא הוגשו עדיין", tableRef: t.tableNumber });
    }
  }
  const redCount = tables.filter(t => t.status === "red").length;
  if (redCount === 0 && tables.length > 0) {
    ins.push({ kind: "info", icon: "✅", title: "שירות זורם בצורה תקינה", body: `כל ${tables.length} השולחנות הפעילים ללא עיכובים` });
  }
  return ins.slice(0, 8);
}

function buildEvents(item: TLItem) {
  const evs: { time: string; title: string; body: string; kind: "ok" | "warn" | "error" | "muted" }[] = [];
  evs.push({ time: fmt(item.createdAt), title: "הזמנה נקלטה", body: `${item.quantity}× ${item.name}${item.notes ? ` — ${item.notes}` : ""}`, kind: "ok" });
  if (item.firedAt) {
    const w = diffMin(item.createdAt, item.firedAt);
    evs.push({ time: fmt(item.firedAt), title: "נשלח למטבח", body: w > 0 ? `${w} דקות מהזמנה` : "מיידי", kind: "ok" });
  }
  if (item.firedAt && !item.doneAt) {
    const m = diffMin(item.firedAt, nowIso());
    if (m > 15) evs.push({ time: "—", title: "עיכוב חריג", body: `${m} דקות בהכנה — מעל לתקן`, kind: "error" });
  }
  if (item.doneAt) {
    const m = item.firedAt ? diffMin(item.firedAt, item.doneAt) : null;
    evs.push({ time: fmt(item.doneAt), title: "הכנה הושלמה", body: m !== null ? `${m} דקות הכנה${m > 15 ? " — חריגה!" : ""}` : "הושלם", kind: m !== null && m > 15 ? "warn" : "ok" });
  }
  if (item.servedAt) {
    const m = item.doneAt ? diffMin(item.doneAt, item.servedAt) : null;
    evs.push({ time: fmt(item.servedAt), title: "הוגש לשולחן", body: m !== null ? `${m} דקות מסיום הכנה` : "הגשה", kind: "ok" });
  }
  return evs;
}

// ── Sub-components ─────────────────────────────────────────────────────────

function InsightCard({ ins, onClick }: { ins: Insight; onClick?: () => void }) {
  const cfg = {
    alert:  { bg: T.redSub,    border: T.red    + "44", color: T.red    },
    upsell: { bg: T.purpleSub, border: T.purple + "44", color: T.purple },
    info:   { bg: T.greenSub,  border: T.green  + "44", color: T.green  },
  }[ins.kind];
  return (
    <div onClick={onClick} style={{
      flexShrink: 0, minWidth: 220, maxWidth: 260,
      background: cfg.bg, border: `1.5px solid ${cfg.border}`,
      borderRadius: 12, padding: "12px 14px",
      cursor: onClick ? "pointer" : "default",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
        <span style={{ fontSize: 18 }}>{ins.icon}</span>
        <span style={{ fontSize: 13, fontWeight: 800, color: cfg.color, lineHeight: 1.2 }}>{ins.title}</span>
      </div>
      <div style={{ fontSize: 11, color: T.sub, lineHeight: 1.5 }}>{ins.body}</div>
    </div>
  );
}

function FloorCard({ t, selected, onClick }: { t: TableData; selected: boolean; onClick: () => void }) {
  const c = statusColor(t.status);
  return (
    <div onClick={onClick} style={{
      borderRadius: 12, border: `1.5px solid ${selected ? T.text : T.border}`,
      background: T.surface, padding: "10px 10px 10px 12px",
      cursor: "pointer", position: "relative", overflow: "hidden",
      minHeight: 80, display: "flex", flexDirection: "column", justifyContent: "space-between",
      boxShadow: selected ? `0 0 0 2px ${T.text}22` : undefined,
      transform: selected ? "translateY(-1px)" : undefined,
      transition: "box-shadow 0.12s, transform 0.12s",
    }}>
      {/* colored right stripe */}
      <div style={{ position: "absolute", top: 0, right: 0, width: 4, height: "100%", background: c, borderRadius: "0 10px 10px 0" }} />
      <div style={{ paddingRight: 6 }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: c, lineHeight: 1 }}>
          {t.tableNumber.padStart(2, "0")}
        </div>
        <div style={{ fontSize: 10, color: T.muted, marginTop: 2, lineHeight: 1.3 }}>
          {t.coversCount > 0 ? `${t.coversCount} קאב׳ · ` : ""}{t.ageMin} דק׳
        </div>
      </div>
      <div style={{
        display: "inline-flex", alignItems: "center", padding: "2px 7px",
        borderRadius: 999, fontSize: 10, fontWeight: 700,
        background: statusBg(t.status), color: c, width: "fit-content",
      }}>
        {t.statusTag}
      </div>
    </div>
  );
}

function TLEvent({ ev, expanded, onToggle }: {
  ev: { time: string; title: string; body: string; kind: "ok" | "warn" | "error" | "muted" };
  expanded: boolean; onToggle: () => void;
}) {
  const c = ev.kind === "ok" ? T.green : ev.kind === "error" ? T.red : ev.kind === "warn" ? T.orange : T.muted;
  return (
    <div onClick={onToggle} style={{ display: "flex", gap: 10, padding: expanded ? "8px 14px" : "4px 14px", cursor: "pointer" }}>
      <div style={{
        width: expanded ? 14 : 9, height: expanded ? 14 : 9, borderRadius: "50%",
        flexShrink: 0, marginTop: 3, background: c + "22", border: `2px solid ${c}66`,
        zIndex: 1, transition: "all 0.15s",
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, color: T.muted, fontWeight: 700, fontFamily: "monospace" }}>{ev.time}</div>
        <div style={{ fontSize: expanded ? 12 : 11, fontWeight: expanded ? 800 : 600, color: ev.kind === "error" ? T.red : T.text, marginTop: 1 }}>{ev.title}</div>
        {expanded && <div style={{ fontSize: 11, color: T.sub, marginTop: 3, lineHeight: 1.5 }}>{ev.body}</div>}
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────

export default function LiveFloorClient({ restaurants }: { restaurants: { id: string; name: string }[] }) {
  const [rid, setRid]                     = useState(restaurants[0]?.id ?? "");
  const [tables, setTables]               = useState<TableData[]>([]);
  const [loading, setLoading]             = useState(true);
  const [apiError, setApiError]           = useState<string | null>(null);
  const [floorMin, setFloorMin]           = useState(false);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [selectedItem, setSelectedItem]   = useState<TLItem | null>(null);
  const [expandedEvs, setExpandedEvs]     = useState<Set<number>>(new Set());
  const [customRules, setCustomRules]     = useState<CustomRule[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    if (!rid) return;
    try {
      const r = await fetch(`/api/admin/orders/live-floor?restaurantId=${rid}`);
      if (r.ok) {
        setTables((await r.json()).tables ?? []);
        setApiError(null);
      } else {
        const err = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
        setApiError(err.error ?? `שגיאת שרת ${r.status}`);
      }
    } catch (e) {
      setApiError(String(e));
    } finally {
      setLoading(false);
    }
  }, [rid]);

  useEffect(() => {
    // Fetch custom insight rules for this restaurant
    fetch(`/api/admin/insight-rules?restaurantId=${rid}`)
      .then(r => r.ok ? r.json() : { rules: [] })
      .then(d => setCustomRules(d.rules ?? []))
      .catch(() => setCustomRules([]));
  }, [rid]);

  useEffect(() => {
    setLoading(true);
    load();
    timer.current = setInterval(load, 15000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [load]);

  const selectedTableData = tables.find(t => t.tableNumber === selectedTable) ?? null;
  const allItems          = selectedTableData?.orders.flatMap(o => o.items) ?? [];
  const events            = selectedItem ? buildEvents(selectedItem) : [];
  const localInsights     = computeInsights(tables);
  const customInsights    = computeCustom(
    tables.map(t => ({
      tableNum:       t.tableNumber,
      seats:          t.coversCount + 1,
      availStatus:    "occupied" as const,
      minutesSitting: t.ageMin,
      guests:         t.coversCount,
      orderStatus:    t.orders[t.orders.length - 1]?.status ?? null,
    })),
    customRules,
  );
  // Merge: local insights first (item-level), custom rules add any not already covered
  const coveredTables = new Set(localInsights.map(i => i.tableRef ?? ""));
  const extraInsights = customInsights
    .filter(ci => !coveredTables.has(ci.tableNum))
    .map(ci => ({ kind: ci.type === "alert" ? "alert" as const : ci.type === "tip" ? "upsell" as const : "info" as const, icon: ci.type === "alert" ? "⚠️" : ci.type === "tip" ? "💡" : "ℹ️", title: ci.text, body: "", tableRef: ci.tableNum }));
  const insights = [...localInsights, ...extraInsights];

  function toggleTable(tn: string) {
    if (selectedTable === tn) { setSelectedTable(null); setSelectedItem(null); }
    else { setSelectedTable(tn); setSelectedItem(null); setExpandedEvs(new Set()); }
  }
  function toggleEv(i: number) {
    setExpandedEvs(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; });
  }

  const cols = Math.min(Math.max(tables.length, 4), 9);

  return (
    <div style={{ direction: "rtl", fontFamily: T.fontSans, background: T.bg, minHeight: "100vh", color: T.text, display: "flex", flexDirection: "column" }}>

      {/* ── Header ── */}
      <div style={{ padding: "20px 28px 0", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ fontSize: 22, fontWeight: 900 }}>מפת שולחנות חיה</div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", gap: 12 }}>
            {([ ["green", "תקין"], ["red", "עיכוב"], ["purple", "פעולת AI"] ] as const).map(([c, l]) => (
              <div key={l} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, color: T.sub }}>
                <div style={{ width: 9, height: 9, borderRadius: "50%", background: c === "green" ? T.green : c === "red" ? T.red : T.purple }} />{l}
              </div>
            ))}
          </div>
          {loading && <span style={{ fontSize: 11, color: T.muted }}>מתעדכן...</span>}
          {restaurants.length > 1
            ? <select value={rid} onChange={e => setRid(e.target.value)} style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, fontSize: 13, padding: "5px 10px" }}>
                {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            : <div style={{ fontSize: 13, color: T.muted }}>{restaurants[0]?.name}</div>
          }
        </div>
      </div>
      <div style={{ height: 1, background: T.border, margin: "12px 28px 0", flexShrink: 0 }} />

      {/* ── Insights ── */}
      <div style={{ padding: "14px 28px 0", flexShrink: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 10 }}>
          מסקנות ופעולות נדרשות
        </div>
        {apiError ? (
          <div style={{ padding: "10px 14px", background: T.redSub, border: `1px solid ${T.red}44`, borderRadius: 10, color: T.red, fontSize: 13, fontWeight: 600 }}>
            שגיאה: {apiError}
          </div>
        ) : insights.length > 0 ? (
          <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
            {insights.map((ins, i) => (
              <InsightCard key={i} ins={ins}
                onClick={ins.tableRef ? () => { setSelectedTable(ins.tableRef!); setSelectedItem(null); } : undefined}
              />
            ))}
          </div>
        ) : (
          <div style={{ padding: "10px 0", color: T.muted, fontSize: 13 }}>
            {loading ? "טוען נתונים..." : "אין שולחנות פעילים"}
          </div>
        )}
      </div>

      <div style={{ height: 1, background: T.borderSub, margin: "14px 28px 0", flexShrink: 0 }} />

      {/* ── Floor grid ── */}
      <div style={{ padding: "12px 28px 0", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, letterSpacing: "0.07em", textTransform: "uppercase" }}>
            מצב המסעדה עכשיו · {tables.length} שולחנות פעילים
          </div>
          <button onClick={() => setFloorMin(v => !v)} style={{ ...btnGhost(T.muted, "sm"), fontSize: 11 }}>
            {floorMin ? "▼ הצג מפה" : "▲ מזעור"}
          </button>
        </div>
        {!floorMin && (
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 8 }}>
            {tables.map(t => (
              <FloorCard key={t.tableNumber} t={t} selected={selectedTable === t.tableNumber} onClick={() => toggleTable(t.tableNumber)} />
            ))}
            {tables.length === 0 && !loading && (
              <div style={{ gridColumn: "1/-1", padding: "24px 0", textAlign: "center", color: T.muted, fontSize: 13 }}>
                אין שולחנות פעילים כרגע
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Expand panel ── */}
      {selectedTableData && !floorMin && (
        <div style={{ margin: "10px 28px 0", background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 14, padding: "14px 20px", display: "flex", alignItems: "center", gap: 20, flexShrink: 0 }}>
          <div style={{ fontSize: 36, fontWeight: 900, color: statusColor(selectedTableData.status), lineHeight: 1, flexShrink: 0 }}>
            {selectedTableData.tableNumber.padStart(2, "0")}
          </div>
          <div style={{ flex: 1, borderRight: `1.5px solid ${T.border}`, paddingRight: 18 }}>
            <div style={{ fontSize: 15, fontWeight: 800 }}>שולחן {selectedTableData.tableNumber}</div>
            <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>
              {selectedTableData.coversCount > 0 ? `${selectedTableData.coversCount} קאברים · ` : ""}{selectedTableData.ageMin} דקות פעיל
            </div>
            <div style={{ display: "inline-flex", alignItems: "center", marginTop: 6, padding: "3px 9px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: statusBg(selectedTableData.status), color: statusColor(selectedTableData.status) }}>
              {selectedTableData.statusTag}
            </div>
          </div>
          {[
            { val: selectedTableData.itemCount, lbl: "מנות" },
            { val: selectedTableData.ageMin,    lbl: "דקות" },
            { val: `₪${Math.round(selectedTableData.totalAmount)}`, lbl: "סה״כ" },
          ].map(({ val, lbl }) => (
            <div key={lbl} style={{ textAlign: "center", flexShrink: 0 }}>
              <div style={{ fontSize: 22, fontWeight: 900 }}>{val}</div>
              <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{lbl}</div>
            </div>
          ))}
          <button onClick={() => { setSelectedTable(null); setSelectedItem(null); }} style={{ ...btnGhost(T.muted, "sm"), flexShrink: 0 }}>✕</button>
        </div>
      )}

      {/* ── Main panels ── */}
      <div style={{ display: "flex", gap: 14, padding: "12px 28px 24px", flex: 1, minHeight: 0, overflow: "hidden" }}>

        {/* Orders list */}
        <div style={{ flex: 1, background: T.surface, borderRadius: 16, border: `1px solid ${T.border}`, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 240 }}>
          <div style={{ padding: "12px 16px 8px", borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 800 }}>
              📋 פירוט הזמנות{selectedTable ? ` — שולחן ${selectedTable}` : ""}
            </div>
            <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>
              {selectedTable ? "לחץ על מנה לציר זמן" : "בחר שולחן מהמפה למעלה"}
            </div>
          </div>
          {/* ME legend */}
          <div style={{ display: "flex", gap: 10, padding: "6px 16px 5px", borderBottom: `1px solid ${T.borderSub}`, flexShrink: 0 }}>
            {[["#fbbf24", "כוכב ≥₪80"], ["#60a5fa", "סוס עבודה ≥₪35"], ["#d1cdc7", "רגיל"]].map(([c, l]) => (
              <div key={l} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: T.muted, fontWeight: 600 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: c }} />{l}
              </div>
            ))}
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {allItems.length === 0 && (
              <div style={{ padding: "32px 0", textAlign: "center", color: T.muted, fontSize: 13 }}>
                {selectedTable ? "אין מנות" : "בחר שולחן לצפייה"}
              </div>
            )}
            {allItems.map(item => {
              const pb = prepBadge(item);
              return (
                <div key={item.id}
                  onClick={() => { setSelectedItem(item); setExpandedEvs(new Set()); }}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderBottom: `1px solid ${T.borderSub}`, cursor: "pointer", background: selectedItem?.id === item.id ? T.raised : undefined, transition: "background 0.1s" }}>
                  <div style={{ width: 4, height: 34, borderRadius: 2, background: meColor(item), flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ opacity: 0.55, fontSize: 11 }}>{item.quantity}×</span>
                      {item.name}
                      {item.isComped && <span style={{ fontSize: 9, fontWeight: 800, color: T.purple, background: T.purpleSub, padding: "1px 5px", borderRadius: 4 }}>COMP</span>}
                    </div>
                    {item.notes && <div style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>📝 {item.notes}</div>}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: itemStatusColor(item.itemStatus), background: itemStatusColor(item.itemStatus) + "22", padding: "2px 7px", borderRadius: 999 }}>
                      {itemStatusLabel(item.itemStatus)}
                    </span>
                    {pb && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: pb.color }}>
                        {pb.label}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Timeline panel */}
        <div style={{ width: 280, background: T.surface, borderRadius: 16, border: `1px solid ${T.border}`, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 240, flexShrink: 0 }}>
          <div style={{ padding: "12px 16px 8px", borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 800 }}>⏱ ציר זמן מנה</div>
            <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>
              {selectedItem ? selectedItem.name : "בחר מנה מהרשימה"}
            </div>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "10px 0", position: "relative" }}>
            {events.length === 0 && (
              <div style={{ padding: "32px 0", textAlign: "center", color: T.muted, fontSize: 13 }}>
                {selectedItem ? "אין אירועים" : "בחר מנה"}
              </div>
            )}
            {/* timeline vertical line */}
            {events.length > 0 && (
              <div style={{ position: "absolute", right: 21, top: 16, bottom: 16, width: 1, background: T.borderSub }} />
            )}
            {events.map((ev, i) => (
              <TLEvent key={i} ev={ev} expanded={expandedEvs.has(i)} onToggle={() => toggleEv(i)} />
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
