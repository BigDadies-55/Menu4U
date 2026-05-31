"use client";

import React, { useState, useRef, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";

/* ══════════════════════════════ Types ══ */
type TableStatus = "free" | "reserved" | "seated" | "vip";
type TableShape  = "round" | "rect" | "square" | "oval" | "long" | "banquet";

type FreeTable = {
  id: string; num: number; name: string; group: string;
  shape: TableShape; x: number; y: number;
  w: number; h: number; seats: number; seatedCount: number;
  status: TableStatus; rot: number; customColor: string; zIdx: number;
};

type Room = {
  id: string; name: string; tables: FreeTable[];
  bg: number; bgImg?: string; bgOpacity?: number;
};

type LayoutV2  = { version: 2; rooms: Room[] };
type Restaurant = { id: string; name: string };

/* ══════════════════════════ Constants ══ */
const CANVAS_W = 3000;
const CANVAS_H = 2000;
const GRID     = 20;

const STATUS_CFG: Record<TableStatus, { label: string; bg: string; border: string; color: string }> = {
  free:     { label: "פנוי",  bg: "radial-gradient(circle at 40% 35%,#2a5c2a,#0f2e0f)", border: "#2e7d2e", color: "#4caf50" },
  reserved: { label: "שמור", bg: "radial-gradient(circle at 40% 35%,#5c2a00,#2e1200)", border: "#c87720", color: "#ff9800" },
  seated:   { label: "יושב", bg: "radial-gradient(circle at 40% 35%,#5c1414,#2e0a0a)", border: "#8b1a1a", color: "#f44336" },
  vip:      { label: "VIP",  bg: "radial-gradient(circle at 40% 35%,#5c4a00,#2e2500)", border: "#d4a017", color: "#ffd700" },
};

const SHAPE_BR: Record<TableShape, string> = {
  round: "50%", rect: "10px", square: "8px", oval: "50%/40%", long: "12px", banquet: "6px",
};

type PaletteItem = { icon: string; label: string; shape: TableShape; w: number; h: number; seats: number };

const PALETTE: PaletteItem[] = [
  { icon: "⭕", label: "עגול 6",    shape: "round",   w: 80,  h: 80,  seats: 6  },
  { icon: "🔵", label: "עגול 8",    shape: "round",   w: 100, h: 100, seats: 8  },
  { icon: "▬",  label: "מלבן 8",    shape: "rect",    w: 140, h: 80,  seats: 8  },
  { icon: "⬛", label: "מלבן 10",   shape: "rect",    w: 180, h: 80,  seats: 10 },
  { icon: "🔲", label: "ריבוע 4",   shape: "square",  w: 90,  h: 90,  seats: 4  },
  { icon: "🥚", label: "אובאלי 10", shape: "oval",    w: 130, h: 85,  seats: 10 },
  { icon: "📏", label: "ארוך 12",   shape: "long",    w: 220, h: 70,  seats: 12 },
  { icon: "🎉", label: "בנקט 16",   shape: "banquet", w: 280, h: 75,  seats: 16 },
];

const BGS = [
  { label: "קלאסי",  body: "#1a0a0a",
    cw: `repeating-linear-gradient(0deg,rgba(212,160,23,0.04) 0px,rgba(212,160,23,0.04) 1px,transparent 1px,transparent 40px),repeating-linear-gradient(90deg,rgba(212,160,23,0.04) 0px,rgba(212,160,23,0.04) 1px,transparent 1px,transparent 40px),radial-gradient(ellipse at 50% 50%,#2a0e0e 0%,#0d0404 100%)` },
  { label: "אמרלד",  body: "#0a150a",
    cw: `radial-gradient(ellipse at 30% 20%,#1a2a1a,#0a150a)` },
  { label: "זהב",    body: "#0a0800",
    cw: `repeating-linear-gradient(0deg,rgba(212,160,23,0.09) 0px,rgba(212,160,23,0.09) 1px,transparent 1px,transparent 40px),repeating-linear-gradient(90deg,rgba(212,160,23,0.09) 0px,rgba(212,160,23,0.09) 1px,transparent 1px,transparent 40px),radial-gradient(ellipse at 60% 40%,#1a1205,#0a0800)` },
  { label: "מלכותי", body: "#050510",
    cw: `repeating-linear-gradient(60deg,rgba(100,80,220,0.08) 0px,rgba(100,80,220,0.08) 1px,transparent 1px,transparent 40px),radial-gradient(ellipse at 50% 50%,#0a0a20,#050510)` },
  { label: "בורדו",  body: "#0a0502",
    cw: `repeating-linear-gradient(30deg,rgba(180,80,20,0.09) 0px,rgba(180,80,20,0.09) 1px,transparent 1px,transparent 40px),radial-gradient(ellipse at 40% 60%,#1a0a05,#0a0502)` },
  { label: "שמנת",   body: "#f5f0e8",
    cw: `linear-gradient(135deg,#f5f0e8 0%,#e8dcc8 50%,#f0e8d8 100%)` },
];

/* ══════════════════════════ Helpers ══ */
function uid() { return Math.random().toString(36).slice(2, 10); }
function mkRoom(name = "חדר ראשי"): Room { return { id: uid(), name, tables: [], bg: 0 }; }
function emptyLayout(): LayoutV2 { return { version: 2, rooms: [mkRoom()] }; }
function snapV(v: number, on: boolean) { return on ? Math.round(v / GRID) * GRID : Math.round(v); }

/* ══════════════════════ Seat Indicators ══ */
function SeatIndicators({ w, h, seats, seatedCount }: { w: number; h: number; seats: number; seatedCount: number }) {
  const mx = Math.min(seats, 20);
  const rx = w / 2 + 9, ry = h / 2 + 9;
  return (
    <>
      {Array.from({ length: mx }, (_, i) => {
        const a = (2 * Math.PI * i / mx) - Math.PI / 2;
        return (
          <div key={i} style={{
            position: "absolute",
            width: 9, height: 9, borderRadius: "50%",
            background: i < seatedCount ? "#d4a017" : "rgba(255,255,255,0.15)",
            border: `1px solid ${i < seatedCount ? "#ffd700" : "rgba(255,255,255,0.25)"}`,
            left: w / 2 + rx * Math.cos(a) - 4.5,
            top: h / 2 + ry * Math.sin(a) - 4.5,
            pointerEvents: "none",
            boxShadow: i < seatedCount ? "0 0 4px rgba(212,160,23,0.6)" : "none",
          }} />
        );
      })}
    </>
  );
}

/* ══════════════════════════ Minimap ══ */
function Minimap({ room, panX, panY, zoom, vw, vh }: {
  room: Room | undefined; panX: number; panY: number; zoom: number; vw: number; vh: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const MW = 140, MH = 86;
  const sx = MW / CANVAS_W, sy = MH / CANVAS_H;

  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !room) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, MW, MH);
    ctx.fillStyle = "#0d0404";
    ctx.fillRect(0, 0, MW, MH);
    for (const t of room.tables) {
      const cfg = STATUS_CFG[t.status];
      ctx.fillStyle = cfg.color + "80";
      ctx.strokeStyle = cfg.color;
      ctx.lineWidth = 0.5;
      const x = t.x * sx, y = t.y * sy, w = Math.max(3, t.w * sx), h = Math.max(3, t.h * sy);
      ctx.beginPath();
      if (t.shape === "round" || t.shape === "oval") {
        ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      } else {
        ctx.roundRect(x, y, w, h, 1.5);
      }
      ctx.fill();
      ctx.stroke();
    }
  });

  if (!room) return null;
  const vpX = Math.max(0, (-panX / zoom) * sx);
  const vpY = Math.max(0, (-panY / zoom) * sy);
  const vpW = Math.min(MW - vpX, (vw / zoom) * sx);
  const vpH = Math.min(MH - vpY, (vh / zoom) * sy);

  return (
    <div style={{ position: "absolute", bottom: 16, right: 16, width: MW, height: MH, background: "rgba(13,4,4,0.97)", border: "1px solid rgba(212,160,23,0.3)", borderRadius: 8, overflow: "hidden", zIndex: 100, boxShadow: "0 4px 20px rgba(0,0,0,0.5)" }}>
      <canvas ref={canvasRef} width={MW} height={MH} style={{ display: "block" }} />
      <div style={{ position: "absolute", left: vpX, top: vpY, width: Math.max(6, vpW), height: Math.max(4, vpH), border: "1.5px solid #d4a017", background: "rgba(212,160,23,0.12)", pointerEvents: "none", borderRadius: 2 }} />
      <div style={{ position: "absolute", bottom: 2, left: 4, fontSize: 9, color: "#6c757d", userSelect: "none" }}>{Math.round(zoom * 100)}%</div>
    </div>
  );
}

/* ══════════════════════════ Toast ══ */
function Toast({ msg }: { msg: string }) {
  return (
    <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "rgba(20,10,4,0.97)", border: "1px solid rgba(212,160,23,0.5)", color: "#ffd700", padding: "10px 22px", borderRadius: 24, fontSize: 13, fontWeight: 700, zIndex: 9999, boxShadow: "0 4px 20px rgba(0,0,0,0.6)", pointerEvents: "none", whiteSpace: "nowrap" }}>
      {msg}
    </div>
  );
}

/* ══════════════════════ TopBtn helper ══ */
function TopBtn({ children, onClick, title, active, danger, wide }: {
  children: React.ReactNode; onClick: () => void; title?: string; active?: boolean; danger?: boolean; wide?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{ minWidth: wide ? 40 : 28, height: 28, borderRadius: 7, padding: wide ? "0 8px" : 0, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", border: "none", background: active ? "rgba(212,160,23,0.22)" : "transparent", color: danger ? "#f44336" : active ? "#d4a017" : "#adb5bd", fontSize: 14, fontWeight: 700, outline: active ? "1px solid rgba(212,160,23,0.45)" : "none", transition: "all 0.12s" }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = danger ? "rgba(244,67,54,0.15)" : "rgba(212,160,23,0.14)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = active ? "rgba(212,160,23,0.22)" : "transparent"; }}
    >{children}</button>
  );
}

/* ══════════════════════ Table Item ══ */
function TableItem({ table, selected, onMD, onDbl, onCtx, onRotateMD, onResizeMD }: {
  table: FreeTable; selected: boolean;
  onMD: (e: React.MouseEvent) => void;
  onDbl: (e: React.MouseEvent) => void;
  onCtx: (e: React.MouseEvent) => void;
  onRotateMD: (e: React.MouseEvent) => void;
  onResizeMD: (e: React.MouseEvent) => void;
}) {
  const { w, h, shape, status, num, name, seatedCount, seats, rot, customColor } = table;
  const cfg  = STATUS_CFG[status];
  const bg   = customColor ? `radial-gradient(circle at 40% 35%,${customColor}cc,${customColor}44)` : cfg.bg;
  const brd  = customColor || cfg.border;
  const br   = SHAPE_BR[shape];
  const fSz  = Math.max(11, Math.min(w, h) * 0.22);

  return (
    <div
      onMouseDown={onMD}
      onDoubleClick={onDbl}
      onContextMenu={onCtx}
      style={{ position: "absolute", left: table.x, top: table.y, width: w, height: h, transform: `rotate(${rot}deg)`, transformOrigin: "center", cursor: "grab", userSelect: "none", zIndex: selected ? table.zIdx + 100 : table.zIdx }}
    >
      {/* ↻ Rotate handle */}
      {selected && (
        <div
          onMouseDown={e => { e.stopPropagation(); onRotateMD(e); }}
          title="גרור לסיבוב"
          style={{ position: "absolute", top: -30, left: "50%", transform: "translateX(-50%)", width: 22, height: 22, borderRadius: "50%", background: "rgba(212,160,23,0.92)", border: "2px solid #ffd700", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, cursor: "grab", zIndex: 50, boxShadow: "0 2px 8px rgba(0,0,0,0.55)" }}
        >↻</div>
      )}

      {/* Selection glow ring */}
      {selected && (
        <div style={{ position: "absolute", inset: -6, borderRadius: shape === "round" ? "50%" : shape === "oval" ? "50%/40%" : 16, border: "2px dashed #d4a017", boxShadow: "0 0 16px rgba(212,160,23,0.5)", pointerEvents: "none" }} />
      )}

      {/* Seat indicators */}
      <SeatIndicators w={w} h={h} seats={seats} seatedCount={seatedCount} />

      {/* Table body */}
      <div style={{ position: "absolute", inset: 0, borderRadius: br, background: bg, border: `2px solid ${brd}`, boxShadow: selected ? "0 0 0 2px #d4a017, 0 6px 24px rgba(0,0,0,0.5)" : "0 3px 14px rgba(0,0,0,0.4)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "45%", background: "linear-gradient(180deg,rgba(255,255,255,0.07) 0%,transparent 100%)", pointerEvents: "none" }} />

        {/* Number */}
        <div style={{ fontSize: fSz, fontWeight: 900, color: "#fff", lineHeight: 1, zIndex: 1 }}>
          {num || "?"}
        </div>

        {/* Name */}
        {name && (
          <div style={{ fontSize: Math.max(8, fSz * 0.55), color: "rgba(255,255,255,0.7)", zIndex: 1, marginTop: 1, maxWidth: w - 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {name}
          </div>
        )}

        {/* Seated count */}
        <div style={{ fontSize: Math.max(7, fSz * 0.52), color: "rgba(255,255,255,0.55)", zIndex: 1, marginTop: 2 }}>
          {seatedCount}/{seats} 🪑
        </div>
      </div>

      {/* SE Resize handle */}
      {selected && (
        <div
          onMouseDown={e => { e.stopPropagation(); onResizeMD(e); }}
          style={{ position: "absolute", right: -5, bottom: -5, width: 14, height: 14, background: "#d4a017", border: "2px solid #fff", borderRadius: 3, cursor: "se-resize", zIndex: 50 }}
        />
      )}
    </div>
  );
}

/* ══════════════════════ Edit Popup ══ */
function EditPopup({ table, pos, onClose, onUpdate, onDelete, onDup, onBringFront, onSendBack }: {
  table: FreeTable; pos: { x: number; y: number };
  onClose: () => void;
  onUpdate: (u: Partial<FreeTable>) => void;
  onDelete: () => void;
  onDup: () => void;
  onBringFront: () => void;
  onSendBack: () => void;
}) {
  const [form, setForm] = useState({
    num: String(table.num), name: table.name, group: table.group,
    seats: String(table.seats), seatedCount: String(table.seatedCount),
    w: String(Math.round(table.w)), h: String(Math.round(table.h)),
    rot: String(Math.round(table.rot)),
    status: table.status, customColor: table.customColor || "#d4a017",
  });
  const dragRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const [off, setOff] = useState({ x: 0, y: 0 });

  const px = Math.max(8, Math.min(pos.x + off.x, window.innerWidth - 316));
  const py = Math.max(8, Math.min(pos.y + off.y, window.innerHeight - 540));

  function apply() {
    onUpdate({
      num: parseInt(form.num) || table.num,
      name: form.name.trim(), group: form.group.trim(),
      seats: Math.max(1, parseInt(form.seats) || table.seats),
      seatedCount: Math.min(parseInt(form.seatedCount) || 0, parseInt(form.seats) || table.seats),
      w: Math.max(50, parseInt(form.w) || table.w),
      h: Math.max(40, parseInt(form.h) || table.h),
      rot: parseInt(form.rot) || 0,
      status: form.status,
      customColor: form.customColor !== "#d4a017" ? form.customColor : "",
    });
  }

  const inp: React.CSSProperties = { background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", borderRadius: 8, padding: "7px 10px", fontSize: 13, width: "100%", outline: "none", fontFamily: "inherit", boxSizing: "border-box" };

  return (
    <div style={{ position: "fixed", left: px, top: py, zIndex: 2000, background: "linear-gradient(145deg,#1a0a06,#2a1008)", border: "1px solid rgba(212,160,23,0.45)", borderRadius: 14, width: 306, boxShadow: "0 20px 60px rgba(0,0,0,0.75)", color: "#fff" }}>

      {/* Draggable header */}
      <div
        style={{ padding: "11px 14px 9px", cursor: "move", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "space-between", userSelect: "none", borderRadius: "14px 14px 0 0" }}
        onMouseDown={e => {
          dragRef.current = { sx: e.clientX, sy: e.clientY, ox: off.x, oy: off.y };
          const mm = (me: MouseEvent) => { if (!dragRef.current) return; setOff({ x: dragRef.current.ox + me.clientX - dragRef.current.sx, y: dragRef.current.oy + me.clientY - dragRef.current.sy }); };
          const mu = () => { dragRef.current = null; window.removeEventListener("mousemove", mm); window.removeEventListener("mouseup", mu); };
          window.addEventListener("mousemove", mm);
          window.addEventListener("mouseup", mu);
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 700, color: "#d4a017" }}>✏️ שולחן {table.num}</span>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "#666", cursor: "pointer", fontSize: 20, lineHeight: 1, padding: "0 2px" }}>×</button>
      </div>

      <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>

        {/* Status pills */}
        <div style={{ display: "flex", gap: 4 }}>
          {(Object.entries(STATUS_CFG) as [TableStatus, typeof STATUS_CFG[TableStatus]][]).map(([s, cfg]) => (
            <button key={s} onClick={() => setForm(f => ({ ...f, status: s }))} style={{ flex: 1, padding: "5px 0", borderRadius: 20, fontSize: 10, fontWeight: 700, cursor: "pointer", background: form.status === s ? cfg.color + "30" : "transparent", color: form.status === s ? cfg.color : "#555", border: `1px solid ${form.status === s ? cfg.color : "#333"}` }}>
              {cfg.label}
            </button>
          ))}
        </div>

        {/* Num + Name */}
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: "0 0 66px" }}>
            <div style={{ fontSize: 10, color: "#777", marginBottom: 4 }}>מספר</div>
            <input type="number" value={form.num} onChange={e => setForm(f => ({ ...f, num: e.target.value }))} style={{ ...inp, padding: "7px 8px" }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: "#777", marginBottom: 4 }}>שם שולחן</div>
            <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={inp} placeholder="שם אופציונלי..." />
          </div>
        </div>

        {/* Group + Color */}
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: "#777", marginBottom: 4 }}>קבוצה</div>
            <input type="text" value={form.group} onChange={e => setForm(f => ({ ...f, group: e.target.value }))} style={inp} placeholder="VIP, חיצוני..." />
          </div>
          <div style={{ flex: "0 0 66px" }}>
            <div style={{ fontSize: 10, color: "#777", marginBottom: 4 }}>צבע מותאם</div>
            <input type="color" value={form.customColor} onChange={e => setForm(f => ({ ...f, customColor: e.target.value }))} style={{ width: "100%", height: 34, borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", cursor: "pointer", background: "none", padding: 2 }} />
          </div>
        </div>

        {/* Seats + SeatedCount */}
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: "#777", marginBottom: 4 }}>מקומות</div>
            <input type="number" min={1} max={80} value={form.seats} onChange={e => setForm(f => ({ ...f, seats: e.target.value }))} style={inp} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: "#777", marginBottom: 4 }}>יושבים כרגע 🪑</div>
            <input type="number" min={0} max={form.seats} value={form.seatedCount} onChange={e => setForm(f => ({ ...f, seatedCount: e.target.value }))} style={inp} />
          </div>
        </div>

        {/* W + H + Rot */}
        <div style={{ display: "flex", gap: 8 }}>
          {[["רוחב", "w"], ["גובה", "h"], ["סיבוב°", "rot"]].map(([lbl, key]) => (
            <div key={key} style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: "#777", marginBottom: 4 }}>{lbl}</div>
              <input type="number" value={form[key as keyof typeof form] as string} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} style={{ ...inp, padding: "7px 6px" }} />
            </div>
          ))}
        </div>

        {/* Apply */}
        <button onClick={apply} style={{ width: "100%", padding: "9px 0", borderRadius: 10, background: "linear-gradient(135deg,#7a5a0e,#d4a017)", color: "#fff", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer" }}>
          ✓ עדכן שולחן
        </button>

        {/* Footer actions */}
        <div style={{ display: "flex", gap: 5 }}>
          {[
            { icon: "⎘", label: "שכפל",  action: onDup },
            { icon: "⬆", label: "קדמה",  action: onBringFront },
            { icon: "⬇", label: "אחורה", action: onSendBack },
            { icon: "🗑", label: "מחק",   action: onDelete, danger: true },
          ].map(btn => (
            <button key={btn.label} onClick={btn.action} title={btn.label} style={{ flex: 1, padding: "6px 0", borderRadius: 8, fontSize: 13, cursor: "pointer", background: btn.danger ? "rgba(244,67,54,0.13)" : "rgba(255,255,255,0.06)", color: btn.danger ? "#f44336" : "#999", border: `1px solid ${btn.danger ? "rgba(244,67,54,0.3)" : "rgba(255,255,255,0.1)"}` }}>
              {btn.icon}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════ Bg Modal ══ */
function BgModal({ room, onClose, onUpdate }: {
  room: Room; onClose: () => void; onUpdate: (u: Partial<Room>) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", backdropFilter: "blur(5px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: "linear-gradient(145deg,#1a0a06,#2a1008)", border: "1px solid rgba(212,160,23,0.45)", borderRadius: 18, width: 420, padding: 24, boxShadow: "0 24px 64px rgba(0,0,0,0.7)", color: "#fff" }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#d4a017", marginBottom: 16 }}>🖼 רקע קנבס</div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 16 }}>
          {BGS.map((bgs, i) => (
            <div key={i} onClick={() => onUpdate({ bg: i, bgImg: undefined })} style={{ borderRadius: 10, overflow: "hidden", cursor: "pointer", border: `2px solid ${room.bg === i && !room.bgImg ? "#d4a017" : "rgba(255,255,255,0.1)"}`, boxShadow: room.bg === i && !room.bgImg ? "0 0 12px rgba(212,160,23,0.4)" : "none", transition: "all 0.15s" }}>
              <div style={{ height: 46, background: bgs.cw, backgroundSize: "40px 40px" }} />
              <div style={{ padding: "5px 8px", background: bgs.body, fontSize: 11, fontWeight: 700, color: room.bg === i && !room.bgImg ? "#d4a017" : "#aaa" }}>{bgs.label}</div>
            </div>
          ))}
        </div>

        <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: "#777", marginBottom: 8 }}>תמונת רקע מותאמת</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => fileRef.current?.click()} style={{ flex: 1, padding: "9px 0", borderRadius: 10, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.14)", color: "#ccc", cursor: "pointer", fontSize: 13 }}>
              📁 העלה תמונה
            </button>
            {room.bgImg && (
              <button onClick={() => onUpdate({ bgImg: undefined })} style={{ padding: "9px 14px", borderRadius: 10, background: "rgba(244,67,54,0.1)", border: "1px solid rgba(244,67,54,0.3)", color: "#f44336", cursor: "pointer", fontSize: 13 }}>הסר</button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => {
            const f = e.target.files?.[0];
            if (!f) return;
            const reader = new FileReader();
            reader.onload = ev => onUpdate({ bgImg: ev.target?.result as string });
            reader.readAsDataURL(f);
          }} />
          {room.bgImg && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 11, color: "#777", marginBottom: 4 }}>שקיפות: {Math.round((room.bgOpacity ?? 1) * 100)}%</div>
              <input type="range" min={0.1} max={1} step={0.05} value={room.bgOpacity ?? 1}
                onChange={e => onUpdate({ bgOpacity: parseFloat(e.target.value) })}
                style={{ width: "100%", accentColor: "#d4a017" }} />
            </div>
          )}
        </div>

        <button onClick={onClose} style={{ width: "100%", padding: "10px 0", borderRadius: 10, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "#aaa", cursor: "pointer", fontSize: 14 }}>סגור</button>
      </div>
    </div>
  );
}

/* ══════════════════════ Stats Modal ══ */
function StatsModal({ room, onClose, onResetEvening }: {
  room: Room; onClose: () => void; onResetEvening: () => void;
}) {
  const tables      = room.tables;
  const totalSeats  = tables.reduce((a, t) => a + t.seats, 0);
  const seatedTotal = tables.reduce((a, t) => a + t.seatedCount, 0);
  const occPct      = totalSeats > 0 ? Math.round(seatedTotal / totalSeats * 100) : 0;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", backdropFilter: "blur(5px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: "linear-gradient(145deg,#1a0a06,#2a1008)", border: "1px solid rgba(212,160,23,0.45)", borderRadius: 18, width: 360, padding: 24, boxShadow: "0 24px 64px rgba(0,0,0,0.7)", color: "#fff" }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#d4a017", marginBottom: 16 }}>📊 סטטיסטיקות — {room.name}</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
          {(Object.entries(STATUS_CFG) as [TableStatus, typeof STATUS_CFG[TableStatus]][]).map(([s, cfg]) => {
            const cnt = tables.filter(t => t.status === s).length;
            return (
              <div key={s} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: "14px 16px", border: `1px solid ${cfg.color}30` }}>
                <div style={{ fontSize: 30, fontWeight: 900, color: cfg.color }}>{cnt}</div>
                <div style={{ fontSize: 12, color: "#999", marginTop: 2 }}>{cfg.label}</div>
              </div>
            );
          })}
        </div>

        <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: "#aaa" }}>תפוסה</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#d4a017" }}>{seatedTotal}/{totalSeats} ({occPct}%)</span>
          </div>
          <div style={{ height: 8, background: "rgba(255,255,255,0.1)", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${occPct}%`, background: "linear-gradient(90deg,#d4a017,#ffd700)", borderRadius: 4, transition: "width 0.3s" }} />
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onResetEvening} style={{ flex: 1, padding: "10px 0", borderRadius: 10, background: "rgba(244,67,54,0.12)", border: "1px solid rgba(244,67,54,0.3)", color: "#f44336", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
            🔄 אפס ערב
          </button>
          <button onClick={onClose} style={{ flex: 1, padding: "10px 0", borderRadius: 10, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "#aaa", cursor: "pointer", fontSize: 13 }}>סגור</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════ Main Component ══════════════════════════════ */
export default function LayoutClient({ restaurants }: { restaurants: Restaurant[] }) {
  const [restaurantId, setRestaurantId] = useState(restaurants[0]?.id ?? "");
  const [layout, setLayout]   = useState<LayoutV2>(emptyLayout());
  const [roomIdx, setRoomIdx] = useState(0);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [loading, setLoading] = useState(false);
  const [origin, setOrigin]   = useState("");

  /* view */
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [vSize, setVSize] = useState({ w: 900, h: 560 });
  const fitDone = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  /* refs for pan/zoom (always fresh in handlers) */
  const panXR = useRef(0); const panYR = useRef(0); const zoomR = useRef(1);
  useEffect(() => { panXR.current = panX; }, [panX]);
  useEffect(() => { panYR.current = panY; }, [panY]);
  useEffect(() => { zoomR.current = zoom; }, [zoom]);

  /* selection / edit */
  const [selId, setSelId]     = useState<string | null>(null);
  const [editId, setEditId]   = useState<string | null>(null);
  const [editPos, setEditPos] = useState({ x: 120, y: 80 });
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; id: string } | null>(null);

  /* ui toggles */
  const [snapOn, setSnapOn]       = useState(true);
  const [showBg, setShowBg]       = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showNewRoom, setShowNewRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");

  /* toast */
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* interaction refs */
  const draggingId  = useRef<string | null>(null);
  const dragStart   = useRef({ mx: 0, my: 0, tx: 0, ty: 0 });
  const didDrag     = useRef(false);

  const rotatingId  = useRef<string | null>(null);
  const rotateCtr   = useRef({ cx: 0, cy: 0 });

  const rsId        = useRef<string | null>(null);
  const rsStart     = useRef({ dw: 0, dh: 0 });

  const isPanning   = useRef(false);
  const panStart    = useRef({ mx: 0, my: 0, px: 0, py: 0 });
  const spaceDown   = useRef(false);
  const paletteDrag = useRef<PaletteItem | null>(null);

  useEffect(() => { setOrigin(window.location.origin); }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (restaurants[0]?.id) loadLayout(restaurants[0].id); }, []);

  /* ResizeObserver + fit on first measure */
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(es => {
      for (const e of es) {
        const w = e.contentRect.width, h = e.contentRect.height;
        setVSize({ w, h });
        if (!fitDone.current && w > 100 && h > 100) {
          fitDone.current = true;
          const z = Math.min(w / CANVAS_W, h / CANVAS_H) * 0.92;
          setZoom(z); setPanX((w - CANVAS_W * z) / 2); setPanY((h - CANVAS_H * z) / 2);
        }
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  function showToast(msg: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }

  /* ── Load / Save ── */
  async function loadLayout(rid: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/restaurants/${rid}/layout`);
      if (res.ok) {
        const data = await res.json();
        if (data.tableLayoutJson) {
          const p = JSON.parse(data.tableLayoutJson);
          setLayout(p.version === 2 ? p : emptyLayout());
        } else setLayout(emptyLayout());
      }
    } catch { setLayout(emptyLayout()); }
    setLoading(false);
  }

  async function saveLayout() {
    if (!restaurantId) return;
    setSaving(true);
    await fetch(`/api/admin/restaurants/${restaurantId}/layout`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tableLayoutJson: JSON.stringify(layout) }),
    });
    setSaving(false); setSaved(true);
    showToast("נשמר בהצלחה ✓");
    setTimeout(() => setSaved(false), 2600);
  }

  const activeRoom = layout.rooms[roomIdx] ?? layout.rooms[0];

  function updRoom(fn: (r: Room) => Room) {
    setLayout(prev => ({ ...prev, rooms: prev.rooms.map((r, i) => i === roomIdx ? fn(r) : r) }));
  }

  function updTable(id: string, u: Partial<FreeTable>) {
    updRoom(r => ({ ...r, tables: r.tables.map(t => t.id === id ? { ...t, ...u } : t) }));
  }

  function fitView() {
    const z = Math.min(vSize.w / CANVAS_W, vSize.h / CANVAS_H) * 0.92;
    setZoom(z); setPanX((vSize.w - CANVAS_W * z) / 2); setPanY((vSize.h - CANVAS_H * z) / 2);
  }

  function autoArrange() {
    if (!activeRoom || activeRoom.tables.length === 0) return;
    const cols = Math.ceil(Math.sqrt(activeRoom.tables.length));
    updRoom(r => ({
      ...r, tables: r.tables.map((t, i) => ({
        ...t,
        x: 80 + (i % cols) * 180,
        y: 140 + Math.floor(i / cols) * 155,
      })),
    }));
    showToast("שולחנות סודרו אוטומטית ⚡");
  }

  function clearAll() {
    if (!confirm("למחוק את כל השולחנות?")) return;
    updRoom(r => ({ ...r, tables: [] }));
    setSelId(null); setEditId(null);
    showToast("הקנבס נוקה 🗑");
  }

  function resetEvening() {
    updRoom(r => ({ ...r, tables: r.tables.map(t => ({ ...t, seatedCount: 0, status: "free" as TableStatus })) }));
    showToast("הערב אופס 🔄");
  }

  /* ── Canvas coordinate conversion ── */
  function screenToCanvas(sx: number, sy: number) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: (sx - rect.left - panXR.current) / zoomR.current, y: (sy - rect.top - panYR.current) / zoomR.current };
  }

  /* ── Spawn table ── */
  function spawnTable(cx: number, cy: number, pi: PaletteItem) {
    const num = Math.max(0, ...(activeRoom?.tables.map(t => t.num) ?? [0])) + 1;
    const t: FreeTable = {
      id: uid(), num, name: "", group: "",
      shape: pi.shape,
      x: snapV(Math.max(0, cx - pi.w / 2), snapOn),
      y: snapV(Math.max(0, cy - pi.h / 2), snapOn),
      w: pi.w, h: pi.h, seats: pi.seats, seatedCount: 0,
      status: "free", rot: 0, customColor: "", zIdx: 1,
    };
    updRoom(r => ({ ...r, tables: [...r.tables, t] }));
    setSelId(t.id);
    showToast(`שולחן ${t.num} נוסף`);
  }

  /* ── Edit popup position ── */
  function openEdit(id: string) {
    const table = activeRoom?.tables.find(t => t.id === id);
    if (!table || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const sx = (table.x + table.w / 2) * zoom + panX + rect.left;
    const sy = table.y * zoom + panY + rect.top;
    setEditPos({ x: Math.min(sx, window.innerWidth - 320), y: Math.max(10, sy - 320) });
    setEditId(id);
  }

  /* ── Table ops ── */
  function delTable(id: string) {
    updRoom(r => ({ ...r, tables: r.tables.filter(t => t.id !== id) }));
    if (selId === id) setSelId(null);
    setEditId(null); setCtxMenu(null);
    showToast("שולחן נמחק");
  }

  function dupTable(id: string) {
    const t = activeRoom?.tables.find(t => t.id === id);
    if (!t) return;
    const num = Math.max(0, ...(activeRoom?.tables.map(t => t.num) ?? [0])) + 1;
    const nt: FreeTable = { ...t, id: uid(), x: snapV(t.x + 24, snapOn), y: snapV(t.y + 24, snapOn), num };
    updRoom(r => ({ ...r, tables: [...r.tables, nt] }));
    setSelId(nt.id); setCtxMenu(null); setEditId(null);
    showToast("שולחן שוכפל ⎘");
  }

  function bringFront(id: string) {
    const maxZ = Math.max(...(activeRoom?.tables.map(t => t.zIdx) ?? [1]));
    updTable(id, { zIdx: maxZ + 1 });
  }

  function sendBack(id: string) {
    const minZ = Math.min(...(activeRoom?.tables.map(t => t.zIdx) ?? [1]));
    updTable(id, { zIdx: Math.max(1, minZ - 1) });
  }

  /* ── Mouse handlers ── */
  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const newZoom = Math.max(0.1, Math.min(4, zoom * (e.deltaY > 0 ? 0.88 : 1.12)));
    const ratio = newZoom / zoom;
    setPanX(mx - ratio * (mx - panX)); setPanY(my - ratio * (my - panY)); setZoom(newZoom);
  }

  function handleCanvasMD(e: React.MouseEvent) {
    if (e.button === 1 || (e.button === 0 && spaceDown.current)) {
      e.preventDefault(); isPanning.current = true;
      panStart.current = { mx: e.clientX, my: e.clientY, px: panX, py: panY };
      return;
    }
    if (e.button === 0 && (e.target as HTMLElement).dataset.canvas === "bg") {
      setSelId(null); setCtxMenu(null); setEditId(null);
    }
  }

  function handleCanvasMM(e: React.MouseEvent) {
    if (isPanning.current) {
      setPanX(panStart.current.px + e.clientX - panStart.current.mx);
      setPanY(panStart.current.py + e.clientY - panStart.current.my);
      return;
    }

    if (rotatingId.current) {
      const { cx, cy } = rotateCtr.current;
      const angle = Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI + 90;
      const snapped = snapOn ? Math.round(angle / 15) * 15 : Math.round(angle);
      updTable(rotatingId.current, { rot: snapped });
      return;
    }

    if (rsId.current) {
      const p = screenToCanvas(e.clientX, e.clientY);
      const table = activeRoom?.tables.find(t => t.id === rsId.current);
      if (!table) return;
      updTable(rsId.current, {
        w: snapV(Math.max(50,  p.x - table.x + rsStart.current.dw), snapOn),
        h: snapV(Math.max(40,  p.y - table.y + rsStart.current.dh), snapOn),
      });
      return;
    }

    if (draggingId.current) {
      didDrag.current = true;
      const dx = (e.clientX - dragStart.current.mx) / zoomR.current;
      const dy = (e.clientY - dragStart.current.my) / zoomR.current;
      updTable(draggingId.current, {
        x: snapV(dragStart.current.tx + dx, snapOn),
        y: snapV(dragStart.current.ty + dy, snapOn),
      });
    }
  }

  function handleCanvasMU() {
    isPanning.current = false;
    draggingId.current = null;
    rotatingId.current = null;
    rsId.current = null;
  }

  function handleTableMD(e: React.MouseEvent, table: FreeTable) {
    if (e.button !== 0 || spaceDown.current) return;
    e.stopPropagation();
    didDrag.current = false;
    draggingId.current = table.id;
    dragStart.current = { mx: e.clientX, my: e.clientY, tx: table.x, ty: table.y };
    setSelId(table.id); setCtxMenu(null);
  }

  function handleTableDbl(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (!didDrag.current) openEdit(id);
  }

  function handleTableCtx(e: React.MouseEvent, id: string) {
    e.preventDefault(); e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY, id }); setSelId(id);
  }

  function handleRotateMD(e: React.MouseEvent, table: FreeTable) {
    e.stopPropagation(); e.preventDefault();
    rotatingId.current = table.id;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    rotateCtr.current = {
      cx: (table.x + table.w / 2) * zoom + panX + rect.left,
      cy: (table.y + table.h / 2) * zoom + panY + rect.top,
    };
  }

  function handleResizeMD(e: React.MouseEvent, table: FreeTable) {
    e.stopPropagation(); e.preventDefault();
    rsId.current = table.id;
    const p = screenToCanvas(e.clientX, e.clientY);
    rsStart.current = { dw: table.w - (p.x - table.x), dh: table.h - (p.y - table.y) };
  }

  /* palette DnD */
  function handleDragOver(e: React.DragEvent) { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const pi = paletteDrag.current;
    if (!pi) return;
    paletteDrag.current = null;
    const p = screenToCanvas(e.clientX, e.clientY);
    spawnTable(p.x, p.y, pi);
  }

  /* keyboard */
  useEffect(() => {
    const dn = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat) {
        spaceDown.current = true;
        if (containerRef.current) containerRef.current.style.cursor = "grab";
      }
      if (e.key === "Escape")     { setCtxMenu(null); setSelId(null); setEditId(null); }
      if (e.key === "g" || e.key === "G") setSnapOn(s => !s);
      const tag = (document.activeElement as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (!selId) return;
      if (e.key === "Delete" || e.key === "Backspace") { delTable(selId); return; }
      if ((e.key === "d" || e.key === "D") && (e.ctrlKey || e.metaKey)) { e.preventDefault(); dupTable(selId); return; }
      const step = e.shiftKey ? 10 : GRID;
      const mv: Partial<FreeTable> = {};
      if (e.key === "ArrowLeft")  { e.preventDefault(); const t = activeRoom?.tables.find(t => t.id === selId); if (t) mv.x = Math.max(0, t.x - step); }
      if (e.key === "ArrowRight") { e.preventDefault(); const t = activeRoom?.tables.find(t => t.id === selId); if (t) mv.x = t.x + step; }
      if (e.key === "ArrowUp")    { e.preventDefault(); const t = activeRoom?.tables.find(t => t.id === selId); if (t) mv.y = Math.max(0, t.y - step); }
      if (e.key === "ArrowDown")  { e.preventDefault(); const t = activeRoom?.tables.find(t => t.id === selId); if (t) mv.y = t.y + step; }
      if (Object.keys(mv).length) updTable(selId, mv);
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") { spaceDown.current = false; if (containerRef.current) containerRef.current.style.cursor = "default"; }
    };
    window.addEventListener("keydown", dn);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", dn); window.removeEventListener("keyup", up); };
  }, [selId, activeRoom]); // eslint-disable-line

  /* rooms */
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
    setRoomIdx(p => Math.min(p, layout.rooms.length - 2));
  }

  /* background style */
  const bgCfg = BGS[activeRoom?.bg ?? 0] ?? BGS[0];
  const editTable = editId ? activeRoom?.tables.find(t => t.id === editId) : null;

  /* zoom helpers */
  function zoomBy(delta: number) {
    const nz = Math.max(0.1, Math.min(4, zoom + delta));
    const cx = vSize.w / 2, cy = vSize.h / 2;
    const r = nz / zoom;
    setPanX(cx - r * (cx - panX)); setPanY(cy - r * (cy - panY)); setZoom(nz);
  }

  const C = {
    gold: "#d4a017", text: "#e9ecef", muted: "#6c757d", sub: "#adb5bd",
    border: "rgba(212,160,23,0.22)",
  };

  /* ══════════════════════════ Render ══ */
  return (
    <div style={{ height: "calc(100vh - 64px)", display: "flex", flexDirection: "column", background: bgCfg.body, color: C.text, overflow: "hidden", fontFamily: "inherit" }}>

      {/* ── Topbar ── */}
      <div style={{ padding: "5px 10px", borderBottom: "1px solid rgba(212,160,23,0.2)", display: "flex", alignItems: "center", gap: 5, flexShrink: 0, background: "rgba(10,4,2,0.96)", backdropFilter: "blur(10px)", flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: C.gold, marginRight: 4, whiteSpace: "nowrap" }}>🗺 פריסת שולחנות</span>

        {restaurants.length > 1 && (
          <select value={restaurantId} onChange={e => { setRestaurantId(e.target.value); loadLayout(e.target.value); }}
            style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.14)", color: C.text, borderRadius: 8, padding: "4px 8px", fontSize: 12, outline: "none" }}>
            {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        )}

        <div style={{ width: 1, height: 18, background: C.border, margin: "0 2px" }} />

        {/* Snap */}
        <TopBtn active={snapOn} onClick={() => setSnapOn(s => !s)} title="Snap לגריד (G)">⊞</TopBtn>

        <div style={{ width: 1, height: 18, background: C.border, margin: "0 2px" }} />

        {/* Zoom */}
        <TopBtn onClick={() => zoomBy(-0.1)} title="הקטן (Ctrl-)">－</TopBtn>
        <span style={{ fontSize: 11, color: C.muted, minWidth: 36, textAlign: "center" }}>{Math.round(zoom * 100)}%</span>
        <TopBtn onClick={() => zoomBy(0.1)} title="הגדל (Ctrl+)">＋</TopBtn>
        <TopBtn onClick={() => { setZoom(1); setPanX((vSize.w - CANVAS_W) / 2); setPanY((vSize.h - CANVAS_H) / 2); }} title="100%">⌖</TopBtn>
        <TopBtn onClick={fitView} title="התאם למסך">⤢</TopBtn>

        <div style={{ width: 1, height: 18, background: C.border, margin: "0 2px" }} />

        {/* Actions */}
        <TopBtn onClick={autoArrange} title="סידור אוטומטי">⚡</TopBtn>
        <TopBtn active={showBg} onClick={() => setShowBg(s => !s)} title="רקע קנבס">🖼</TopBtn>
        <TopBtn active={showStats} onClick={() => setShowStats(s => !s)} title="סטטיסטיקות">📊</TopBtn>
        <TopBtn onClick={() => window.print()} title="הדפס">🖨</TopBtn>
        <TopBtn onClick={clearAll} title="נקה הכל" danger>🗑</TopBtn>

        <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
          <button onClick={saveLayout} disabled={saving} style={{ padding: "5px 14px", borderRadius: 8, background: saved ? "rgba(76,175,80,0.22)" : "linear-gradient(135deg,#7a5a0e,#d4a017)", color: saved ? "#4caf50" : "#fff", fontWeight: 700, fontSize: 12, border: "none", cursor: "pointer", opacity: saving ? 0.6 : 1, whiteSpace: "nowrap" }}>
            {saving ? "שומר..." : saved ? "✓ נשמר" : "💾 שמור"}
          </button>
          <TopBtn active={showSidebar} onClick={() => setShowSidebar(s => !s)} title="סרגל צד">◧</TopBtn>
        </div>
      </div>

      {/* ── Room tabs ── */}
      <div style={{ display: "flex", alignItems: "flex-end", padding: "0 10px", borderBottom: "1px solid rgba(212,160,23,0.15)", background: "rgba(10,4,2,0.88)", flexShrink: 0, overflowX: "auto" }}>
        {layout.rooms.map((room, idx) => (
          <div key={room.id} style={{ display: "flex", alignItems: "center" }}>
            <button onClick={() => setRoomIdx(idx)} style={{ padding: "6px 12px", fontSize: 12, fontWeight: idx === roomIdx ? 700 : 500, cursor: "pointer", background: "none", border: "none", borderBottom: idx === roomIdx ? `2px solid ${C.gold}` : "2px solid transparent", color: idx === roomIdx ? C.gold : C.muted, marginBottom: -1, whiteSpace: "nowrap" }}>
              {room.name}
            </button>
            {layout.rooms.length > 1 && (
              <button onClick={() => delRoom(idx)} style={{ fontSize: 14, color: C.muted, background: "none", border: "none", cursor: "pointer", padding: "0 3px", lineHeight: 1 }}>×</button>
            )}
          </div>
        ))}
        <button onClick={() => setShowNewRoom(true)} style={{ padding: "6px 10px", fontSize: 11, color: C.muted, background: "none", border: "none", cursor: "pointer", whiteSpace: "nowrap" }}>＋ חדר</button>
        <div style={{ marginLeft: "auto", paddingBottom: 5, display: "flex", gap: 8, fontSize: 10, color: C.muted }}>
          <span>G=סנאפ</span><span>Ctrl+D=שכפול</span><span>Del=מחיקה</span><span>⚡=סידור</span><span>↻=סיבוב</span>
        </div>
      </div>

      {/* ── Main: Sidebar + Canvas ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* Sidebar */}
        {showSidebar && (
          <div style={{ width: 126, flexShrink: 0, background: "rgba(10,4,2,0.92)", borderRight: "1px solid rgba(212,160,23,0.18)", display: "flex", flexDirection: "column", padding: "10px 6px", gap: 5, overflowY: "auto" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 2, paddingLeft: 4 }}>גרור לקנבס</div>
            {PALETTE.map(pi => (
              <div
                key={pi.label}
                draggable
                onDragStart={e => { e.dataTransfer.effectAllowed = "copy"; e.dataTransfer.setData("text/plain", pi.label); paletteDrag.current = pi; }}
                onDragEnd={() => { paletteDrag.current = null; }}
                onDoubleClick={() => {
                  const cx = (vSize.w / 2 - panX) / zoom;
                  const cy = (vSize.h / 2 - panY) / zoom;
                  spawnTable(cx, cy, pi);
                }}
                style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 8px", borderRadius: 8, cursor: "grab", userSelect: "none", border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.03)", transition: "all 0.12s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = C.gold; (e.currentTarget as HTMLElement).style.background = "rgba(212,160,23,0.1)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)"; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"; }}
              >
                <span style={{ fontSize: 15 }}>{pi.icon}</span>
                <span style={{ fontSize: 10, color: C.sub, lineHeight: 1.3 }}>{pi.label}</span>
              </div>
            ))}

            {/* Keyboard hints */}
            <div style={{ marginTop: "auto", paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.06)", fontSize: 9, color: C.muted, lineHeight: 1.8, paddingLeft: 4 }}>
              <div>↻  סובב (גרור)</div>
              <div>⌃D שכפל</div>
              <div>Del מחק</div>
              <div>G  סנאפ</div>
              <div>⚡ סידור</div>
              <div>↕  חצים</div>
            </div>
          </div>
        )}

        {/* Canvas */}
        <div
          ref={containerRef}
          style={{ flex: 1, position: "relative", overflow: "hidden" }}
          onMouseDown={handleCanvasMD}
          onMouseMove={handleCanvasMM}
          onMouseUp={handleCanvasMU}
          onMouseLeave={handleCanvasMU}
          onWheel={handleWheel}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => setCtxMenu(null)}
        >
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: C.muted, fontSize: 15 }}>טוען פריסה...</div>
          ) : (
            <>
              {/* Transform wrapper */}
              <div style={{ position: "absolute", top: 0, left: 0, transformOrigin: "0 0", transform: `translate(${panX}px,${panY}px) scale(${zoom})`, willChange: "transform" }}>
                <div style={{ width: CANVAS_W, height: CANVAS_H, position: "relative" }}>
                  {/* Background layer (separate so bgImg opacity doesn't affect tables) */}
                  <div data-canvas="bg" style={{ position: "absolute", inset: 0, zIndex: 0, ...(activeRoom?.bgImg ? { backgroundImage: `url(${activeRoom.bgImg})`, backgroundSize: "cover", backgroundPosition: "center", opacity: activeRoom.bgOpacity ?? 1 } : { background: bgCfg.cw, backgroundSize: "40px 40px" }) }} />

                  {/* Tables */}
                  {activeRoom?.tables
                    .slice()
                    .sort((a, b) => a.zIdx - b.zIdx)
                    .map(table => (
                      <TableItem
                        key={table.id}
                        table={table}
                        selected={selId === table.id}
                        onMD={e => handleTableMD(e, table)}
                        onDbl={e => handleTableDbl(e, table.id)}
                        onCtx={e => handleTableCtx(e, table.id)}
                        onRotateMD={e => handleRotateMD(e, table)}
                        onResizeMD={e => handleResizeMD(e, table)}
                      />
                    ))}
                </div>
              </div>

              {/* Minimap */}
              <Minimap room={activeRoom} panX={panX} panY={panY} zoom={zoom} vw={vSize.w} vh={vSize.h} />

              {/* Stats chip */}
              <div style={{ position: "absolute", top: 10, left: 10, fontSize: 11, color: C.muted, background: "rgba(10,4,2,0.88)", padding: "4px 10px", borderRadius: 16, border: "1px solid rgba(255,255,255,0.07)" }}>
                {activeRoom?.tables.length ?? 0} שולחנות · {activeRoom?.tables.reduce((a, t) => a + t.seats, 0) ?? 0} מקומות · {activeRoom?.tables.reduce((a, t) => a + t.seatedCount, 0) ?? 0} יושבים
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Context menu ── */}
      {ctxMenu && (
        <div style={{ position: "fixed", left: ctxMenu.x, top: ctxMenu.y, zIndex: 3000, background: "linear-gradient(145deg,#1a0a06,#2a1008)", border: "1px solid rgba(212,160,23,0.35)", borderRadius: 10, boxShadow: "0 8px 32px rgba(0,0,0,0.65)", overflow: "hidden", minWidth: 168 }}
          onMouseLeave={() => setCtxMenu(null)}>
          {([
            { icon: "✏️", label: "ערוך",   action: () => { openEdit(ctxMenu.id); setCtxMenu(null); } },
            { icon: "⎘",  label: "שכפל",   action: () => dupTable(ctxMenu.id) },
            null,
            ...Object.entries(STATUS_CFG).map(([s, cfg]) => ({ icon: "●", label: cfg.label, color: cfg.color, action: () => { updTable(ctxMenu.id, { status: s as TableStatus }); setCtxMenu(null); } })),
            null,
            { icon: "🗑", label: "מחק", color: "#f44336", action: () => delTable(ctxMenu.id) },
          ] as (null | { icon: string; label: string; color?: string; action: () => void })[]).map((item, i) => {
            if (!item) return <div key={i} style={{ height: 1, background: "rgba(255,255,255,0.07)" }} />;
            return (
              <button key={i} onClick={item.action} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "9px 14px", fontSize: 13, color: item.color ?? C.text, background: "none", border: "none", cursor: "pointer", textAlign: "right" as const }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(212,160,23,0.1)")}
                onMouseLeave={e => (e.currentTarget.style.background = "none")}>
                <span style={{ minWidth: 16 }}>{item.icon}</span>{item.label}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Edit popup ── */}
      {editTable && (
        <EditPopup
          table={editTable}
          pos={editPos}
          onClose={() => setEditId(null)}
          onUpdate={u => updTable(editTable.id, u)}
          onDelete={() => delTable(editTable.id)}
          onDup={() => dupTable(editTable.id)}
          onBringFront={() => bringFront(editTable.id)}
          onSendBack={() => sendBack(editTable.id)}
        />
      )}

      {/* QR code in edit popup when origin known */}
      {editTable && origin && editTable.num > 0 && (() => {
        const tableUrl = `${origin}/menu/${restaurantId}?table=${encodeURIComponent(String(editTable.num))}`;
        const px2 = Math.max(8, Math.min(editPos.x, window.innerWidth - 316));
        const py2 = Math.min(editPos.y + 420, window.innerHeight - 200);
        return (
          <div style={{ position: "fixed", left: px2, top: py2, zIndex: 2000, background: "linear-gradient(145deg,#1a0a06,#2a1008)", border: "1px solid rgba(212,160,23,0.3)", borderRadius: 12, padding: "12px 14px", boxShadow: "0 8px 24px rgba(0,0,0,0.6)", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, width: 306 }}>
            <div style={{ fontSize: 11, color: C.muted, fontWeight: 700 }}>QR לשולחן {editTable.num}</div>
            <div style={{ padding: 8, background: "#fff", borderRadius: 10 }}>
              <QRCodeSVG value={tableUrl} size={100} />
            </div>
            <input readOnly value={tableUrl} style={{ width: "100%", fontSize: 9, color: C.muted, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "5px 8px", outline: "none", fontFamily: "monospace" }}
              onClick={e => (e.target as HTMLInputElement).select()} />
          </div>
        );
      })()}

      {/* ── Bg modal ── */}
      {showBg && activeRoom && (
        <BgModal
          room={activeRoom}
          onClose={() => setShowBg(false)}
          onUpdate={u => updRoom(r => ({ ...r, ...u }))}
        />
      )}

      {/* ── Stats modal ── */}
      {showStats && activeRoom && (
        <StatsModal
          room={activeRoom}
          onClose={() => setShowStats(false)}
          onResetEvening={resetEvening}
        />
      )}

      {/* ── New room modal ── */}
      {showNewRoom && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", backdropFilter: "blur(5px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setShowNewRoom(false)}>
          <div style={{ background: "linear-gradient(145deg,#1a0a06,#2a1008)", border: "1px solid rgba(212,160,23,0.45)", borderRadius: 18, width: 300, padding: 24, boxShadow: "0 24px 64px rgba(0,0,0,0.7)" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.gold, marginBottom: 14 }}>＋ חדר חדש</div>
            <input type="text" value={newRoomName} autoFocus
              style={{ width: "100%", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.14)", color: "#fff", borderRadius: 10, padding: "10px 14px", fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
              placeholder="שם החדר..." onChange={e => setNewRoomName(e.target.value)} onKeyDown={e => e.key === "Enter" && addRoom()} />
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button onClick={addRoom} style={{ flex: 1, padding: "10px 0", borderRadius: 10, color: "#fff", fontWeight: 700, border: "none", cursor: "pointer", background: "linear-gradient(135deg,#7a5a0e,#d4a017)" }}>הוסף</button>
              <button onClick={() => { setShowNewRoom(false); setNewRoomName(""); }} style={{ padding: "10px 14px", borderRadius: 10, color: C.muted, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", cursor: "pointer" }}>ביטול</button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast msg={toast} />}
    </div>
  );
}
