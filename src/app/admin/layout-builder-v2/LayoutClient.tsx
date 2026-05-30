"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";

/* ── Types ── */
type TableStatus = "available" | "occupied" | "reserved" | "unavailable";
type TableShape  = "square" | "round" | "oval" | "rectangle";

type FreeTable = {
  id: string;
  tableNumber: string;
  seats: number;
  shape: TableShape;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  status: TableStatus;
};

type Room = {
  id: string;
  name: string;
  tables: FreeTable[];
  background: "grid" | "dots" | "plain";
};

type LayoutV2 = { version: 2; rooms: Room[] };
type Restaurant = { id: string; name: string };

/* ── Status config ── */
const STATUS: Record<TableStatus, { label: string; color: string; bg: string }> = {
  available:   { label: "פנוי",    color: "#51cf66", bg: "rgba(81,207,102,0.13)" },
  occupied:    { label: "תפוס",    color: "#ff6b6b", bg: "rgba(255,107,107,0.13)" },
  reserved:    { label: "שמור",    color: "#fcc419", bg: "rgba(252,196,25,0.13)" },
  unavailable: { label: "לא זמין", color: "#868e96", bg: "rgba(134,142,150,0.13)" },
};

/* ── Color scheme ── */
const C = {
  pageBg:  "#1a1d23",
  cardBg:  "#212529",
  cnvBg:   "#181b20",
  border:  "#2d3239",
  inBg:    "#2d3239",
  inBrd:   "#3a3f47",
  text:    "#e9ecef",
  sub:     "#adb5bd",
  muted:   "#6c757d",
  amber:   "#fcc419",
  gold:    "#C9A84C",
  red:     "#ff6b6b",
  green:   "#51cf66",
} as const;

const DK_INPUT: React.CSSProperties = {
  background: C.inBg, border: `1px solid ${C.inBrd}`, color: C.text,
  borderRadius: 10, padding: "9px 13px", fontSize: 14, width: "100%",
  outline: "none", fontFamily: "inherit",
};

const CANVAS_W = 1600;
const CANVAS_H = 1000;

const DEFAULT_SIZES: Record<TableShape, { w: number; h: number }> = {
  square:    { w: 80,  h: 80  },
  round:     { w: 80,  h: 80  },
  oval:      { w: 120, h: 80  },
  rectangle: { w: 120, h: 70  },
};

function uid() { return Math.random().toString(36).slice(2, 10); }

function mkRoom(name = "חדר ראשי"): Room {
  return { id: uid(), name, tables: [], background: "grid" };
}

function mkTable(x: number, y: number): FreeTable {
  return { id: uid(), tableNumber: "", seats: 4, shape: "square", x, y, width: 80, height: 80, rotation: 0, status: "available" };
}

function emptyLayout(): LayoutV2 {
  return { version: 2, rooms: [mkRoom()] };
}

/* ── Chair helpers ── */
function ChairsRound({ w, h, seats }: { w: number; h: number; seats: number }) {
  const pad = 14;
  const cSz = 10;
  return (
    <>
      {Array.from({ length: seats }).map((_, i) => {
        const a  = (i / seats) * 2 * Math.PI - Math.PI / 2;
        const rx = w / 2 + pad;
        const ry = h / 2 + pad;
        return (
          <div key={i} style={{
            position: "absolute",
            width: cSz, height: cSz,
            left: w / 2 + rx * Math.cos(a) - cSz / 2,
            top:  h / 2 + ry * Math.sin(a) - cSz / 2,
            borderRadius: "50%",
            background: "#92400e",
            boxShadow: "0 1px 2px rgba(0,0,0,0.3)",
            pointerEvents: "none",
          }} />
        );
      })}
    </>
  );
}

function ChairsRect({ w, h, seats }: { w: number; h: number; seats: number }) {
  const gap = 5; const cW = 10; const cH = 7;
  const perSide = Math.ceil(seats / 4);
  const top    = Math.ceil(seats / 2);
  const bottom = Math.floor(seats / 2);
  const els: React.ReactNode[] = [];
  for (let i = 0; i < top; i++) {
    const x = (w / (top + 1)) * (i + 1) - cW / 2;
    els.push(<div key={`t${i}`} style={{ position:"absolute", width:cW, height:cH, left:x, top:-cH-gap, borderRadius:2, background:"#92400e", pointerEvents:"none" }} />);
  }
  for (let i = 0; i < bottom; i++) {
    const x = (w / (bottom + 1)) * (i + 1) - cW / 2;
    els.push(<div key={`b${i}`} style={{ position:"absolute", width:cW, height:cH, left:x, top:h+gap, borderRadius:2, background:"#92400e", pointerEvents:"none" }} />);
  }
  return <>{els}</>;
}

/* ── Table visual ── */
function TableVisual({
  table, selected,
  onMouseDown, onClick, onDoubleClick, onContextMenu,
}: {
  table: FreeTable; selected: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onClick:     (e: React.MouseEvent) => void;
  onDoubleClick: (e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  const { width: w, height: h, shape, status, tableNumber, seats, rotation } = table;
  const st  = STATUS[status];
  const isRound = shape === "round" || shape === "oval";
  const br  = isRound ? "50%" : 10;
  const fSz = Math.max(10, Math.min(w, h) * 0.22);
  const subSz = Math.max(8, Math.min(w, h) * 0.13);

  return (
    <div
      style={{
        position: "absolute",
        left: table.x, top: table.y,
        width: w, height: h,
        transform: `rotate(${rotation}deg)`,
        transformOrigin: "center",
        cursor: "grab",
        userSelect: "none",
        zIndex: selected ? 10 : 2,
      }}
      onMouseDown={onMouseDown}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
    >
      {selected && (
        <div style={{
          position: "absolute", inset: -5,
          borderRadius: isRound ? "50%" : 14,
          border: `2px dashed ${C.amber}`,
          pointerEvents: "none",
          boxShadow: `0 0 14px ${C.amber}55`,
          animation: "none",
        }} />
      )}

      {/* Chairs */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {isRound
          ? <ChairsRound w={w} h={h} seats={seats} />
          : <ChairsRect  w={w} h={h} seats={seats} />
        }
      </div>

      {/* Table body */}
      <div style={{
        position: "absolute", inset: 0,
        borderRadius: br,
        background: `linear-gradient(145deg, ${st.bg}, ${st.bg})`,
        border: `2px solid ${st.color}50`,
        boxShadow: selected
          ? `0 0 0 2px ${C.amber}, 0 6px 24px rgba(0,0,0,0.45)`
          : "0 3px 12px rgba(0,0,0,0.35)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}>
        {/* Gloss */}
        <div style={{
          position: "absolute", top:0, left:0, right:0,
          height: "45%",
          background: "linear-gradient(180deg,rgba(255,255,255,0.07) 0%,transparent 100%)",
          borderRadius: `${br}px ${br}px 0 0`,
          pointerEvents: "none",
        }} />
        {/* Status dot */}
        <div style={{
          position: "absolute", top: 6, right: 6,
          width: 7, height: 7, borderRadius: "50%",
          background: st.color,
          boxShadow: `0 0 6px ${st.color}`,
          pointerEvents: "none",
        }} />
        <span style={{ fontSize: fSz, fontWeight: 900, color: C.text, lineHeight: 1, zIndex: 1 }}>
          {tableNumber || "?"}
        </span>
        <span style={{ fontSize: subSz, color: C.sub, zIndex: 1, marginTop: 2 }}>
          {seats}
        </span>
      </div>
    </div>
  );
}

/* ── Minimap ── */
function Minimap({
  room, panX, panY, zoom, vw, vh,
}: {
  room: Room | undefined;
  panX: number; panY: number; zoom: number;
  vw: number; vh: number;
}) {
  if (!room) return null;
  const MW = 180; const MH = 110;
  const sx = MW / CANVAS_W; const sy = MH / CANVAS_H;
  const vpX = -panX / zoom;
  const vpY = -panY / zoom;
  const vpW = vw / zoom;
  const vpH = vh / zoom;

  return (
    <div style={{
      position: "absolute", bottom: 16, right: 16,
      width: MW, height: MH,
      background: "rgba(24,27,32,0.97)",
      border: `1px solid ${C.border}`,
      borderRadius: 8,
      overflow: "hidden",
      zIndex: 100,
      boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
    }}>
      {room.tables.map(t => (
        <div key={t.id} style={{
          position: "absolute",
          left:   t.x * sx,
          top:    t.y * sy,
          width:  Math.max(4, t.width  * sx),
          height: Math.max(4, t.height * sy),
          background: STATUS[t.status].color + "80",
          borderRadius: t.shape === "round" || t.shape === "oval" ? "50%" : 2,
          border: `1px solid ${STATUS[t.status].color}`,
        }} />
      ))}
      <div style={{
        position: "absolute",
        left:   Math.max(0, Math.min(MW - 10, vpX * sx)),
        top:    Math.max(0, Math.min(MH - 10, vpY * sy)),
        width:  Math.min(MW, Math.max(10, vpW * sx)),
        height: Math.min(MH, Math.max(10, vpH * sy)),
        border: `1.5px solid ${C.amber}`,
        background: `${C.amber}18`,
        pointerEvents: "none",
        borderRadius: 2,
      }} />
      <div style={{ position:"absolute", bottom:2, left:4, fontSize:9, color:C.muted, userSelect:"none" }}>
        {Math.round(zoom * 100)}%
      </div>
    </div>
  );
}

/* ── Label helper ── */
const Lbl = ({ t }: { t: string }) => (
  <div style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".06em", marginBottom:6 }}>{t}</div>
);

/* ── Btn helper ── */
function ActiveBtn({
  active, onClick, children, color = C.amber,
}: { active: boolean; onClick: () => void; children: React.ReactNode; color?: string }) {
  return (
    <button type="button" onClick={onClick} style={{
      flex: 1, padding: "8px 0", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer",
      background: active ? `linear-gradient(135deg,#8B6914,${C.gold})` : C.inBg,
      color: active ? "#fff" : C.sub,
      border: `1px solid ${active ? color : C.inBrd}`,
    }}>
      {children}
    </button>
  );
}

/* ── Main component ── */
export default function LayoutClient({ restaurants }: { restaurants: Restaurant[] }) {
  const [restaurantId, setRestaurantId] = useState(restaurants[0]?.id ?? "");
  const [layout, setLayout] = useState<LayoutV2>(emptyLayout());
  const [roomIdx, setRoomIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [origin, setOrigin] = useState("");

  /* pan/zoom */
  const [panX, setPanX] = useState(40);
  const [panY, setPanY] = useState(40);
  const [zoom, setZoom] = useState(0.9);
  const isPanning   = useRef(false);
  const panStart    = useRef({ mx:0, my:0, px:0, py:0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const [vSize, setVSize] = useState({ w: 900, h: 560 });

  /* table drag */
  const draggingId = useRef<string|null>(null);
  const dragStart  = useRef({ mx:0, my:0, tx:0, ty:0 });
  const spaceDown  = useRef(false);
  const didDrag    = useRef(false);

  /* selections / modals */
  const [selId, setSelId]       = useState<string|null>(null);
  const [ctxMenu, setCtxMenu]   = useState<{ x:number; y:number; id:string }|null>(null);
  const [editId, setEditId]     = useState<string|null>(null);
  const [editForm, setEditForm] = useState({ tableNumber:"", seats:"4", shape:"square" as TableShape, status:"available" as TableStatus, width:"80", height:"80", rotation:"0" });
  const [showStats, setShowStats]   = useState(false);
  const [showNewRoom, setShowNewRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");

  useEffect(() => { setOrigin(window.location.origin); }, []);
  useEffect(() => { if (restaurants[0]?.id) loadLayout(restaurants[0].id); }, []); // eslint-disable-line

  /* resize observer */
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) setVSize({ w: e.contentRect.width, h: e.contentRect.height });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  async function loadLayout(rid: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/restaurants/${rid}/layout`);
      if (res.ok) {
        const data = await res.json();
        if (data.tableLayoutJson) {
          const parsed = JSON.parse(data.tableLayoutJson);
          setLayout(parsed.version === 2 ? parsed : emptyLayout());
        } else {
          setLayout(emptyLayout());
        }
      }
    } catch { setLayout(emptyLayout()); }
    setLoading(false);
  }

  async function saveLayout() {
    if (!restaurantId) return;
    setSaving(true);
    await fetch(`/api/admin/restaurants/${restaurantId}/layout`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tableLayoutJson: JSON.stringify(layout) }),
    });
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const activeRoom = layout.rooms[roomIdx] ?? layout.rooms[0];

  function updRoom(fn: (r: Room) => Room) {
    setLayout(prev => ({ ...prev, rooms: prev.rooms.map((r, i) => i === roomIdx ? fn(r) : r) }));
  }

  /* ── Table ops ── */
  function addTable() {
    const cx = (vSize.w / 2 - panX) / zoom - 40;
    const cy = (vSize.h / 2 - panY) / zoom - 40;
    const t = mkTable(Math.max(20, cx), Math.max(20, cy));
    updRoom(r => ({ ...r, tables: [...r.tables, t] }));
    setSelId(t.id);
    openEdit(t);
  }

  function openEdit(table: FreeTable) {
    setEditId(table.id);
    setEditForm({
      tableNumber: table.tableNumber,
      seats:       String(table.seats),
      shape:       table.shape,
      status:      table.status,
      width:       String(table.width),
      height:      String(table.height),
      rotation:    String(table.rotation),
    });
  }

  function saveEdit() {
    if (!editId) return;
    const w = Math.max(40, parseInt(editForm.width)  || 80);
    const h = Math.max(40, parseInt(editForm.height) || 80);
    updRoom(r => ({
      ...r,
      tables: r.tables.map(t => t.id !== editId ? t : {
        ...t,
        tableNumber: editForm.tableNumber,
        seats:       parseInt(editForm.seats) || 4,
        shape:       editForm.shape,
        status:      editForm.status,
        width: w, height: h,
        rotation: parseInt(editForm.rotation) || 0,
      }),
    }));
    setEditId(null);
  }

  function delTable(id: string) {
    updRoom(r => ({ ...r, tables: r.tables.filter(t => t.id !== id) }));
    if (selId === id) setSelId(null);
    setEditId(null);
    setCtxMenu(null);
  }

  function dupTable(id: string) {
    const t = activeRoom?.tables.find(t => t.id === id);
    if (!t) return;
    const nt: FreeTable = { ...t, id: uid(), x: t.x + 24, y: t.y + 24 };
    updRoom(r => ({ ...r, tables: [...r.tables, nt] }));
    setSelId(nt.id);
    setCtxMenu(null);
  }

  function setStatus(id: string, status: TableStatus) {
    updRoom(r => ({ ...r, tables: r.tables.map(t => t.id === id ? { ...t, status } : t) }));
    setCtxMenu(null);
  }

  /* ── Canvas events ── */
  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const factor = e.deltaY > 0 ? 0.88 : 1.12;
    const newZoom = Math.max(0.15, Math.min(4, zoom * factor));
    const ratio = newZoom / zoom;
    setPanX(mx - ratio * (mx - panX));
    setPanY(my - ratio * (my - panY));
    setZoom(newZoom);
  }

  function handleCanvasMouseDown(e: React.MouseEvent) {
    if (e.button === 1 || (e.button === 0 && spaceDown.current)) {
      e.preventDefault();
      isPanning.current = true;
      panStart.current = { mx: e.clientX, my: e.clientY, px: panX, py: panY };
    }
    if (e.button === 0 && (e.target as HTMLElement).dataset.canvas === "bg") {
      setSelId(null);
      setCtxMenu(null);
    }
  }

  function handleCanvasMouseMove(e: React.MouseEvent) {
    if (isPanning.current) {
      setPanX(panStart.current.px + e.clientX - panStart.current.mx);
      setPanY(panStart.current.py + e.clientY - panStart.current.my);
    } else if (draggingId.current) {
      didDrag.current = true;
      const dx = (e.clientX - dragStart.current.mx) / zoom;
      const dy = (e.clientY - dragStart.current.my) / zoom;
      updRoom(r => ({
        ...r,
        tables: r.tables.map(t => t.id !== draggingId.current ? t : {
          ...t,
          x: dragStart.current.tx + dx,
          y: dragStart.current.ty + dy,
        }),
      }));
    }
  }

  function handleCanvasMouseUp() {
    isPanning.current = false;
    draggingId.current = null;
  }

  function handleTableMouseDown(e: React.MouseEvent, table: FreeTable) {
    if (e.button !== 0 || spaceDown.current) return;
    e.stopPropagation();
    didDrag.current = false;
    draggingId.current = table.id;
    dragStart.current = { mx: e.clientX, my: e.clientY, tx: table.x, ty: table.y };
    setSelId(table.id);
    setCtxMenu(null);
  }

  function handleTableClick(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (!didDrag.current) setSelId(id);
  }

  function handleTableDblClick(e: React.MouseEvent, table: FreeTable) {
    e.stopPropagation();
    openEdit(table);
  }

  function handleTableCtx(e: React.MouseEvent, id: string) {
    e.preventDefault(); e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY, id });
    setSelId(id);
  }

  /* ── Keyboard ── */
  useEffect(() => {
    const selRef = { current: selId };
    selRef.current = selId;
    return undefined;
  }, [selId]);

  useEffect(() => {
    function down(e: KeyboardEvent) {
      if (e.code === "Space" && !e.repeat) { spaceDown.current = true; if (containerRef.current) containerRef.current.style.cursor = "grab"; }
      if (e.code === "Escape")           { setCtxMenu(null); setSelId(null); setEditId(null); }
    }
    function up(e: KeyboardEvent) {
      if (e.code === "Space") { spaceDown.current = false; if (containerRef.current) containerRef.current.style.cursor = "default"; }
    }
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  /* Delete key */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.code === "Delete" || e.code === "Backspace") && selId && !editId) {
        const tag = (document.activeElement as HTMLElement)?.tagName;
        if (tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") delTable(selId);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selId, editId]); // eslint-disable-line

  /* ── Room ops ── */
  function addRoom() {
    if (!newRoomName.trim()) return;
    const r = mkRoom(newRoomName.trim());
    setLayout(prev => ({ ...prev, rooms: [...prev.rooms, r] }));
    setRoomIdx(layout.rooms.length);
    setShowNewRoom(false); setNewRoomName("");
  }

  function delRoom(idx: number) {
    if (layout.rooms.length <= 1) return;
    if (!confirm(`למחוק את "${layout.rooms[idx].name}"?`)) return;
    setLayout(prev => ({ ...prev, rooms: prev.rooms.filter((_, i) => i !== idx) }));
    setRoomIdx(prev => Math.min(prev, layout.rooms.length - 2));
  }

  /* ── Stats ── */
  const roomStats = activeRoom ? {
    total:    activeRoom.tables.length,
    seats:    activeRoom.tables.reduce((s, t) => s + t.seats, 0),
    available:   activeRoom.tables.filter(t => t.status === "available").length,
    occupied:    activeRoom.tables.filter(t => t.status === "occupied").length,
    reserved:    activeRoom.tables.filter(t => t.status === "reserved").length,
    unavailable: activeRoom.tables.filter(t => t.status === "unavailable").length,
  } : { total:0, seats:0, available:0, occupied:0, reserved:0, unavailable:0 };

  /* ── Background CSS ── */
  function bgStyle(bg: Room["background"]): React.CSSProperties {
    if (bg === "grid") return {
      backgroundColor: C.cnvBg,
      backgroundImage: [
        "linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px)",
        "linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)",
      ].join(","),
      backgroundSize: "50px 50px",
    };
    if (bg === "dots") return {
      backgroundColor: C.cnvBg,
      backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.11) 1px, transparent 1px)",
      backgroundSize: "30px 30px",
    };
    return { backgroundColor: C.cnvBg };
  }

  /* ── Render ── */
  return (
    <div style={{ height:"calc(100vh - 64px)", display:"flex", flexDirection:"column", background:C.pageBg, color:C.text, overflow:"hidden" }}>

      {/* ── Top bar ── */}
      <div style={{ padding:"10px 20px", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", gap:10, flexShrink:0, background:C.cardBg }}>
        <h1 style={{ margin:0, fontSize:17, fontWeight:800, whiteSpace:"nowrap" }}>🗺 פריסת שולחנות חדש</h1>

        {restaurants.length > 1 && (
          <>
            <div style={{ width:1, height:20, background:C.border }} />
            <select value={restaurantId} onChange={e => { setRestaurantId(e.target.value); loadLayout(e.target.value); }}
              style={{ ...DK_INPUT, width:"auto", padding:"5px 10px", fontSize:13 }}>
              {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </>
        )}

        <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:8 }}>
          {/* Status chips */}
          {Object.entries(STATUS).map(([s, cfg]) => {
            const cnt = activeRoom?.tables.filter(t => t.status === s).length ?? 0;
            return cnt > 0 ? (
              <span key={s} style={{ fontSize:11, fontWeight:700, color:cfg.color, background:cfg.bg, padding:"2px 8px", borderRadius:20, border:`1px solid ${cfg.color}30` }}>
                {cfg.label} {cnt}
              </span>
            ) : null;
          })}

          <button onClick={() => setShowStats(true)}
            style={{ padding:"6px 12px", fontSize:12, borderRadius:8, border:`1px solid ${C.inBrd}`, background:C.inBg, color:C.sub, cursor:"pointer" }}>
            📊
          </button>
          <button onClick={addTable}
            style={{ padding:"6px 14px", fontSize:13, fontWeight:700, borderRadius:8, border:`1px solid ${C.amber}40`, background:`${C.amber}18`, color:C.amber, cursor:"pointer" }}>
            + שולחן
          </button>
          <button onClick={saveLayout} disabled={saving || !restaurantId}
            style={{ padding:"6px 18px", fontSize:13, fontWeight:700, borderRadius:8, color:"#fff", border:"none", cursor:"pointer", opacity:saving || !restaurantId ? 0.5 : 1, background:saved ? C.green : `linear-gradient(135deg,#8B6914,${C.gold})` }}>
            {saving ? "שומר..." : saved ? "✓ נשמר!" : "שמור"}
          </button>
        </div>
      </div>

      {/* ── Room tabs ── */}
      <div style={{ display:"flex", alignItems:"flex-end", padding:"0 20px", borderBottom:`1px solid ${C.border}`, background:C.cardBg, flexShrink:0, overflowX:"auto" }}>
        {layout.rooms.map((room, idx) => (
          <div key={room.id} style={{ display:"flex", alignItems:"center" }}>
            <button onClick={() => setRoomIdx(idx)}
              style={{
                padding:"8px 14px", fontSize:13, fontWeight:idx===roomIdx ? 700:500, cursor:"pointer",
                background:"none", border:"none",
                borderBottom:idx===roomIdx ? `2px solid ${C.amber}` : "2px solid transparent",
                color:idx===roomIdx ? C.amber : C.sub,
                marginBottom:-1, whiteSpace:"nowrap",
              }}>
              {room.name}
            </button>
            {layout.rooms.length > 1 && (
              <button onClick={() => delRoom(idx)}
                style={{ fontSize:13, color:C.muted, background:"none", border:"none", cursor:"pointer", padding:"0 4px", lineHeight:1 }}>×</button>
            )}
          </div>
        ))}
        <button onClick={() => setShowNewRoom(true)}
          style={{ padding:"8px 10px", fontSize:12, color:C.muted, background:"none", border:"none", cursor:"pointer", whiteSpace:"nowrap" }}>
          + חדר
        </button>

        {/* Background selector */}
        <div style={{ marginLeft:"auto", display:"flex", gap:4, paddingBottom:4, alignItems:"center" }}>
          <span style={{ fontSize:11, color:C.muted }}>רקע:</span>
          {(["grid","dots","plain"] as const).map(bg => (
            <button key={bg} onClick={() => updRoom(r => ({ ...r, background:bg }))}
              style={{
                padding:"3px 9px", fontSize:11, borderRadius:6, cursor:"pointer",
                border:`1px solid ${activeRoom?.background===bg ? C.amber : C.border}`,
                background:activeRoom?.background===bg ? `${C.amber}18` : "none",
                color:activeRoom?.background===bg ? C.amber : C.muted,
              }}>
              {{ grid:"גריד", dots:"נקודות", plain:"נקי" }[bg]}
            </button>
          ))}
        </div>

        {/* Hint */}
        <div style={{ fontSize:11, color:C.muted, paddingBottom:6, paddingLeft:12, whiteSpace:"nowrap" }}>
          גלגלת = זום · אמצע/רווח+גרירה = הזזה · Delete = מחיקה
        </div>
      </div>

      {/* ── Canvas ── */}
      <div
        ref={containerRef}
        style={{ flex:1, position:"relative", overflow:"hidden", cursor:"default" }}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onMouseLeave={handleCanvasMouseUp}
        onWheel={handleWheel}
      >
        {loading ? (
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100%", color:C.muted, fontSize:15 }}>
            טוען פריסה...
          </div>
        ) : (
          <>
            {/* Transform wrapper */}
            <div style={{
              position:"absolute", top:0, left:0,
              transformOrigin:"0 0",
              transform:`translate(${panX}px,${panY}px) scale(${zoom})`,
            }}>
              {/* Canvas bg */}
              <div
                data-canvas="bg"
                style={{ width:CANVAS_W, height:CANVAS_H, position:"relative", ...bgStyle(activeRoom?.background ?? "grid") }}
              >
                {activeRoom?.tables.map(table => (
                  <TableVisual
                    key={table.id}
                    table={table}
                    selected={selId === table.id}
                    onMouseDown={e => handleTableMouseDown(e, table)}
                    onClick={e => handleTableClick(e, table.id)}
                    onDoubleClick={e => handleTableDblClick(e, table)}
                    onContextMenu={e => handleTableCtx(e, table.id)}
                  />
                ))}
              </div>
            </div>

            {/* Zoom controls */}
            <div style={{ position:"absolute", bottom:16, left:16, display:"flex", flexDirection:"column", gap:4, zIndex:100 }}>
              <button onClick={() => { const nz=Math.min(4,zoom*1.2); const mx=vSize.w/2; const my=vSize.h/2; const r=nz/zoom; setPanX(mx-r*(mx-panX)); setPanY(my-r*(my-panY)); setZoom(nz); }}
                style={{ width:32, height:32, borderRadius:8, border:`1px solid ${C.border}`, background:C.cardBg, color:C.text, cursor:"pointer", fontSize:18, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700 }}>+</button>
              <button onClick={() => { const nz=Math.max(0.15,zoom/1.2); const mx=vSize.w/2; const my=vSize.h/2; const r=nz/zoom; setPanX(mx-r*(mx-panX)); setPanY(my-r*(my-panY)); setZoom(nz); }}
                style={{ width:32, height:32, borderRadius:8, border:`1px solid ${C.border}`, background:C.cardBg, color:C.text, cursor:"pointer", fontSize:18, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700 }}>−</button>
              <button onClick={() => { setZoom(0.9); setPanX(40); setPanY(40); }}
                style={{ width:32, height:32, borderRadius:8, border:`1px solid ${C.border}`, background:C.cardBg, color:C.muted, cursor:"pointer", fontSize:10, display:"flex", alignItems:"center", justifyContent:"center" }}>↺</button>
            </div>

            {/* Minimap */}
            <Minimap room={activeRoom} panX={panX} panY={panY} zoom={zoom} vw={vSize.w} vh={vSize.h} />

            {/* Table count */}
            <div style={{ position:"absolute", top:12, left:16, fontSize:12, color:C.muted, background:"rgba(24,27,32,0.85)", padding:"4px 10px", borderRadius:20, border:`1px solid ${C.border}` }}>
              {roomStats.total} שולחנות · {roomStats.seats} מקומות
            </div>
          </>
        )}
      </div>

      {/* ── Context menu ── */}
      {ctxMenu && (
        <div
          style={{
            position:"fixed", left:ctxMenu.x, top:ctxMenu.y, zIndex:1000,
            background:C.cardBg, border:`1px solid ${C.border}`,
            borderRadius:10, boxShadow:"0 8px 32px rgba(0,0,0,0.5)",
            overflow:"hidden", minWidth:160,
          }}
          onMouseLeave={() => setCtxMenu(null)}
        >
          {[
            { icon:"✏️", label:"ערוך",   action: () => { const t=activeRoom?.tables.find(t=>t.id===ctxMenu.id); if(t){openEdit(t);} setCtxMenu(null); } },
            { icon:"📋", label:"שכפל",   action: () => dupTable(ctxMenu.id) },
            { icon:"⬆️", label:"הצא קדימה", action: () => { updRoom(r => { const arr=[...r.tables]; const i=arr.findIndex(t=>t.id===ctxMenu.id); if(i<arr.length-1){[arr[i],arr[i+1]]=[arr[i+1],arr[i]];} return {...r,tables:arr}; }); setCtxMenu(null); } },
            null, // separator
            ...Object.entries(STATUS).map(([s, cfg]) => ({
              icon: "●", label: cfg.label, color: cfg.color,
              action: () => setStatus(ctxMenu.id, s as TableStatus),
            })),
            null,
            { icon:"🗑", label:"מחק", color:C.red, action: () => delTable(ctxMenu.id) },
          ].map((item, i) => {
            if (item === null) return <div key={i} style={{ height:1, background:C.border }} />;
            return (
              <button key={i} onClick={item.action}
                style={{
                  display:"flex", alignItems:"center", gap:8, width:"100%",
                  padding:"9px 14px", fontSize:13,
                  color: (item as { color?: string }).color ?? C.text,
                  background:"none", border:"none", cursor:"pointer", textAlign:"right" as const,
                }}
                onMouseEnter={e=>(e.currentTarget.style.background=C.inBg)}
                onMouseLeave={e=>(e.currentTarget.style.background="none")}>
                <span style={{ minWidth:16 }}>{item.icon}</span>
                {item.label}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Edit table modal ── */}
      {editId && (() => {
        const tableUrl = editForm.tableNumber && restaurantId && origin
          ? `${origin}/menu/${restaurantId}?table=${encodeURIComponent(editForm.tableNumber)}`
          : null;
        return (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.65)", backdropFilter:"blur(4px)", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}
            onClick={() => setEditId(null)}>
            <div style={{ background:C.cardBg, borderRadius:18, border:`1px solid ${C.border}`, boxShadow:"0 24px 60px rgba(0,0,0,0.5)", width:"100%", maxWidth:400, padding:24, overflowY:"auto", maxHeight:"90vh" }}
              onClick={e => e.stopPropagation()}>
              <div style={{ fontSize:17, fontWeight:800, color:C.text, marginBottom:20 }}>✏️ הגדרת שולחן</div>

              <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
                {/* Number */}
                <div>
                  <Lbl t="מספר / שם שולחן" />
                  <input type="text" value={editForm.tableNumber} autoFocus style={DK_INPUT}
                    onChange={e => setEditForm(f => ({ ...f, tableNumber:e.target.value }))}
                    placeholder="1, A3, בר..." />
                </div>

                {/* Shape */}
                <div>
                  <Lbl t="צורת שולחן" />
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                    {([["square","⬜ מרובע"],["round","⭕ עגול"],["oval","🥚 אובלי"],["rectangle","▬ מלבן"]] as [TableShape,string][]).map(([shape,label]) => (
                      <ActiveBtn key={shape} active={editForm.shape===shape}
                        onClick={() => { const d=DEFAULT_SIZES[shape]; setEditForm(f=>({...f,shape,width:String(d.w),height:String(d.h)})); }}>
                        {label}
                      </ActiveBtn>
                    ))}
                  </div>
                </div>

                {/* Seats */}
                <div>
                  <Lbl t="מספר מקומות" />
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                    {[2,4,6,8,10,12].map(n => (
                      <ActiveBtn key={n} active={editForm.seats===String(n)} onClick={() => setEditForm(f=>({...f,seats:String(n)}))}>
                        {n}
                      </ActiveBtn>
                    ))}
                  </div>
                </div>

                {/* Status */}
                <div>
                  <Lbl t="סטטוס" />
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                    {Object.entries(STATUS).map(([s, cfg]) => (
                      <button key={s} type="button"
                        onClick={() => setEditForm(f=>({...f,status:s as TableStatus}))}
                        style={{
                          flex:1, padding:"8px 0", borderRadius:8, fontSize:12, fontWeight:700, cursor:"pointer",
                          background:editForm.status===s ? cfg.bg : C.inBg,
                          color:editForm.status===s ? cfg.color : C.sub,
                          border:`1px solid ${editForm.status===s ? cfg.color : C.inBrd}`,
                        }}>
                        {cfg.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Size */}
                <div>
                  <Lbl t="גודל וסיבוב" />
                  <div style={{ display:"flex", gap:10 }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:11, color:C.muted, marginBottom:4 }}>רוחב</div>
                      <input type="number" value={editForm.width} min="40" max="300" style={{ ...DK_INPUT, padding:"7px 10px" }}
                        onChange={e=>setEditForm(f=>({...f,width:e.target.value}))} />
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:11, color:C.muted, marginBottom:4 }}>גובה</div>
                      <input type="number" value={editForm.height} min="40" max="300" style={{ ...DK_INPUT, padding:"7px 10px" }}
                        onChange={e=>setEditForm(f=>({...f,height:e.target.value}))} />
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:11, color:C.muted, marginBottom:4 }}>סיבוב°</div>
                      <input type="number" value={editForm.rotation} min="-180" max="180" step="15" style={{ ...DK_INPUT, padding:"7px 10px" }}
                        onChange={e=>setEditForm(f=>({...f,rotation:e.target.value}))} />
                    </div>
                  </div>
                </div>

                {/* QR */}
                {tableUrl && (
                  <div style={{ border:`1px solid ${C.border}`, borderRadius:12, padding:14, background:C.inBg }}>
                    <Lbl t="QR לשולחן" />
                    <div style={{ display:"flex", justifyContent:"center", marginBottom:10 }}>
                      <div style={{ padding:10, background:"#fff", borderRadius:12, display:"inline-block" }}>
                        <QRCodeSVG value={tableUrl} size={140} />
                      </div>
                    </div>
                    <input readOnly value={tableUrl}
                      style={{ ...DK_INPUT, fontSize:11, color:C.muted }}
                      onClick={e=>(e.target as HTMLInputElement).select()} />
                  </div>
                )}
              </div>

              <div style={{ display:"flex", gap:8, marginTop:20 }}>
                <button onClick={saveEdit}
                  style={{ flex:1, padding:"10px 0", borderRadius:10, color:"#fff", fontWeight:700, fontSize:14, border:"none", cursor:"pointer", background:`linear-gradient(135deg,#8B6914,${C.gold})` }}>
                  שמור
                </button>
                <button onClick={() => delTable(editId)}
                  style={{ padding:"10px 16px", borderRadius:10, fontSize:14, fontWeight:600, cursor:"pointer", color:C.red, background:"rgba(255,107,107,0.1)", border:`1px solid rgba(255,107,107,0.25)` }}>
                  🗑
                </button>
                <button onClick={() => setEditId(null)}
                  style={{ padding:"10px 14px", borderRadius:10, fontSize:14, fontWeight:600, cursor:"pointer", color:C.sub, background:C.inBg, border:`1px solid ${C.inBrd}` }}>
                  ביטול
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Stats modal ── */}
      {showStats && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.65)", backdropFilter:"blur(4px)", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center" }}
          onClick={() => setShowStats(false)}>
          <div style={{ background:C.cardBg, borderRadius:18, border:`1px solid ${C.border}`, boxShadow:"0 24px 60px rgba(0,0,0,0.5)", width:340, padding:24 }}
            onClick={e=>e.stopPropagation()}>
            <div style={{ fontSize:17, fontWeight:800, color:C.text, marginBottom:20 }}>📊 סטטיסטיקות — {activeRoom?.name}</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              {[
                { label:"שולחנות",     val:roomStats.total,       color:C.amber },
                { label:"מקומות",      val:roomStats.seats,       color:C.gold },
                { label:"פנויים",      val:roomStats.available,   color:STATUS.available.color },
                { label:"תפוסים",      val:roomStats.occupied,    color:STATUS.occupied.color },
                { label:"שמורים",      val:roomStats.reserved,    color:STATUS.reserved.color },
                { label:"לא זמינים",   val:roomStats.unavailable, color:STATUS.unavailable.color },
              ].map(s => (
                <div key={s.label} style={{ background:C.inBg, borderRadius:12, padding:"14px 16px", border:`1px solid ${C.border}` }}>
                  <div style={{ fontSize:28, fontWeight:900, color:s.color }}>{s.val}</div>
                  <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>{s.label}</div>
                </div>
              ))}
            </div>
            <button onClick={() => setShowStats(false)}
              style={{ marginTop:16, width:"100%", padding:"10px 0", borderRadius:10, background:C.inBg, border:`1px solid ${C.inBrd}`, color:C.sub, cursor:"pointer", fontSize:14 }}>
              סגור
            </button>
          </div>
        </div>
      )}

      {/* ── New room modal ── */}
      {showNewRoom && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.65)", backdropFilter:"blur(4px)", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center" }}
          onClick={() => setShowNewRoom(false)}>
          <div style={{ background:C.cardBg, borderRadius:18, border:`1px solid ${C.border}`, boxShadow:"0 24px 60px rgba(0,0,0,0.5)", width:300, padding:24 }}
            onClick={e=>e.stopPropagation()}>
            <div style={{ fontSize:17, fontWeight:800, color:C.text, marginBottom:16 }}>+ חדר חדש</div>
            <input type="text" value={newRoomName} autoFocus style={DK_INPUT}
              placeholder="שם החדר..."
              onChange={e => setNewRoomName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addRoom()} />
            <div style={{ display:"flex", gap:8, marginTop:14 }}>
              <button onClick={addRoom}
                style={{ flex:1, padding:"10px 0", borderRadius:10, color:"#fff", fontWeight:700, border:"none", cursor:"pointer", background:`linear-gradient(135deg,#8B6914,${C.gold})` }}>
                הוסף
              </button>
              <button onClick={() => { setShowNewRoom(false); setNewRoomName(""); }}
                style={{ padding:"10px 14px", borderRadius:10, color:C.sub, background:C.inBg, border:`1px solid ${C.inBrd}`, cursor:"pointer" }}>
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
