"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { T, btn, btnGhost } from "@/lib/ui";

// ── Types ──────────────────────────────────────────────────────────────────

interface TLItem {
  id: string; name: string; basePrice: number; quantity: number; price: number;
  notes: string | null; itemStatus: string; course: number;
  heldUntilFired: boolean; firedAt: string | null; doneAt: string | null;
  servedAt: string | null; createdAt: string; isComped: boolean;
}
interface StatusLog { fromStatus: string; toStatus: string; changedAt: string; changedBy: string | null; }
interface TLOrder {
  id: string; orderNumber: number | null; status: string; totalAmount: number;
  coversCount: number | null; createdAt: string; items: TLItem[]; statusLogs: StatusLog[];
}
interface TableData {
  tableNumber: string; status: "green" | "red" | "purple"; statusTag: string;
  coversCount: number; totalAmount: number; ageMin: number; startedAt: string;
  itemCount: number; orders: TLOrder[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(iso: string) {
  return new Date(iso).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
}
function diffMin(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000);
}
function nowIso() { return new Date().toISOString(); }

// menu-engineering color bar: yellow=star(high price), blue=workhorse, gray=other
function meColor(item: TLItem): string {
  if (item.basePrice >= 80)  return "#fbbf24"; // star
  if (item.basePrice >= 35)  return "#60a5fa"; // workhorse
  return "#d1cdc7";
}
function meLabel(item: TLItem): string {
  if (item.basePrice >= 80)  return "כוכב";
  if (item.basePrice >= 35)  return "סוס עבודה";
  return "—";
}

function statusColor(s: "green" | "red" | "purple") {
  if (s === "red")    return T.red;
  if (s === "purple") return T.purple;
  return T.green;
}
function statusBg(s: "green" | "red" | "purple") {
  if (s === "red")    return T.redSub;
  if (s === "purple") return T.purpleSub;
  return T.greenSub;
}

function itemStatusLabel(s: string) {
  const m: Record<string, string> = {
    PENDING: "ממתין", PREPARING: "מכין 🔥", DONE: "מוכן ✓", DELIVERED: "הוגש",
  };
  return m[s] ?? s;
}
function itemStatusColor(s: string) {
  if (s === "DONE")      return T.green;
  if (s === "PREPARING") return T.orange;
  if (s === "DELIVERED") return T.muted;
  return T.blue;
}

// build timeline events from a single item
function buildEvents(item: TLItem): { time: string; title: string; body: string; kind: "ok" | "warn" | "error" | "muted" }[] {
  const evs: ReturnType<typeof buildEvents> = [];
  evs.push({ time: fmt(item.createdAt), title: "הזמנה נקלטה", body: `${item.quantity}× ${item.name}${item.notes ? ` — ${item.notes}` : ""}`, kind: "ok" });
  if (item.firedAt) {
    const waitMin = diffMin(item.createdAt, item.firedAt);
    evs.push({ time: fmt(item.firedAt), title: "נשלח למטבח", body: `${waitMin > 0 ? `${waitMin} דקות מהזמנה` : "מיידי"} — כניסה לתחנה`, kind: "ok" });
  }
  if (item.firedAt && !item.doneAt) {
    const prepMin = diffMin(item.firedAt, nowIso());
    if (prepMin > 15) {
      evs.push({ time: "—", title: "עיכוב חריג בהכנה", body: `${prepMin} דקות מאז ה-fire — מעל לתקן`, kind: "error" });
    }
  }
  if (item.doneAt) {
    const prepMin = item.firedAt ? diffMin(item.firedAt, item.doneAt) : null;
    const isLate = prepMin !== null && prepMin > 15;
    evs.push({
      time: fmt(item.doneAt), title: "הכנה הושלמה",
      body: prepMin !== null ? `${prepMin} דקות הכנה${isLate ? " — חריגה מהתקן!" : ""}` : "הכנה הסתיימה",
      kind: isLate ? "warn" : "ok",
    });
  }
  if (item.servedAt) {
    const waitMin = item.doneAt ? diffMin(item.doneAt, item.servedAt) : null;
    evs.push({ time: fmt(item.servedAt), title: "הוגש לשולחן", body: waitMin !== null ? `${waitMin} דקות מסיום הכנה` : "הגשה לשולחן", kind: "ok" });
  }
  return evs;
}

// ── Sub-components ─────────────────────────────────────────────────────────

function FloorCard({ t, selected, onClick }: {
  t: TableData; selected: boolean; onClick: () => void;
}) {
  const c = statusColor(t.status);
  return (
    <div
      onClick={onClick}
      style={{
        borderRadius: 12, border: `1.5px solid ${selected ? "#1a1a1a" : T.border}`,
        background: T.surface, padding: "10px 10px 10px 12px",
        cursor: "pointer", position: "relative", overflow: "hidden",
        minHeight: 88, display: "flex", flexDirection: "column",
        justifyContent: "space-between",
        boxShadow: selected ? `0 0 0 2px #1a1a1a` : undefined,
        transition: "box-shadow 0.1s, transform 0.1s",
        transform: selected ? "translateY(-1px)" : undefined,
      }}
    >
      {/* right stripe */}
      <div style={{
        position: "absolute", top: 0, right: 0,
        width: 4, height: "100%", background: c,
        borderRadius: "0 10px 10px 0",
      }} />
      <div style={{ paddingRight: 8 }}>
        <div style={{ fontSize: 20, fontWeight: 900, color: c, lineHeight: 1 }}>
          {t.tableNumber.padStart(2, "0")}
        </div>
        <div style={{ fontSize: 10, color: T.muted, marginTop: 3, lineHeight: 1.3 }}>
          {t.coversCount > 0 ? `${t.coversCount} קאברים` : ""}
          {t.ageMin > 0 ? ` · ${t.ageMin} דק׳` : ""}
        </div>
      </div>
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 3,
        marginTop: 6, padding: "2px 7px", borderRadius: 999,
        fontSize: 10, fontWeight: 700,
        background: statusBg(t.status), color: c,
        width: "fit-content",
      }}>
        {t.statusTag}
      </div>
    </div>
  );
}

function TimelineEvent({ ev, expanded, onToggle }: {
  ev: { time: string; title: string; body: string; kind: "ok" | "warn" | "error" | "muted" };
  expanded: boolean; onToggle: () => void;
}) {
  const dotColor = ev.kind === "ok" ? T.green : ev.kind === "error" ? T.red : ev.kind === "warn" ? T.orange : T.muted;
  return (
    <div style={{ display: "flex", gap: 10, padding: expanded ? "9px 18px" : "5px 18px", position: "relative", cursor: "pointer" }} onClick={onToggle}>
      <div style={{
        width: expanded ? 18 : 12, height: expanded ? 18 : 12,
        borderRadius: "50%", flexShrink: 0, marginTop: 3,
        background: dotColor + "25", border: `2px solid ${dotColor}66`,
        zIndex: 1, transition: "all 0.15s",
      }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 10, color: T.muted, fontWeight: 700, fontFamily: "monospace" }}>{ev.time}</div>
        <div style={{ fontSize: expanded ? 13 : 12, fontWeight: expanded ? 800 : 600, color: ev.kind === "error" ? T.red : T.text, marginTop: 1 }}>{ev.title}</div>
        {expanded && (
          <div style={{ fontSize: 11, color: T.sub, marginTop: 3, lineHeight: 1.5 }}>{ev.body}</div>
        )}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function TableTimelineClient({ restaurants }: { restaurants: { id: string; name: string }[] }) {
  const [rid, setRid] = useState(restaurants[0]?.id ?? "");
  const [tables, setTables] = useState<TableData[]>([]);
  const [loading, setLoading] = useState(true);

  const [floorMin, setFloorMin] = useState(false);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<TLItem | null>(null);
  const [expandedEvents, setExpandedEvents] = useState<Set<number>>(new Set());

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    if (!rid) return;
    try {
      const res = await fetch(`/api/admin/orders/table-timeline?restaurantId=${rid}`);
      if (res.ok) {
        const d = await res.json();
        setTables(d.tables ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [rid]);

  useEffect(() => {
    setLoading(true);
    load();
    timerRef.current = setInterval(load, 15000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [load]);

  const selectedTableData = tables.find(t => t.tableNumber === selectedTable) ?? null;
  const allItems = selectedTableData?.orders.flatMap(o => o.items) ?? [];

  function handleSelectTable(tableNumber: string) {
    if (selectedTable === tableNumber) {
      setSelectedTable(null);
      setSelectedItem(null);
    } else {
      setSelectedTable(tableNumber);
      setSelectedItem(null);
    }
  }

  function handleSelectItem(item: TLItem) {
    setSelectedItem(item);
    setExpandedEvents(new Set());
  }

  function toggleEvent(idx: number) {
    setExpandedEvents(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  }

  const events = selectedItem ? buildEvents(selectedItem) : [];

  const restName = restaurants.find(r => r.id === rid)?.name ?? "";

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div style={{
      direction: "rtl", fontFamily: "'Heebo', Arial, sans-serif",
      background: T.bg, minHeight: "100vh", color: T.text,
      display: "flex", flexDirection: "column",
    }}>
      {/* ── Page header ── */}
      <div style={{ padding: "20px 28px 0", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ fontSize: 22, fontWeight: 900 }}>מפת שולחנות חיה</div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {/* legend */}
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            {[{ c: T.green, l: "תקין" }, { c: T.red, l: "עיכוב שירות" }, { c: T.purple, l: "פעולת AI" }].map(({ c, l }) => (
              <div key={l} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: T.sub }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />
                {l}
              </div>
            ))}
          </div>
          {/* restaurant selector */}
          {restaurants.length > 1 && (
            <select
              value={rid} onChange={e => setRid(e.target.value)}
              style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, fontSize: 13, padding: "5px 10px" }}
            >
              {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          )}
          {restaurants.length === 1 && (
            <div style={{ fontSize: 13, color: T.muted }}>{restName}</div>
          )}
        </div>
      </div>

      <div style={{ height: 1, background: T.border, margin: "14px 28px 0", flexShrink: 0 }} />

      {/* ── Floor section ── */}
      <div style={{ padding: "14px 28px 0", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, letterSpacing: "0.07em", textTransform: "uppercase" }}>
            מצב המסעדה עכשיו
            {loading && <span style={{ marginRight: 8, fontSize: 10, color: T.muted }}>טוען...</span>}
          </div>
          <button
            onClick={() => setFloorMin(v => !v)}
            style={{ ...btnGhost(T.muted, "sm"), fontSize: 11 }}
          >
            {floorMin ? "▼ הצג מפה" : "▲ מזעור"}
          </button>
        </div>

        {!floorMin && (
          <div style={{
            display: "grid",
            gridTemplateColumns: `repeat(${Math.min(Math.max(tables.length, 4), 8)}, 1fr)`,
            gap: 8,
          }}>
            {tables.map(t => (
              <FloorCard
                key={t.tableNumber}
                t={t}
                selected={selectedTable === t.tableNumber}
                onClick={() => handleSelectTable(t.tableNumber)}
              />
            ))}
            {tables.length === 0 && !loading && (
              <div style={{ gridColumn: "1/-1", padding: "20px 0", textAlign: "center", color: T.muted, fontSize: 13 }}>
                אין שולחנות פעילים כרגע
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Expand panel (slides when table selected) ── */}
      {selectedTableData && !floorMin && (
        <div style={{
          margin: "10px 28px 0",
          background: T.surface,
          border: `1.5px solid ${T.border}`,
          borderRadius: 14,
          padding: "14px 20px",
          display: "flex", alignItems: "center", gap: 20,
          flexShrink: 0,
        }}>
          <div style={{ fontSize: 36, fontWeight: 900, color: statusColor(selectedTableData.status), lineHeight: 1, flexShrink: 0 }}>
            {selectedTableData.tableNumber.padStart(2, "0")}
          </div>
          <div style={{ flex: 1, borderRight: `1.5px solid ${T.border}`, paddingRight: 18 }}>
            <div style={{ fontSize: 15, fontWeight: 800 }}>שולחן {selectedTableData.tableNumber} (נבחר)</div>
            <div style={{ fontSize: 12, color: T.muted, marginTop: 3 }}>
              {selectedTableData.coversCount > 0 ? `${selectedTableData.coversCount} קאברים · ` : ""}
              {selectedTableData.ageMin} דקות פעיל
            </div>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 3,
              marginTop: 6, padding: "3px 9px", borderRadius: 999,
              fontSize: 11, fontWeight: 700,
              background: statusBg(selectedTableData.status),
              color: statusColor(selectedTableData.status),
            }}>
              {selectedTableData.statusTag}
            </div>
          </div>
          <div style={{ display: "flex", gap: 20, flexShrink: 0 }}>
            {[
              { val: selectedTableData.itemCount, lbl: "מנות" },
              { val: selectedTableData.ageMin, lbl: "דקות" },
              { val: `₪${Math.round(selectedTableData.totalAmount)}`, lbl: "סה״כ" },
            ].map(({ val, lbl }) => (
              <div key={lbl} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 20, fontWeight: 900 }}>{val}</div>
                <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{lbl}</div>
              </div>
            ))}
          </div>
          <button onClick={() => setSelectedTable(null)} style={{ ...btnGhost(T.muted, "sm") }}>✕</button>
        </div>
      )}

      {/* ── Main panels ── */}
      <div style={{
        display: "flex", gap: 14,
        padding: "12px 28px 24px",
        flex: 1, minHeight: 0, overflow: "hidden",
      }}>

        {/* Layer 2: Order detail */}
        <div style={{
          flex: 1, background: T.surface, borderRadius: 16,
          border: `1px solid ${T.border}`,
          display: "flex", flexDirection: "column", overflow: "hidden",
          minHeight: 300,
        }}>
          <div style={{ padding: "14px 18px 10px", borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 800, display: "flex", alignItems: "center", gap: 6 }}>
              📋 פירוט הזמנות שולחן{selectedTable ? ` ${selectedTable}` : ""}
            </div>
            <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>
              {selectedTable ? "לחץ על מנה לצפייה בציר הזמן" : "בחר שולחן למעלה"}
            </div>
          </div>

          {/* matrix legend */}
          <div style={{ display: "flex", gap: 10, padding: "8px 18px 6px", borderBottom: `1px solid ${T.borderSub}`, flexShrink: 0 }}>
            {[{ c: "#fbbf24", l: "כוכב" }, { c: "#60a5fa", l: "סוס עבודה" }, { c: "#d1cdc7", l: "רגיל" }].map(({ c, l }) => (
              <div key={l} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: T.muted, fontWeight: 600 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: c }} />{l}
              </div>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: "auto" }}>
            {allItems.length === 0 && (
              <div style={{ padding: "40px 0", textAlign: "center", color: T.muted, fontSize: 13 }}>
                {selectedTable ? "אין מנות" : "בחר שולחן לצפייה"}
              </div>
            )}
            {allItems.map(item => (
              <div
                key={item.id}
                onClick={() => handleSelectItem(item)}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "11px 18px",
                  borderBottom: `1px solid ${T.borderSub}`,
                  cursor: "pointer",
                  background: selectedItem?.id === item.id ? T.raised : undefined,
                  transition: "background 0.1s",
                }}
              >
                <div style={{ width: 4, height: 34, borderRadius: 2, background: meColor(item), flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{item.quantity > 1 ? `${item.quantity}× ` : ""}{item.name}</div>
                  <div style={{ fontSize: 11, color: T.muted, marginTop: 1 }}>
                    {meLabel(item)}
                    {item.notes ? ` · ${item.notes}` : ""}
                  </div>
                </div>
                <div style={{
                  fontSize: 11, fontWeight: 700, padding: "2px 8px",
                  borderRadius: 6, flexShrink: 0,
                  background: itemStatusColor(item.itemStatus) + "22",
                  color: itemStatusColor(item.itemStatus),
                }}>
                  {itemStatusLabel(item.itemStatus)}
                </div>
                {item.firedAt && (
                  <div style={{
                    fontSize: 11, fontWeight: 700, padding: "2px 8px",
                    borderRadius: 6, flexShrink: 0,
                    background: (() => {
                      const m = diffMin(item.firedAt!, item.doneAt ?? nowIso());
                      return m > 15 ? T.redSub : m > 10 ? T.orangeSub : T.greenSub;
                    })(),
                    color: (() => {
                      const m = diffMin(item.firedAt!, item.doneAt ?? nowIso());
                      return m > 15 ? T.red : m > 10 ? T.orange : T.green;
                    })(),
                  }}>
                    {diffMin(item.firedAt, item.doneAt ?? nowIso())} דק׳
                  </div>
                )}
                <div style={{ color: T.muted, fontSize: 13, flexShrink: 0 }}>›</div>
              </div>
            ))}
          </div>
        </div>

        {/* Layer 3: Timeline */}
        <div style={{
          width: 380, flexShrink: 0, background: T.surface, borderRadius: 16,
          border: `1px solid ${T.border}`,
          display: "flex", flexDirection: "column", overflow: "hidden",
          minHeight: 300,
        }}>
          <div style={{ padding: "14px 18px 10px", borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 800, display: "flex", alignItems: "center", gap: 6 }}>
              ⏱ ציר זמן ומעקב ייצור
            </div>
            <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>
              {selectedItem ? `${selectedItem.name} — שולחן ${selectedTable}` : "בחר מנה לצפייה"}
            </div>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "4px 0 16px" }}>
            {events.length === 0 && (
              <div style={{ padding: "40px 0", textAlign: "center", color: T.muted, fontSize: 13 }}>
                {selectedItem ? "אין נתוני ציר זמן" : "בחר מנה לצפייה"}
              </div>
            )}
            {events.map((ev, idx) => (
              <React.Fragment key={idx}>
                <div style={{ position: "relative" }}>
                  {/* connecting line */}
                  {idx < events.length - 1 && (
                    <div style={{
                      position: "absolute",
                      top: expandedEvents.has(idx) ? 28 : 22,
                      right: 27,
                      width: 2, height: "100%",
                      background: T.border, zIndex: 0,
                    }} />
                  )}
                  <TimelineEvent ev={ev} expanded={expandedEvents.has(idx)} onToggle={() => toggleEvent(idx)} />
                </div>
                {/* duration badge */}
                {idx < events.length - 1 && events[idx + 1] && ev.time !== "—" && events[idx + 1].time !== "—" && (() => {
                  const t1 = selectedItem ? (
                    idx === 0 ? selectedItem.createdAt :
                    idx === 1 ? (selectedItem.firedAt ?? selectedItem.createdAt) :
                    idx === 2 ? (selectedItem.doneAt ?? selectedItem.firedAt ?? selectedItem.createdAt) :
                    selectedItem.servedAt ?? selectedItem.doneAt ?? selectedItem.createdAt
                  ) : null;
                  const t2 = selectedItem ? (
                    idx === 0 ? (selectedItem.firedAt ?? selectedItem.doneAt ?? selectedItem.servedAt ?? nowIso()) :
                    idx === 1 ? (selectedItem.doneAt ?? selectedItem.servedAt ?? nowIso()) :
                    idx === 2 ? (selectedItem.servedAt ?? nowIso()) :
                    nowIso()
                  ) : null;
                  if (!t1 || !t2) return null;
                  const min = diffMin(t1, t2);
                  const isLate = min > 15;
                  const isWarn = min > 8;
                  return (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 18px 0 40px", margin: "-2px 0", position: "relative", zIndex: 1 }}>
                      <div style={{ flex: 1, height: 1, background: T.border }} />
                      <div style={{
                        fontSize: 10, fontWeight: 700, padding: "1px 7px",
                        borderRadius: 999,
                        background: isLate ? T.redSub : isWarn ? T.orangeSub : T.greenSub,
                        color: isLate ? T.red : isWarn ? T.orange : T.green,
                        border: `1px solid ${isLate ? T.red : isWarn ? T.orange : T.green}33`,
                        whiteSpace: "nowrap",
                      }}>
                        {min} דק׳{isLate ? " ⚠" : ""}
                      </div>
                      <div style={{ flex: 1, height: 1, background: T.border }} />
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
