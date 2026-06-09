"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { T, btnGhost } from "@/lib/ui";

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
function meLabel(item: TLItem) {
  if (item.basePrice >= 80) return "כוכב";
  if (item.basePrice >= 35) return "סוס עבודה";
  return "—";
}
function statusColor(s: TableData["status"]) {
  return s === "red" ? T.red : s === "purple" ? T.purple : T.green;
}
function statusBg(s: TableData["status"]) {
  return s === "red" ? T.redSub : s === "purple" ? T.purpleSub : T.greenSub;
}
function itemStatusLabel(s: string) {
  return ({ PENDING: "ממתין", PREPARING: "מכין 🔥", DONE: "מוכן ✓", DELIVERED: "הוגש" } as Record<string,string>)[s] ?? s;
}
function itemStatusColor(s: string) {
  if (s === "DONE")      return T.green;
  if (s === "PREPARING") return T.orange;
  if (s === "DELIVERED") return T.muted;
  return T.blue;
}

// compute insights from tables
function computeInsights(tables: TableData[]): Insight[] {
  const ins: Insight[] = [];
  for (const t of tables) {
    const allItems = t.orders.flatMap(o => o.items);
    // delayed prep
    const delayed = allItems.filter(i =>
      i.itemStatus === "PREPARING" && i.firedAt &&
      diffMin(i.firedAt, nowIso()) > 15
    );
    if (delayed.length > 0) {
      ins.push({ kind: "alert", icon: "⚠️", title: `שולחן ${t.tableNumber} — עיכוב הכנה`, body: `${delayed.length} מנה/ות על הגריל מעל 15 דקות — בדוק עם המטבח`, tableRef: t.tableNumber });
    }
    // upsell: all mains done
    const mains = allItems.filter(i => i.course === 2);
    if (mains.length > 0 && mains.every(i => ["DONE","DELIVERED"].includes(i.itemStatus))) {
      const lateDone = mains.map(i => i.doneAt ? diffMin(i.doneAt, nowIso()) : 0);
      if (Math.min(...lateDone) > 5) {
        ins.push({ kind: "upsell", icon: "🍷", title: `שולחן ${t.tableNumber} — הצע קינוח`, body: "עיקריות הוגשו לפחות 5 דקות — רגע טוב להציע קינוח ומשקה", tableRef: t.tableNumber });
      }
    }
    // very old table
    if (t.ageMin > 50 && t.status !== "red") {
      ins.push({ kind: "alert", icon: "⏱", title: `שולחן ${t.tableNumber} — שהייה ארוכה`, body: `${t.ageMin} דקות פעיל — בדוק שהשולחן מרוצה`, tableRef: t.tableNumber });
    }
    // ready items not served
    const readyNotServed = allItems.filter(i => i.itemStatus === "DONE" && !i.servedAt);
    if (readyNotServed.length >= 2) {
      ins.push({ kind: "upsell", icon: "🍽️", title: `שולחן ${t.tableNumber} — ${readyNotServed.length} מנות מחכות`, body: "מנות מוכנות בחלון ההגשה, לא הוגשו עדיין", tableRef: t.tableNumber });
    }
  }
  // summary insight
  const redCount = tables.filter(t => t.status === "red").length;
  if (redCount === 0 && tables.length > 0) {
    ins.push({ kind: "info", icon: "✅", title: "שירות זורם בצורה תקינה", body: `כל ${tables.length} השולחנות הפעילים ללא עיכובים` });
  }
  return ins.slice(0, 6);
}

// build item events
function buildEvents(item: TLItem) {
  const evs: { time: string; title: string; body: string; kind: "ok"|"warn"|"error"|"muted" }[] = [];
  evs.push({ time: fmt(item.createdAt), title: "הזמנה נקלטה", body: `${item.quantity}× ${item.name}${item.notes ? ` — ${item.notes}` : ""}`, kind: "ok" });
  if (item.firedAt) {
    const w = diffMin(item.createdAt, item.firedAt);
    evs.push({ time: fmt(item.firedAt), title: "נשלח למטבח", body: `${w > 0 ? `${w} דקות מהזמנה` : "מיידי"}`, kind: "ok" });
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
    alert:  { bg: T.redSub,    border: T.red + "44",    color: T.red    },
    upsell: { bg: T.purpleSub, border: T.purple + "44", color: T.purple },
    info:   { bg: T.greenSub,  border: T.green + "44",  color: T.green  },
  }[ins.kind];
  return (
    <div onClick={onClick} style={{
      flexShrink: 0, minWidth: 240, maxWidth: 280,
      background: cfg.bg, border: `1.5px solid ${cfg.border}`,
      borderRadius: 14, padding: "14px 16px",
      cursor: onClick ? "pointer" : "default",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 20 }}>{ins.icon}</span>
        <span style={{ fontSize: 14, fontWeight: 800, color: cfg.color, lineHeight: 1.2 }}>{ins.title}</span>
      </div>
      <div style={{ fontSize: 12, color: T.sub, lineHeight: 1.5 }}>{ins.body}</div>
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
      minHeight: 84, display: "flex", flexDirection: "column", justifyContent: "space-between",
      boxShadow: selected ? `0 0 0 2px ${T.text}` : undefined,
      transform: selected ? "translateY(-1px)" : undefined,
      transition: "box-shadow 0.1s, transform 0.1s",
    }}>
      <div style={{ position: "absolute", top: 0, right: 0, width: 4, height: "100%", background: c, borderRadius: "0 10px 10px 0" }} />
      <div style={{ paddingRight: 6 }}>
        <div style={{ fontSize: 20, fontWeight: 900, color: c, lineHeight: 1 }}>
          {t.tableNumber.padStart(2, "0")}
        </div>
        <div style={{ fontSize: 10, color: T.muted, marginTop: 2, lineHeight: 1.3 }}>
          {t.coversCount > 0 ? `${t.coversCount} קאב׳` : ""}
          {t.ageMin > 0 ? ` · ${t.ageMin} דק׳` : ""}
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
  ev: { time: string; title: string; body: string; kind: "ok"|"warn"|"error"|"muted" };
  expanded: boolean; onToggle: () => void;
}) {
  const c = ev.kind === "ok" ? T.green : ev.kind === "error" ? T.red : ev.kind === "warn" ? T.orange : T.muted;
  return (
    <div onClick={onToggle} style={{ display: "flex", gap: 10, padding: expanded ? "9px 16px" : "5px 16px", cursor: "pointer", position: "relative" }}>
      <div style={{
        width: expanded ? 16 : 10, height: expanded ? 16 : 10, borderRadius: "50%",
        flexShrink: 0, marginTop: 3, background: c + "22", border: `2px solid ${c}55`, zIndex: 1, transition: "all 0.15s",
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, color: T.muted, fontWeight: 700, fontFamily: "monospace" }}>{ev.time}</div>
        <div style={{ fontSize: expanded ? 13 : 12, fontWeight: expanded ? 800 : 600, color: ev.kind === "error" ? T.red : T.text, marginTop: 1 }}>{ev.title}</div>
        {expanded && <div style={{ fontSize: 11, color: T.sub, marginTop: 3, lineHeight: 1.5 }}>{ev.body}</div>}
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────

export default function TableTimelineClient({ restaurants }: { restaurants: { id: string; name: string }[] }) {
  const [rid, setRid]             = useState(restaurants[0]?.id ?? "");
  const [tables, setTables]       = useState<TableData[]>([]);
  const [loading, setLoading]     = useState(true);
  const [apiError, setApiError]   = useState<string | null>(null);
  const [floorMin, setFloorMin]   = useState(false);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [selectedItem,  setSelectedItem]  = useState<TLItem | null>(null);
  const [expandedEvs,   setExpandedEvs]   = useState<Set<number>>(new Set());
  const timer = useRef<ReturnType<typeof setInterval>|null>(null);

  const load = useCallback(async () => {
    if (!rid) return;
    try {
      const r = await fetch(`/api/admin/orders/table-timeline?restaurantId=${rid}`);
      if (r.ok) {
        const data = await r.json();
        setTables(data.tables ?? []);
        setApiError(null);
      } else {
        const err = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
        setApiError(err.error ?? `שגיאת שרת ${r.status}`);
      }
    } catch (e) {
      setApiError(String(e));
    } finally { setLoading(false); }
  }, [rid]);

  useEffect(() => {
    setLoading(true); load();
    timer.current = setInterval(load, 15000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [load]);

  const selectedTableData = tables.find(t => t.tableNumber === selectedTable) ?? null;
  const allItems = selectedTableData?.orders.flatMap(o => o.items) ?? [];
  const events   = selectedItem ? buildEvents(selectedItem) : [];
  const insights = computeInsights(tables);

  function toggleTable(tn: string) {
    if (selectedTable === tn) { setSelectedTable(null); setSelectedItem(null); }
    else { setSelectedTable(tn); setSelectedItem(null); }
  }
  function toggleEv(i: number) {
    setExpandedEvs(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; });
  }

  return (
    <div style={{ direction: "rtl", fontFamily: "'Heebo', Arial, sans-serif", background: T.bg, minHeight: "100vh", color: T.text, display: "flex", flexDirection: "column" }}>

      {/* ── Header ── */}
      <div style={{ padding: "20px 28px 0", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ fontSize: 22, fontWeight: 900 }}>מפת שולחנות חיה</div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", gap: 14 }}>
            {([["green","תקין"],["red","עיכוב שירות"],["purple","פעולת AI"]] as const).map(([c,l]) => (
              <div key={l} style={{ display:"flex", alignItems:"center", gap:5, fontSize:12, fontWeight:600, color:T.sub }}>
                <div style={{ width:10, height:10, borderRadius:"50%", background: c==="green"?T.green:c==="red"?T.red:T.purple }} />{l}
              </div>
            ))}
          </div>
          {restaurants.length > 1
            ? <select value={rid} onChange={e=>setRid(e.target.value)} style={{ background:T.panel, border:`1px solid ${T.border}`, borderRadius:8, color:T.text, fontSize:13, padding:"5px 10px" }}>
                {restaurants.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            : <div style={{ fontSize:13, color:T.muted }}>{restaurants[0]?.name}</div>
          }
        </div>
      </div>
      <div style={{ height:1, background:T.border, margin:"12px 28px 0", flexShrink:0 }} />

      {/* ══════════════════════════════════════════════
          INSIGHTS — prominent, full-width, top section
      ══════════════════════════════════════════════ */}
      <div style={{ padding:"14px 28px 0", flexShrink:0 }}>
        <div style={{ fontSize:11, fontWeight:700, color:T.muted, letterSpacing:"0.07em", textTransform:"uppercase", marginBottom:10 }}>
          מסקנות ופעולות נדרשות
          {loading && <span style={{ marginRight:8, fontSize:10 }}>טוען...</span>}
        </div>
        {apiError ? (
          <div style={{ padding:"12px 16px", background:T.redSub, border:`1px solid ${T.red}44`, borderRadius:10, color:T.red, fontSize:13, fontWeight:600 }}>
            שגיאה: {apiError}
          </div>
        ) : insights.length > 0 ? (
          <div style={{ display:"flex", gap:10, overflowX:"auto", paddingBottom:4 }}>
            {insights.map((ins,i) => (
              <InsightCard key={i} ins={ins}
                onClick={ins.tableRef ? () => setSelectedTable(ins.tableRef!) : undefined}
              />
            ))}
          </div>
        ) : (
          <div style={{ padding:"12px 0", color:T.muted, fontSize:13 }}>
            {loading ? "טוען נתונים..." : "אין שולחנות פעילים — אין מסקנות"}
          </div>
        )}
      </div>

      <div style={{ height:1, background:T.borderSub, margin:"14px 28px 0", flexShrink:0 }} />

      {/* ── Floor grid (minimizable) ── */}
      <div style={{ padding:"12px 28px 0", flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
          <div style={{ fontSize:11, fontWeight:700, color:T.muted, letterSpacing:"0.07em", textTransform:"uppercase" }}>
            מצב המסעדה עכשיו
          </div>
          <button onClick={()=>setFloorMin(v=>!v)} style={{ ...btnGhost(T.muted,"sm"), fontSize:11 }}>
            {floorMin ? "▼ הצג מפה" : "▲ מזעור"}
          </button>
        </div>
        {!floorMin && (
          <div style={{ display:"grid", gridTemplateColumns:`repeat(${Math.min(Math.max(tables.length,4),9)},1fr)`, gap:8 }}>
            {tables.map(t=>(
              <FloorCard key={t.tableNumber} t={t} selected={selectedTable===t.tableNumber} onClick={()=>toggleTable(t.tableNumber)} />
            ))}
            {tables.length===0 && !loading && (
              <div style={{ gridColumn:"1/-1", padding:"16px 0", textAlign:"center", color:T.muted, fontSize:13 }}>אין שולחנות פעילים</div>
            )}
          </div>
        )}
      </div>

      {/* ── Expand panel ── */}
      {selectedTableData && !floorMin && (
        <div style={{ margin:"10px 28px 0", background:T.surface, border:`1.5px solid ${T.border}`, borderRadius:14, padding:"14px 20px", display:"flex", alignItems:"center", gap:20, flexShrink:0 }}>
          <div style={{ fontSize:34, fontWeight:900, color:statusColor(selectedTableData.status), lineHeight:1, flexShrink:0 }}>
            {selectedTableData.tableNumber.padStart(2,"0")}
          </div>
          <div style={{ flex:1, borderRight:`1.5px solid ${T.border}`, paddingRight:18 }}>
            <div style={{ fontSize:15, fontWeight:800 }}>שולחן {selectedTableData.tableNumber}</div>
            <div style={{ fontSize:12, color:T.muted, marginTop:2 }}>
              {selectedTableData.coversCount>0 ? `${selectedTableData.coversCount} קאברים · ` : ""}{selectedTableData.ageMin} דקות פעיל
            </div>
            <div style={{ display:"inline-flex", alignItems:"center", marginTop:6, padding:"3px 9px", borderRadius:999, fontSize:11, fontWeight:700, background:statusBg(selectedTableData.status), color:statusColor(selectedTableData.status) }}>
              {selectedTableData.statusTag}
            </div>
          </div>
          {[{val:selectedTableData.itemCount,lbl:"מנות"},{val:selectedTableData.ageMin,lbl:"דקות"},{val:`₪${Math.round(selectedTableData.totalAmount)}`,lbl:"סה״כ"}].map(({val,lbl})=>(
            <div key={lbl} style={{ textAlign:"center", flexShrink:0 }}>
              <div style={{ fontSize:20, fontWeight:900 }}>{val}</div>
              <div style={{ fontSize:11, color:T.muted, marginTop:2 }}>{lbl}</div>
            </div>
          ))}
          <button onClick={()=>setSelectedTable(null)} style={{ ...btnGhost(T.muted,"sm"), flexShrink:0 }}>✕</button>
        </div>
      )}

      {/* ── Main panels (orders + timeline) ── */}
      <div style={{ display:"flex", gap:14, padding:"12px 28px 24px", flex:1, minHeight:0, overflow:"hidden" }}>

        {/* Orders panel — flexible width */}
        <div style={{ flex:1, background:T.surface, borderRadius:16, border:`1px solid ${T.border}`, display:"flex", flexDirection:"column", overflow:"hidden", minHeight:260 }}>
          <div style={{ padding:"12px 16px 8px", borderBottom:`1px solid ${T.border}`, flexShrink:0 }}>
            <div style={{ fontSize:14, fontWeight:800 }}>📋 פירוט הזמנות{selectedTable ? ` — שולחן ${selectedTable}` : ""}</div>
            <div style={{ fontSize:11, color:T.muted, marginTop:2 }}>{selectedTable ? "לחץ מנה לציר זמן" : "בחר שולחן למעלה"}</div>
          </div>
          <div style={{ display:"flex", gap:8, padding:"7px 16px 5px", borderBottom:`1px solid ${T.borderSub}`, flexShrink:0 }}>
            {[["#fbbf24","כוכב"],["#60a5fa","סוס עבודה"],["#d1cdc7","רגיל"]].map(([c,l])=>(
              <div key={l} style={{ display:"flex", alignItems:"center", gap:4, fontSize:10, color:T.muted, fontWeight:600 }}>
                <div style={{ width:9, height:9, borderRadius:2, background:c }} />{l}
              </div>
            ))}
          </div>
          <div style={{ flex:1, overflowY:"auto" }}>
            {allItems.length===0 && (
              <div style={{ padding:"32px 0", textAlign:"center", color:T.muted, fontSize:13 }}>{selectedTable?"אין מנות":"בחר שולחן לצפייה"}</div>
            )}
            {allItems.map(item=>(
              <div key={item.id} onClick={()=>{ setSelectedItem(item); setExpandedEvs(new Set()); }}
                style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 16px", borderBottom:`1px solid ${T.borderSub}`, cursor:"pointer", background:selectedItem?.id===item.id?T.raised:undefined, transition:"background 0.1s" }}>
                <div style={{ width:4, height:32, borderRadius:2, background:meColor(item), flexShrink:0 }} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:700 }}>{item.quantity>1?`${item.quantity}× `:""}{item.name}</div>
                  <div style={{ fontSize:10, color:T.muted, marginTop:1 }}>{meLabel(item)}{item.notes?` · ${item.notes}`:""}</div>
                </div>
                <div style={{ fontSize:11, fontWeight:700, padding:"2px 7px", borderRadius:6, background:itemStatusColor(item.itemStatus)+"22", color:itemStatusColor(item.itemStatus), flexShrink:0 }}>
                  {itemStatusLabel(item.itemStatus)}
                </div>
                {item.firedAt && (()=>{
                  const m = diffMin(item.firedAt!, item.doneAt ?? nowIso());
                  const c = m>15?T.red:m>10?T.orange:T.green;
                  return <div style={{ fontSize:11, fontWeight:700, padding:"2px 7px", borderRadius:6, background:c+"22", color:c, flexShrink:0 }}>{m} דק׳</div>;
                })()}
                <div style={{ color:T.muted, fontSize:12, flexShrink:0 }}>›</div>
              </div>
            ))}
          </div>
        </div>

        {/* Timeline panel — narrower: 280px */}
        <div style={{ width:280, flexShrink:0, background:T.surface, borderRadius:16, border:`1px solid ${T.border}`, display:"flex", flexDirection:"column", overflow:"hidden", minHeight:260 }}>
          <div style={{ padding:"12px 16px 8px", borderBottom:`1px solid ${T.border}`, flexShrink:0 }}>
            <div style={{ fontSize:14, fontWeight:800 }}>⏱ ציר זמן</div>
            <div style={{ fontSize:11, color:T.muted, marginTop:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
              {selectedItem ? selectedItem.name : "בחר מנה לצפייה"}
            </div>
          </div>
          <div style={{ flex:1, overflowY:"auto", padding:"4px 0 16px" }}>
            {events.length===0 && (
              <div style={{ padding:"32px 0", textAlign:"center", color:T.muted, fontSize:13 }}>{selectedItem?"אין נתונים":"בחר מנה לצפייה"}</div>
            )}
            {events.map((ev,idx)=>(
              <React.Fragment key={idx}>
                <div style={{ position:"relative" }}>
                  {idx<events.length-1 && (
                    <div style={{ position:"absolute", top:expandedEvs.has(idx)?26:20, right:25, width:2, height:"100%", background:T.border, zIndex:0 }} />
                  )}
                  <TLEvent ev={ev} expanded={expandedEvs.has(idx)} onToggle={()=>toggleEv(idx)} />
                </div>
                {idx<events.length-1 && (()=>{
                  const pairs: [string,string][] = [
                    [selectedItem!.createdAt, selectedItem!.firedAt??selectedItem!.doneAt??selectedItem!.servedAt??nowIso()],
                    [selectedItem!.firedAt??selectedItem!.createdAt, selectedItem!.doneAt??selectedItem!.servedAt??nowIso()],
                    [selectedItem!.doneAt??selectedItem!.firedAt??selectedItem!.createdAt, selectedItem!.servedAt??nowIso()],
                    [selectedItem!.servedAt??selectedItem!.doneAt??selectedItem!.createdAt, nowIso()],
                  ];
                  const [t1,t2] = pairs[idx] ?? [null,null];
                  if (!t1||!t2) return null;
                  const m = diffMin(t1,t2);
                  const c = m>15?T.red:m>8?T.orange:T.green;
                  return (
                    <div style={{ display:"flex", alignItems:"center", gap:5, padding:"0 16px 0 36px", margin:"-2px 0", position:"relative", zIndex:1 }}>
                      <div style={{ flex:1, height:1, background:T.border }} />
                      <div style={{ fontSize:10, fontWeight:700, padding:"1px 6px", borderRadius:999, background:c+"22", color:c, border:`1px solid ${c}33`, whiteSpace:"nowrap" }}>
                        {m} דק׳{m>15?" ⚠":""}
                      </div>
                      <div style={{ flex:1, height:1, background:T.border }} />
                    </div>
                  );
                })()}
              </React.Fragment>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
