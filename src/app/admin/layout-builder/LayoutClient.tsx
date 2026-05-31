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

type Decoration = {
  id: string; kind: "line" | "label" | "image";
  x: number; y: number; w: number; h: number;
  rot: number; text: string; color: string; zIdx: number;
  imgSrc?: string;
};

type Room = {
  id: string; name: string; tables: FreeTable[];
  bg: number; bgImg?: string; bgOpacity?: number;
  decos?: Decoration[];
};

type LayoutV2  = { version: 2; rooms: Room[] };
type Restaurant = { id: string; name: string };

/* ══════════════════════════ Constants ══ */
const GRID = 20;

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
  { icon: "●", label: "עגול 6",    shape: "round",   w: 80,  h: 80,  seats: 6  },
  { icon: "●", label: "עגול 8",    shape: "round",   w: 100, h: 100, seats: 8  },
  { icon: "▬", label: "מלבן 8",    shape: "rect",    w: 130, h: 70,  seats: 8  },
  { icon: "▬", label: "מלבן 10",   shape: "rect",    w: 155, h: 70,  seats: 10 },
  { icon: "■", label: "ריבוע 4",   shape: "square",  w: 90,  h: 90,  seats: 4  },
  { icon: "◉", label: "אובאלי 10", shape: "oval",    w: 120, h: 80,  seats: 10 },
  { icon: "▰", label: "בנקט 16",   shape: "banquet", w: 240, h: 65,  seats: 16 },
];

type DecoPaletteItem = { icon: string; label: string; kind: "line" | "label" | "image"; w: number; h: number };
const DECO_PALETTE: DecoPaletteItem[] = [
  { icon: "━", label: "קו",    kind: "line",  w: 200, h: 5   },
  { icon: "▭", label: "תווית", kind: "label", w: 160, h: 80  },
  { icon: "🖼", label: "תמונה", kind: "image", w: 160, h: 120 },
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
function Minimap({ room, panX, panY, zoom, vw, vh, cw, ch }: {
  room: Room | undefined; panX: number; panY: number; zoom: number; vw: number; vh: number; cw: number; ch: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const MW = 140, MH = 86;
  const sx = MW / cw, sy = MH / ch;

  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !room) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, MW, MH);
    ctx.fillStyle = "#0d0404";
    ctx.fillRect(0, 0, MW, MH);
    for (const t of room.tables) {
      const cfg = STATUS_CFG[t.status] ?? STATUS_CFG.free;
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
      style={{ minWidth: wide ? 40 : 28, height: 28, borderRadius: 7, padding: wide ? "0 8px" : 0, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", border: "none", background: active ? "rgba(212,160,23,0.22)" : "transparent", color: danger ? "#f44336" : active ? "#ffd700" : "#d4a017", fontSize: 14, fontWeight: 700, outline: active ? "1px solid rgba(212,160,23,0.45)" : "none", transition: "all 0.12s" }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = danger ? "rgba(244,67,54,0.15)" : "rgba(212,160,23,0.14)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = active ? "rgba(212,160,23,0.22)" : "transparent"; }}
    >{children}</button>
  );
}

/* ══════════════════════ Table Item ══ */
type InlineSeated = { val: string; onChange: (v: string) => void; onCommit: () => void };

function TableItem({ table, selected, inlineSeated, onMD, onDbl, onCtx, onRotateMD, onResizeMD, onSeatedClick, onRotateStep }: {
  table: FreeTable; selected: boolean;
  inlineSeated: InlineSeated | null;
  onMD: (e: React.MouseEvent) => void;
  onDbl: (e: React.MouseEvent) => void;
  onCtx: (e: React.MouseEvent) => void;
  onRotateMD: (e: React.MouseEvent) => void;
  onResizeMD: (e: React.MouseEvent) => void;
  onSeatedClick: (e: React.MouseEvent) => void;
  onRotateStep: (deg: number) => void;
}) {
  const { w, h, shape, status, num, name, seatedCount, seats, rot, customColor } = table;
  const cfg  = STATUS_CFG[status] ?? STATUS_CFG.free;
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
      {/* Rotation controls */}
      {selected && (
        <div style={{ position: "absolute", top: -38, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 4, zIndex: 50, alignItems: "center" }}>
          <div onClick={e => { e.stopPropagation(); onRotateStep(-15); }} onMouseDown={e => e.stopPropagation()} title="סובב שמאלה -15°"
            style={{ width: 24, height: 24, borderRadius: "50%", background: "rgba(212,160,23,0.75)", border: "1.5px solid #ffd700", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, cursor: "pointer", userSelect: "none", boxShadow: "0 2px 6px rgba(0,0,0,0.5)" }}>↺</div>
          <div onMouseDown={e => { e.stopPropagation(); onRotateMD(e); }} title="גרור לסיבוב חופשי"
            style={{ width: 24, height: 24, borderRadius: "50%", background: "rgba(212,160,23,0.92)", border: "2px solid #ffd700", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, cursor: "grab", userSelect: "none", boxShadow: "0 2px 8px rgba(0,0,0,0.55)" }}>↻</div>
          <div onClick={e => { e.stopPropagation(); onRotateStep(15); }} onMouseDown={e => e.stopPropagation()} title="סובב ימינה +15°"
            style={{ width: 24, height: 24, borderRadius: "50%", background: "rgba(212,160,23,0.75)", border: "1.5px solid #ffd700", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, cursor: "pointer", userSelect: "none", boxShadow: "0 2px 6px rgba(0,0,0,0.5)" }}>↻</div>
        </div>
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

        {/* Number + seats */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 4, zIndex: 1 }}>
          <span style={{ fontSize: fSz, fontWeight: 900, color: "#fff", lineHeight: 1 }}>{num || "?"}</span>
          <span style={{ fontSize: Math.max(9, fSz * 0.65), fontWeight: 700, color: "rgba(255,255,255,0.75)", lineHeight: 1 }}>({seats})</span>
        </div>

        {/* Name */}
        {name && (
          <div style={{ fontSize: Math.max(8, fSz * 0.55), color: "rgba(255,255,255,0.7)", zIndex: 1, marginTop: 1, maxWidth: w - 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {name}
          </div>
        )}

        {/* Seated count — click to edit inline */}
        {inlineSeated ? (
          <input
            autoFocus
            type="number"
            min={0}
            max={seats}
            value={inlineSeated.val}
            onChange={e => inlineSeated.onChange(e.target.value)}
            onBlur={inlineSeated.onCommit}
            onKeyDown={e => {
              if (e.key === "Enter") { inlineSeated.onCommit(); }
              if (e.key === "Escape") { inlineSeated.onCommit(); }
              e.stopPropagation();
            }}
            onMouseDown={e => e.stopPropagation()}
            onClick={e => e.stopPropagation()}
            style={{
              width: Math.min(w - 16, 60), fontSize: Math.max(11, fSz * 0.56),
              background: "rgba(0,0,0,0.65)", border: "1.5px solid #d4a017",
              color: "#ffd700", borderRadius: 6, textAlign: "center",
              outline: "none", fontWeight: 700, zIndex: 10,
              padding: "2px 4px", marginTop: 3, fontFamily: "inherit",
            }}
          />
        ) : (
          <div
            onClick={onSeatedClick}
            onMouseDown={e => e.stopPropagation()}
            title="לחץ לעדכון יושבים"
            style={{ fontSize: Math.max(7, fSz * 0.52), color: "rgba(255,255,255,0.55)", zIndex: 1, marginTop: 2, cursor: "pointer", padding: "1px 5px", borderRadius: 4, transition: "background 0.15s" }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(212,160,23,0.25)")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            {seatedCount}/{seats} 🪑
          </div>
        )}
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

/* ══════════════════════ Decoration Item ══ */
function DecorationItem({ deco, selected, onMD, onCtx, onResizeMD, onRotateMD, onRotateStep, onTextCommit, onPickImage }: {
  deco: Decoration; selected: boolean;
  onMD: (e: React.MouseEvent) => void;
  onCtx: (e: React.MouseEvent) => void;
  onResizeMD: (e: React.MouseEvent) => void;
  onRotateMD: (e: React.MouseEvent) => void;
  onRotateStep: (deg: number) => void;
  onTextCommit: (text: string) => void;
  onPickImage: () => void;
}) {
  const [textEditing, setTextEditing] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const isLine  = deco.kind === "line";
  const isImage = deco.kind === "image";
  const c = deco.color || "#d4a017";

  return (
    <div
      onMouseDown={onMD}
      onDoubleClick={e => { e.stopPropagation(); if (isImage) { onPickImage(); } else if (!isLine) { setTextEditing(true); } }}
      onContextMenu={onCtx}
      style={{ position: "absolute", left: deco.x, top: deco.y, width: deco.w, height: Math.max(isLine ? 4 : 40, deco.h), transform: `rotate(${deco.rot}deg)`, transformOrigin: "center", cursor: "grab", userSelect: "none", zIndex: selected ? deco.zIdx + 100 : deco.zIdx }}
    >
      {/* Rotation handles */}
      {selected && (
        <div style={{ position: "absolute", top: -38, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 4, zIndex: 50, alignItems: "center" }}>
          <div onClick={e => { e.stopPropagation(); onRotateStep(-15); }} onMouseDown={e => e.stopPropagation()} title="סובב -15°"
            style={{ width: 24, height: 24, borderRadius: "50%", background: "rgba(212,160,23,0.75)", border: "1.5px solid #ffd700", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, cursor: "pointer" }}>↺</div>
          <div onMouseDown={e => { e.stopPropagation(); onRotateMD(e); }} title="גרור לסיבוב"
            style={{ width: 24, height: 24, borderRadius: "50%", background: "rgba(212,160,23,0.92)", border: "2px solid #ffd700", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, cursor: "grab" }}>↻</div>
          <div onClick={e => { e.stopPropagation(); onRotateStep(15); }} onMouseDown={e => e.stopPropagation()} title="סובב +15°"
            style={{ width: 24, height: 24, borderRadius: "50%", background: "rgba(212,160,23,0.75)", border: "1.5px solid #ffd700", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, cursor: "pointer" }}>↻</div>
        </div>
      )}

      {/* Selection ring */}
      {selected && <div style={{ position: "absolute", inset: -5, borderRadius: isLine ? 4 : 10, border: "2px dashed #d4a017", boxShadow: "0 0 10px rgba(212,160,23,0.35)", pointerEvents: "none" }} />}

      {/* Body */}
      {isLine ? (
        <div style={{ position: "absolute", inset: 0, background: c, borderRadius: 3, boxShadow: `0 1px 6px ${c}60` }} />
      ) : isImage ? (
        <div style={{ position: "absolute", inset: 0, borderRadius: 8, overflow: "hidden", border: selected ? `1.5px solid ${c}80` : "1.5px dashed rgba(212,160,23,0.35)", background: "rgba(0,0,0,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {deco.imgSrc
            ? <img src={deco.imgSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", pointerEvents: "none" }} />
            : <span style={{ fontSize: 11, color: "rgba(212,160,23,0.5)", pointerEvents: "none" }}>לחץ פעמיים להעלאת תמונה</span>
          }
        </div>
      ) : (
        <div style={{ position: "absolute", inset: 0, background: `${c}20`, border: `1.5px solid ${c}80`, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
          {textEditing ? (
            <textarea
              ref={taRef}
              autoFocus
              defaultValue={deco.text}
              onBlur={e => { onTextCommit(e.target.value); setTextEditing(false); }}
              onKeyDown={e => { if (e.key === "Escape") { onTextCommit(taRef.current?.value ?? deco.text); setTextEditing(false); } e.stopPropagation(); }}
              onMouseDown={e => e.stopPropagation()}
              style={{ width: "100%", height: "100%", background: "transparent", border: "none", outline: "none", resize: "none", color: c, fontSize: 14, fontWeight: 600, textAlign: "center", padding: "8px", fontFamily: "inherit", cursor: "text" }}
            />
          ) : (
            <div style={{ color: c, fontSize: 14, fontWeight: 600, textAlign: "center", padding: "6px 10px", wordBreak: "break-word", pointerEvents: "none", width: "100%" }}>
              {deco.text || <span style={{ opacity: 0.35, fontSize: 11 }}>לחץ פעמיים לכתיבה</span>}
            </div>
          )}
        </div>
      )}

      {/* SE resize handle */}
      {selected && (
        <div onMouseDown={e => { e.stopPropagation(); onResizeMD(e); }}
          style={{ position: "absolute", right: -5, bottom: -5, width: 14, height: 14, background: "#d4a017", border: "2px solid #fff", borderRadius: 3, cursor: "se-resize", zIndex: 50 }} />
      )}
    </div>
  );
}

/* ══════════════════════ Edit Popup ══ */
function EditPopup({ table, pos, restaurantId, origin, onClose, onUpdate, onDelete, onDup, onBringFront, onSendBack }: {
  table: FreeTable; pos: { x: number; y: number };
  restaurantId: string; origin: string;
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
  const [copied, setCopied] = useState(false);

  const tableUrl = origin && table.num > 0 ? `${origin}/menu/${restaurantId}?table=${encodeURIComponent(String(table.num))}` : null;
  const estimatedH = tableUrl ? 650 : 470;
  const px = Math.max(8, Math.min(pos.x + off.x, window.innerWidth - 316));
  const py = Math.max(8, Math.min(pos.y + off.y, window.innerHeight - estimatedH));

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

  const inp: React.CSSProperties = { background: "rgba(255,255,255,0.07)", border: "1px solid rgba(212,160,23,0.2)", color: "#e9ecef", borderRadius: 8, padding: "7px 10px", fontSize: 13, width: "100%", outline: "none", fontFamily: "inherit", boxSizing: "border-box" };

  return (
    <div style={{ position: "fixed", left: px, top: py, zIndex: 2000, background: "linear-gradient(160deg,#180a05 0%,#251008 60%,#1a0d06 100%)", border: "1px solid rgba(212,160,23,0.5)", borderRadius: 14, width: 306, boxShadow: "0 24px 64px rgba(0,0,0,0.8), 0 0 0 1px rgba(212,160,23,0.08)", color: "#e9ecef" }}>

      {/* Draggable header */}
      <div
        style={{ padding: "11px 14px 9px", cursor: "move", borderBottom: "1px solid rgba(212,160,23,0.15)", display: "flex", alignItems: "center", justifyContent: "space-between", userSelect: "none", borderRadius: "14px 14px 0 0", background: "rgba(0,0,0,0.2)" }}
        onMouseDown={e => {
          dragRef.current = { sx: e.clientX, sy: e.clientY, ox: off.x, oy: off.y };
          const mm = (me: MouseEvent) => { if (!dragRef.current) return; setOff({ x: dragRef.current.ox + me.clientX - dragRef.current.sx, y: dragRef.current.oy + me.clientY - dragRef.current.sy }); };
          const mu = () => { dragRef.current = null; window.removeEventListener("mousemove", mm); window.removeEventListener("mouseup", mu); };
          window.addEventListener("mousemove", mm);
          window.addEventListener("mouseup", mu);
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 700, color: "#d4a017" }}>✏️ שולחן {table.num}</span>
        <button onClick={onClose} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#888", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: "2px 7px", borderRadius: 6 }}>×</button>
      </div>

      <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>

        {/* Status pills */}
        <div style={{ display: "flex", gap: 4 }}>
          {(Object.entries(STATUS_CFG) as [TableStatus, typeof STATUS_CFG[TableStatus]][]).map(([s, cfg]) => (
            <button key={s} onClick={() => setForm(f => ({ ...f, status: s }))} style={{ flex: 1, padding: "5px 0", borderRadius: 20, fontSize: 10, fontWeight: 700, cursor: "pointer", background: form.status === s ? cfg.color + "30" : "rgba(255,255,255,0.04)", color: form.status === s ? cfg.color : "rgba(212,160,23,0.45)", border: `1px solid ${form.status === s ? cfg.color : "rgba(212,160,23,0.18)"}` }}>
              {cfg.label}
            </button>
          ))}
        </div>

        {/* Num + Name */}
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: "0 0 66px" }}>
            <div style={{ fontSize: 10, color: "rgba(212,160,23,0.6)", marginBottom: 4 }}>מספר</div>
            <input type="number" value={form.num} onChange={e => setForm(f => ({ ...f, num: e.target.value }))} style={{ ...inp, padding: "7px 8px" }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: "rgba(212,160,23,0.6)", marginBottom: 4 }}>שם שולחן</div>
            <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={inp} placeholder="שם אופציונלי..." />
          </div>
        </div>

        {/* Group + Color */}
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: "rgba(212,160,23,0.6)", marginBottom: 4 }}>קבוצה</div>
            <input type="text" value={form.group} onChange={e => setForm(f => ({ ...f, group: e.target.value }))} style={inp} placeholder="VIP, חיצוני..." />
          </div>
          <div style={{ flex: "0 0 66px" }}>
            <div style={{ fontSize: 10, color: "rgba(212,160,23,0.6)", marginBottom: 4 }}>צבע מותאם</div>
            <input type="color" value={form.customColor} onChange={e => setForm(f => ({ ...f, customColor: e.target.value }))} style={{ width: "100%", height: 34, borderRadius: 8, border: "1px solid rgba(212,160,23,0.25)", cursor: "pointer", background: "none", padding: 2 }} />
          </div>
        </div>

        {/* Seats + SeatedCount */}
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: "rgba(212,160,23,0.6)", marginBottom: 4 }}>מקומות</div>
            <input type="number" min={1} max={80} value={form.seats} onChange={e => setForm(f => ({ ...f, seats: e.target.value }))} style={inp} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: "rgba(212,160,23,0.6)", marginBottom: 4 }}>יושבים כרגע 🪑</div>
            <input type="number" min={0} max={form.seats} value={form.seatedCount} onChange={e => setForm(f => ({ ...f, seatedCount: e.target.value }))} style={inp} />
          </div>
        </div>

        {/* W + H + Rot */}
        <div style={{ display: "flex", gap: 8 }}>
          {[["רוחב", "w"], ["גובה", "h"], ["סיבוב°", "rot"]].map(([lbl, key]) => (
            <div key={key} style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: "rgba(212,160,23,0.6)", marginBottom: 4 }}>{lbl}</div>
              <input type="number" value={form[key as keyof typeof form] as string} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} style={{ ...inp, padding: "7px 6px" }} />
            </div>
          ))}
        </div>

        {/* Apply */}
        <button onClick={apply} style={{ width: "100%", padding: "10px 0", borderRadius: 10, background: "linear-gradient(135deg,#7a5a0e,#d4a017)", color: "#fff", fontWeight: 800, fontSize: 14, border: "none", cursor: "pointer", letterSpacing: ".02em", boxShadow: "0 2px 12px rgba(212,160,23,0.3)" }}>
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
            <button key={btn.label} onClick={btn.action} title={btn.label} style={{ flex: 1, padding: "7px 0", borderRadius: 8, fontSize: 13, cursor: "pointer", background: btn.danger ? "rgba(244,67,54,0.13)" : "rgba(255,255,255,0.06)", color: btn.danger ? "#f44336" : "#adb5bd", border: `1px solid ${btn.danger ? "rgba(244,67,54,0.3)" : "rgba(255,255,255,0.1)"}`, display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 2 }}>
              <span style={{ fontSize: 14 }}>{btn.icon}</span>
              <span style={{ fontSize: 9 }}>{btn.label}</span>
            </button>
          ))}
        </div>

        {/* QR section */}
        {tableUrl && (
          <>
            <div style={{ height: 1, background: "rgba(212,160,23,0.15)", margin: "2px 0" }} />
            <div style={{ fontSize: 11, color: "rgba(212,160,23,0.6)", fontWeight: 700, textAlign: "center" }}>QR לשולחן {table.num}</div>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <div style={{ padding: 8, background: "#fff", borderRadius: 10, boxShadow: "0 4px 16px rgba(0,0,0,0.4)" }}>
                <QRCodeSVG value={tableUrl} size={92} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input readOnly value={tableUrl}
                style={{ flex: 1, fontSize: 9, color: "rgba(212,160,23,0.55)", background: "rgba(212,160,23,0.05)", border: "1px solid rgba(212,160,23,0.2)", borderRadius: 6, padding: "6px 8px", outline: "none", fontFamily: "monospace", minWidth: 0 }}
                onClick={e => (e.target as HTMLInputElement).select()} />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(tableUrl).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }).catch(() => {});
                }}
                style={{ padding: "6px 10px", borderRadius: 7, background: copied ? "rgba(76,175,80,0.2)" : "rgba(212,160,23,0.15)", color: copied ? "#4caf50" : "#d4a017", border: `1px solid ${copied ? "rgba(76,175,80,0.4)" : "rgba(212,160,23,0.35)"}`, cursor: "pointer", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0, transition: "all 0.2s" }}>
                {copied ? "✓ הועתק" : "העתק"}
              </button>
            </div>
          </>
        )}
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
  useEffect(() => { vSizeRef.current = vSize; }, [vSize]);

  /* auto-save */
  const [autoSave, setAutoSave] = useState(true);
  const layoutRef        = useRef<LayoutV2>(emptyLayout());
  const restaurantIdRef  = useRef("");
  useEffect(() => { layoutRef.current = layout; }, [layout]);
  useEffect(() => { restaurantIdRef.current = restaurantId; }, [restaurantId]);
  useEffect(() => {
    if (!autoSave) return;
    const id = setInterval(async () => {
      const rid = restaurantIdRef.current;
      if (!rid) return;
      try {
        await fetch(`/api/admin/restaurants/${rid}/layout`, {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tableLayoutJson: JSON.stringify(layoutRef.current) }),
        });
        showToast("שמירה אוטו ✓");
      } catch {}
    }, 30000);
    return () => clearInterval(id);
  }, [autoSave]); // eslint-disable-line

  /* selection / edit */
  const [selId, setSelId]               = useState<string | null>(null);
  const [editId, setEditId]             = useState<string | null>(null);
  const [editPos, setEditPos]           = useState({ x: 120, y: 80 });
  const [selDecoId, setSelDecoId]       = useState<string | null>(null);
  const [multiSelIds, setMultiSelIds]   = useState<Set<string>>(new Set());
  const [multiSelDecoIds, setMultiSelDecoIds] = useState<Set<string>>(new Set());
  const [canUndo, setCanUndo]           = useState(false);
  const [canRedo, setCanRedo]           = useState(false);
  const [ctxMenu, setCtxMenu]     = useState<{ x: number; y: number; id: string; kind: "table" | "deco" } | null>(null);
  const [toolsMenu, setToolsMenu] = useState<{ x: number; y: number } | null>(null);

  /* ui toggles */
  const [snapOn, setSnapOn]       = useState(false);
  const [showBg, setShowBg]       = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(210);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const sidebarResizing = useRef(false);
  const sidebarResizeStartX = useRef(0);
  const sidebarResizeStartW = useRef(0);
  const [showNewRoom, setShowNewRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");

  /* inline seated-count edit */
  const [inlineSeated, setInlineSeated] = useState<{ id: string; val: string } | null>(null);

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
  const panIsOnBg   = useRef(false);
  const panStart    = useRef({ mx: 0, my: 0, px: 0, py: 0 });
  const spaceDown   = useRef(false);
  const paletteDrag    = useRef<PaletteItem | null>(null);
  const paletteDragDeco = useRef<DecoPaletteItem | null>(null);
  const imgFileRef      = useRef<HTMLInputElement>(null);
  const imgTargetDecoId = useRef<string | null>(null);
  const importFileRef   = useRef<HTMLInputElement>(null);
  const toolsBtnRef     = useRef<HTMLButtonElement>(null);
  const vSizeRef       = useRef({ w: 900, h: 560 });

  /* deco interaction refs */
  const draggingDecoId  = useRef<string | null>(null);
  const dragDecoStart   = useRef({ mx: 0, my: 0, dx: 0, dy: 0 });
  const rotatingDecoId  = useRef<string | null>(null);
  const rotateCtrDeco   = useRef({ cx: 0, cy: 0 });
  const rsDecoId        = useRef<string | null>(null);
  const rsDecoStart     = useRef({ dw: 0, dh: 0 });

  /* undo / redo */
  const undoStack = useRef<LayoutV2[]>([]);
  const redoStack = useRef<LayoutV2[]>([]);

  /* multi-drag */
  const isMultiDrag          = useRef(false);
  const dragOriginMx         = useRef(0);
  const dragOriginMy         = useRef(0);
  const multiDragTableOrigs  = useRef<Array<{ id: string; x: number; y: number }>>([]);
  const multiDragDecoOrigs   = useRef<Array<{ id: string; x: number; y: number }>>([]);

  useEffect(() => { setOrigin(window.location.origin); }, []);
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
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
          setZoom(1); setPanX(0); setPanY(0);
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

  /* ── Undo / Redo ── */
  function pushHistory() {
    const snap = JSON.parse(JSON.stringify(layoutRef.current)) as LayoutV2;
    undoStack.current = [...undoStack.current, snap].slice(-60);
    redoStack.current = [];
    setCanUndo(true); setCanRedo(false);
  }
  function undo() {
    if (!undoStack.current.length) return;
    redoStack.current = [...redoStack.current, JSON.parse(JSON.stringify(layoutRef.current))];
    const prev = undoStack.current.pop()!;
    undoStack.current = [...undoStack.current];
    setLayout(prev);
    setCanUndo(undoStack.current.length > 0); setCanRedo(true);
    setSelId(null); setMultiSelIds(new Set()); setSelDecoId(null); setMultiSelDecoIds(new Set());
  }
  function redo() {
    if (!redoStack.current.length) return;
    undoStack.current = [...undoStack.current, JSON.parse(JSON.stringify(layoutRef.current))];
    const next = redoStack.current.pop()!;
    redoStack.current = [...redoStack.current];
    setLayout(next);
    setCanUndo(true); setCanRedo(redoStack.current.length > 0);
    setSelId(null); setMultiSelIds(new Set()); setSelDecoId(null); setMultiSelDecoIds(new Set());
  }

  /* ── Multi-select helpers ── */
  function allSelTableIds(): Set<string> {
    const s = new Set(multiSelIds);
    if (selId) s.add(selId);
    return s;
  }
  function allSelDecoIds(): Set<string> {
    const s = new Set(multiSelDecoIds);
    if (selDecoId) s.add(selDecoId);
    return s;
  }
  function clearMultiSel() {
    setMultiSelIds(new Set()); setMultiSelDecoIds(new Set());
  }
  function selectAll() {
    const tIds = new Set(activeRoom?.tables.map(t => t.id) ?? []);
    const dIds = new Set(activeRoom?.decos?.map(d => d.id) ?? []);
    setMultiSelIds(tIds);
    setMultiSelDecoIds(dIds);
    const firstT = activeRoom?.tables[0];
    const firstD = activeRoom?.decos?.[0];
    if (firstT) setSelId(firstT.id); else if (firstD) { setSelId(null); setSelDecoId(firstD.id); }
    showToast(`${tIds.size + dIds.size} אובייקטים נבחרו`);
  }

  /* ── Load / Save ── */
  function zoomToContent(targetLayout: LayoutV2, vw?: number, vh?: number) {
    const w = vw ?? vSizeRef.current.w;
    const h = vh ?? vSizeRef.current.h;
    const tables = targetLayout.rooms.flatMap(r => r.tables);
    if (tables.length === 0 || w < 100 || h < 100) return;
    const minX = Math.min(...tables.map(t => t.x));
    const minY = Math.min(...tables.map(t => t.y));
    const maxX = Math.max(...tables.map(t => t.x + t.w));
    const maxY = Math.max(...tables.map(t => t.y + t.h));
    const pad = 100;
    const z = Math.min(w / (maxX - minX + pad * 2), h / (maxY - minY + pad * 2));
    const cz = Math.max(0.25, Math.min(3, z));
    setZoom(cz);
    setPanX(w / 2 - ((minX + maxX) / 2) * cz);
    setPanY(h / 2 - ((minY + maxY) / 2) * cz);
  }

  async function loadLayout(rid: string) {
    setLoading(true);
    undoStack.current = []; redoStack.current = [];
    setCanUndo(false); setCanRedo(false);
    try {
      const res = await fetch(`/api/admin/restaurants/${rid}/layout`);
      if (res.ok) {
        const data = await res.json();
        if (data.tableLayoutJson) {
          const p = JSON.parse(data.tableLayoutJson);
          const newLayout = p.version === 2 ? p : emptyLayout();
          setLayout(newLayout);
          requestAnimationFrame(() => { setZoom(1); setPanX(0); setPanY(0); });
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

  function updDeco(id: string, u: Partial<Decoration>) {
    updRoom(r => ({ ...r, decos: (r.decos ?? []).map(d => d.id === id ? { ...d, ...u } : d) }));
  }

  function delDeco(id: string) {
    pushHistory();
    updRoom(r => ({ ...r, decos: (r.decos ?? []).filter(d => d.id !== id) }));
    if (selDecoId === id) setSelDecoId(null);
    setMultiSelDecoIds(s => { const n = new Set(s); n.delete(id); return n; });
    setCtxMenu(null);
  }

  function dupDeco(id: string) {
    pushHistory();
    const d = activeRoom?.decos?.find(d => d.id === id);
    if (!d) return;
    const nd: Decoration = { ...d, id: uid(), x: snapV(d.x + 24, snapOn), y: snapV(d.y + 24, snapOn) };
    updRoom(r => ({ ...r, decos: [...(r.decos ?? []), nd] }));
    setSelDecoId(nd.id); clearMultiSel(); setCtxMenu(null);
    showToast("אלמנט שוכפל ⎘");
  }

  function spawnDeco(cx: number, cy: number, item: DecoPaletteItem) {
    pushHistory();
    const d: Decoration = {
      id: uid(), kind: item.kind,
      x: snapV(Math.max(0, cx - item.w / 2), snapOn),
      y: snapV(Math.max(0, cy - item.h / 2), snapOn),
      w: item.w, h: item.h,
      rot: 0, text: "", color: "#d4a017", zIdx: 1,
    };
    updRoom(r => ({ ...r, decos: [...(r.decos ?? []), d] }));
    setSelDecoId(d.id); setSelId(null); clearMultiSel();
    showToast("אלמנט נוסף");
  }

  function pickImageForDeco(id: string) {
    imgTargetDecoId.current = id;
    imgFileRef.current?.click();
  }

  function onImgFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const id = imgTargetDecoId.current;
    if (!file || !id) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const src = ev.target?.result as string;
      pushHistory();
      updDeco(id, { imgSrc: src });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  async function exportTablesToExcel() {
    if (!restaurantId) { showToast("בחר מסעדה תחילה"); return; }
    showToast("מייצר קובץ Excel…");
    try {
      const res = await fetch("/api/admin/export/tables-excel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, layout: layoutRef.current, origin }),
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url; a.download = `tables-${restaurantId}.xlsx`;
      a.click(); URL.revokeObjectURL(url);
      showToast("Excel יוצא ✓");
    } catch (err) {
      console.error(err);
      showToast("שגיאה בייצוא Excel");
    }
  }

  function exportLayout() {
    const json = JSON.stringify(layoutRef.current, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `layout-${restaurantId || "export"}.json`;
    a.click(); URL.revokeObjectURL(url);
    showToast("Layout יוצא ✓");
  }

  function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const parsed = JSON.parse(ev.target?.result as string) as LayoutV2;
        if (parsed.version !== 2 || !Array.isArray(parsed.rooms)) throw new Error();
        pushHistory();
        setLayout(parsed);
        showToast("Layout יובא ✓");
      } catch {
        showToast("קובץ לא תקין ✗");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  function rotateDecoStep(id: string, deg: number) {
    const d = activeRoom?.decos?.find(d => d.id === id);
    if (d) updDeco(id, { rot: ((d.rot || 0) + deg + 360) % 360 });
  }

  function fitView() {
    const tables = layout.rooms.flatMap(r => r.tables);
    if (tables.length > 0) {
      zoomToContent(layout, vSize.w, vSize.h);
    } else {
      setZoom(1); setPanX(0); setPanY(0);
    }
  }

  function autoArrange() {
    if (!activeRoom || activeRoom.tables.length === 0) return;
    pushHistory();
    const cols = Math.ceil(Math.sqrt(activeRoom.tables.length));
    updRoom(r => ({
      ...r, tables: r.tables.map((t, i) => ({
        ...t,
        x: 100 + (i % cols) * (t.w + 60),
        y: 120 + Math.floor(i / cols) * (t.h + 60),
      })),
    }));
    showToast("שולחנות סודרו אוטומטית ⚡");
  }

  function clearAll() {
    if (!confirm("למחוק את כל השולחנות?")) return;
    pushHistory();
    updRoom(r => ({ ...r, tables: [], decos: [] }));
    setSelId(null); setEditId(null); clearMultiSel();
    showToast("הקנבס נוקה 🗑");
  }

  function resetEvening() {
    pushHistory();
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
    pushHistory();
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
    setSelId(t.id); clearMultiSel();
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
    pushHistory();
    updRoom(r => ({ ...r, tables: r.tables.filter(t => t.id !== id) }));
    if (selId === id) setSelId(null);
    setMultiSelIds(s => { const n = new Set(s); n.delete(id); return n; });
    setEditId(null); setCtxMenu(null);
    showToast("שולחן נמחק");
  }

  function delSelected() {
    const tIds = allSelTableIds();
    const dIds = allSelDecoIds();
    if (tIds.size + dIds.size === 0) return;
    pushHistory();
    updRoom(r => ({
      ...r,
      tables: r.tables.filter(t => !tIds.has(t.id)),
      decos: (r.decos ?? []).filter(d => !dIds.has(d.id)),
    }));
    setSelId(null); setSelDecoId(null); clearMultiSel(); setEditId(null); setCtxMenu(null);
    showToast(`${tIds.size + dIds.size} אובייקטים נמחקו`);
  }

  function dupTable(id: string) {
    pushHistory();
    const t = activeRoom?.tables.find(t => t.id === id);
    if (!t) return;
    const num = Math.max(0, ...(activeRoom?.tables.map(t => t.num) ?? [0])) + 1;
    const nt: FreeTable = { ...t, id: uid(), x: snapV(t.x + 24, snapOn), y: snapV(t.y + 24, snapOn), num };
    updRoom(r => ({ ...r, tables: [...r.tables, nt] }));
    setSelId(nt.id); clearMultiSel(); setCtxMenu(null); setEditId(null);
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

  function rotateTableStep(id: string, deg: number) {
    const t = activeRoom?.tables.find(t => t.id === id);
    if (t) updTable(id, { rot: ((t.rot || 0) + deg + 360) % 360 });
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
      e.preventDefault(); isPanning.current = true; panIsOnBg.current = false;
      panStart.current = { mx: e.clientX, my: e.clientY, px: panX, py: panY };
      return;
    }
    if (e.button === 0 && (e.target as HTMLElement).dataset.canvas === "bg") {
      isPanning.current = true; panIsOnBg.current = true;
      panStart.current = { mx: e.clientX, my: e.clientY, px: panX, py: panY };
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

    if (draggingId.current || draggingDecoId.current) {
      if (!didDrag.current && !isMultiDrag.current) pushHistory();
      didDrag.current = true;
      if (isMultiDrag.current) {
        const dx = (e.clientX - dragOriginMx.current) / zoomR.current;
        const dy = (e.clientY - dragOriginMy.current) / zoomR.current;
        for (const o of multiDragTableOrigs.current)
          updTable(o.id, { x: snapV(o.x + dx, snapOn), y: snapV(o.y + dy, snapOn) });
        for (const o of multiDragDecoOrigs.current)
          updDeco(o.id,  { x: snapV(o.x + dx, snapOn), y: snapV(o.y + dy, snapOn) });
        return;
      }
      if (draggingId.current) {
        const dx = (e.clientX - dragStart.current.mx) / zoomR.current;
        const dy = (e.clientY - dragStart.current.my) / zoomR.current;
        updTable(draggingId.current, {
          x: snapV(dragStart.current.tx + dx, snapOn),
          y: snapV(dragStart.current.ty + dy, snapOn),
        });
        return;
      }
    }

    if (rotatingDecoId.current) {
      const { cx, cy } = rotateCtrDeco.current;
      const angle = Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI + 90;
      updDeco(rotatingDecoId.current, { rot: snapOn ? Math.round(angle / 15) * 15 : Math.round(angle) });
      return;
    }

    if (rsDecoId.current) {
      const p = screenToCanvas(e.clientX, e.clientY);
      const d = activeRoom?.decos?.find(d => d.id === rsDecoId.current);
      if (!d) return;
      updDeco(rsDecoId.current, {
        w: snapV(Math.max(20, p.x - d.x + rsDecoStart.current.dw), snapOn),
        h: snapV(Math.max(4,  p.y - d.y + rsDecoStart.current.dh), snapOn),
      });
      return;
    }

    if (!isMultiDrag.current && draggingDecoId.current) {
      if (!didDrag.current) pushHistory();
      didDrag.current = true;
      const dx = (e.clientX - dragDecoStart.current.mx) / zoomR.current;
      const dy = (e.clientY - dragDecoStart.current.my) / zoomR.current;
      updDeco(draggingDecoId.current, {
        x: snapV(dragDecoStart.current.dx + dx, snapOn),
        y: snapV(dragDecoStart.current.dy + dy, snapOn),
      });
    }
  }

  function handleCanvasMU(e: React.MouseEvent) {
    if (isPanning.current && panIsOnBg.current) {
      const dist = Math.hypot(e.clientX - panStart.current.mx, e.clientY - panStart.current.my);
      if (dist < 5) { setSelId(null); setSelDecoId(null); setCtxMenu(null); setEditId(null); clearMultiSel(); }
    }
    isMultiDrag.current = false;
    isPanning.current = false; panIsOnBg.current = false;
    draggingId.current = null;
    rotatingId.current = null;
    rsId.current = null;
    draggingDecoId.current = null;
    rotatingDecoId.current = null;
    rsDecoId.current = null;
  }

  function handleTableMD(e: React.MouseEvent, table: FreeTable) {
    if (e.button !== 0 || spaceDown.current) return;
    e.stopPropagation();
    didDrag.current = false;

    if (e.shiftKey) {
      const inSel = selId === table.id || multiSelIds.has(table.id);
      if (inSel) {
        if (selId === table.id) setSelId(null);
        setMultiSelIds(s => { const n = new Set(s); n.delete(table.id); return n; });
      } else {
        setMultiSelIds(s => new Set([...s, table.id]));
        if (!selId) setSelId(table.id);
      }
      return;
    }

    const allT = allSelTableIds();
    const allD = allSelDecoIds();
    if (allT.size + allD.size > 1 && (allT.has(table.id) || allD.size > 0)) {
      // multi-drag: record origins for all selected
      pushHistory();
      isMultiDrag.current = true;
      dragOriginMx.current = e.clientX;
      dragOriginMy.current = e.clientY;
      multiDragTableOrigs.current = (activeRoom?.tables ?? []).filter(t => allT.has(t.id)).map(t => ({ id: t.id, x: t.x, y: t.y }));
      multiDragDecoOrigs.current  = (activeRoom?.decos ?? []).filter(d => allD.has(d.id)).map(d => ({ id: d.id, x: d.x, y: d.y }));
      draggingId.current = table.id;
    } else {
      isMultiDrag.current = false;
      draggingId.current = table.id;
      dragStart.current = { mx: e.clientX, my: e.clientY, tx: table.x, ty: table.y };
      dragOriginMx.current = e.clientX;
      dragOriginMy.current = e.clientY;
      setMultiSelIds(new Set()); setMultiSelDecoIds(new Set());
    }
    setSelId(table.id); setCtxMenu(null);
  }

  function handleTableDbl(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (!didDrag.current) openEdit(id);
  }

  function handleTableCtx(e: React.MouseEvent, id: string) {
    e.preventDefault(); e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY, id, kind: "table" }); setSelId(id);
  }

  function handleDecoMD(e: React.MouseEvent, deco: Decoration) {
    if (e.button !== 0 || spaceDown.current) return;
    e.stopPropagation();
    didDrag.current = false;

    if (e.shiftKey) {
      const inSel = selDecoId === deco.id || multiSelDecoIds.has(deco.id);
      if (inSel) {
        if (selDecoId === deco.id) setSelDecoId(null);
        setMultiSelDecoIds(s => { const n = new Set(s); n.delete(deco.id); return n; });
      } else {
        setMultiSelDecoIds(s => new Set([...s, deco.id]));
        if (!selDecoId) setSelDecoId(deco.id);
      }
      return;
    }

    const allT = allSelTableIds();
    const allD = allSelDecoIds();
    if (allT.size + allD.size > 1 && (allD.has(deco.id) || allT.size > 0)) {
      pushHistory();
      isMultiDrag.current = true;
      dragOriginMx.current = e.clientX;
      dragOriginMy.current = e.clientY;
      multiDragTableOrigs.current = (activeRoom?.tables ?? []).filter(t => allT.has(t.id)).map(t => ({ id: t.id, x: t.x, y: t.y }));
      multiDragDecoOrigs.current  = (activeRoom?.decos ?? []).filter(d => allD.has(d.id)).map(d => ({ id: d.id, x: d.x, y: d.y }));
      draggingDecoId.current = deco.id;
    } else {
      isMultiDrag.current = false;
      draggingDecoId.current = deco.id;
      dragDecoStart.current = { mx: e.clientX, my: e.clientY, dx: deco.x, dy: deco.y };
      dragOriginMx.current = e.clientX;
      dragOriginMy.current = e.clientY;
      setMultiSelIds(new Set()); setMultiSelDecoIds(new Set());
    }
    setSelDecoId(deco.id); setSelId(null); setCtxMenu(null);
  }

  function handleDecoCtx(e: React.MouseEvent, id: string) {
    e.preventDefault(); e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY, id, kind: "deco" }); setSelDecoId(id);
  }

  function handleDecoResizeMD(e: React.MouseEvent, deco: Decoration) {
    e.stopPropagation(); e.preventDefault();
    rsDecoId.current = deco.id;
    const p = screenToCanvas(e.clientX, e.clientY);
    rsDecoStart.current = { dw: deco.w - (p.x - deco.x), dh: deco.h - (p.y - deco.y) };
  }

  function handleDecoRotateMD(e: React.MouseEvent, deco: Decoration) {
    e.stopPropagation(); e.preventDefault();
    rotatingDecoId.current = deco.id;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    rotateCtrDeco.current = {
      cx: (deco.x + deco.w / 2) * zoom + panX + rect.left,
      cy: (deco.y + deco.h / 2) * zoom + panY + rect.top,
    };
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
    const p = screenToCanvas(e.clientX, e.clientY);
    if (paletteDrag.current) {
      const pi = paletteDrag.current; paletteDrag.current = null;
      spawnTable(p.x, p.y, pi);
    } else if (paletteDragDeco.current) {
      const pi = paletteDragDeco.current; paletteDragDeco.current = null;
      spawnDeco(p.x, p.y, pi);
    }
  }

  /* keyboard */
  useEffect(() => {
    const dn = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat) {
        spaceDown.current = true;
        if (containerRef.current) containerRef.current.style.cursor = "grab";
      }
      if (e.key === "Escape")     { setCtxMenu(null); setSelId(null); setEditId(null); setSelDecoId(null); clearMultiSel(); }
      if (e.key === "g" || e.key === "G") setSnapOn(s => !s);
      const tag = (document.activeElement as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if ((e.key === "z" || e.key === "Z") && (e.ctrlKey || e.metaKey) && !e.shiftKey) { e.preventDefault(); undo(); return; }
      if (((e.key === "y" || e.key === "Y") && (e.ctrlKey || e.metaKey)) || ((e.key === "z" || e.key === "Z") && (e.ctrlKey || e.metaKey) && e.shiftKey)) { e.preventDefault(); redo(); return; }
      if ((e.key === "a" || e.key === "A") && (e.ctrlKey || e.metaKey)) { e.preventDefault(); selectAll(); return; }
      const allT = allSelTableIds(), allD = allSelDecoIds();
      if (e.key === "Delete" || e.key === "Backspace") {
        if (allT.size + allD.size > 1) { delSelected(); return; }
        if (selDecoId) { delDeco(selDecoId); return; }
        if (selId) { delTable(selId); return; }
      }
      if ((e.key === "d" || e.key === "D") && (e.ctrlKey || e.metaKey)) {
        if (selDecoId && !selId) { e.preventDefault(); dupDeco(selDecoId); return; }
        if (selId) { e.preventDefault(); dupTable(selId); return; }
      }
      const step = e.shiftKey ? 10 : GRID;
      const mv: Partial<FreeTable> = {};
      if (e.key === "ArrowLeft")  { e.preventDefault(); const t = activeRoom?.tables.find(t => t.id === selId); if (t) mv.x = Math.max(0, t.x - step); }
      if (e.key === "ArrowRight") { e.preventDefault(); const t = activeRoom?.tables.find(t => t.id === selId); if (t) mv.x = t.x + step; }
      if (e.key === "ArrowUp")    { e.preventDefault(); const t = activeRoom?.tables.find(t => t.id === selId); if (t) mv.y = Math.max(0, t.y - step); }
      if (e.key === "ArrowDown")  { e.preventDefault(); const t = activeRoom?.tables.find(t => t.id === selId); if (t) mv.y = t.y + step; }
      if (Object.keys(mv).length && selId) updTable(selId, mv);
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") { spaceDown.current = false; if (containerRef.current) containerRef.current.style.cursor = "default"; }
    };
    window.addEventListener("keydown", dn);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", dn); window.removeEventListener("keyup", up); };
  }, [selId, selDecoId, activeRoom]); // eslint-disable-line

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
      <input ref={imgFileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onImgFileChange} />
      <input ref={importFileRef} type="file" accept=".json,application/json" style={{ display: "none" }} onChange={onImportFile} />

      {/* ── Topbar ── RTL flow */}
      <div style={{ padding: "5px 16px", borderBottom: "1px solid rgba(212,160,23,0.2)", display: "flex", alignItems: "center", flexShrink: 0, background: "rgba(10,4,2,0.97)", backdropFilter: "blur(10px)", direction: "rtl", gap: 6 }}>

        {/* Title (RTL start = rightmost) */}
        <span style={{ fontSize: 14, fontWeight: 800, color: C.gold, whiteSpace: "nowrap", paddingLeft: 6 }}>פריסת שולחנות</span>

        {/* Restaurant */}
        {restaurants.length > 1 && (<>
          <div style={{ width: 1, height: 18, background: C.border, flexShrink: 0 }} />
          <select value={restaurantId} onChange={e => { setRestaurantId(e.target.value); loadLayout(e.target.value); }}
            style={{ background: "#1a0a06", border: "1px solid rgba(212,160,23,0.3)", color: C.text, borderRadius: 7, padding: "3px 7px", fontSize: 12, outline: "none", direction: "rtl" }}>
            {restaurants.map(r => <option key={r.id} value={r.id} style={{ background: "#1a0a06", color: C.text }}>{r.name}</option>)}
          </select>
        </>)}

        <div style={{ width: 1, height: 18, background: C.border, flexShrink: 0 }} />

        {/* Tools */}
        <button ref={toolsBtnRef}
          onClick={() => { if (toolsMenu) { setToolsMenu(null); return; } const r = toolsBtnRef.current!.getBoundingClientRect(); setToolsMenu({ x: r.left, y: r.bottom + 2 }); }}
          style={{ padding: "4px 10px", borderRadius: 8, background: snapOn || showBg || showStats || !!toolsMenu ? "rgba(212,160,23,0.22)" : "rgba(255,255,255,0.06)", border: `1px solid ${snapOn || showBg || showStats || !!toolsMenu ? "#d4a017" : "rgba(255,255,255,0.13)"}`, color: snapOn || showBg || showStats || !!toolsMenu ? "#ffd700" : "#e9ecef", fontSize: 12, fontWeight: 700, cursor: "pointer", outline: "none", fontFamily: "inherit", whiteSpace: "nowrap" as const }}>
          ⚙ כלים ▾
        </button>

        <div style={{ width: 1, height: 18, background: C.border, flexShrink: 0 }} />

        {/* Zoom */}
        <TopBtn onClick={() => zoomBy(0.1)} title="הגדל">+</TopBtn>
        <span style={{ fontSize: 11, color: C.gold, minWidth: 36, textAlign: "center", fontWeight: 700 }}>{Math.round(zoom * 100)}%</span>
        <TopBtn onClick={() => zoomBy(-0.1)} title="הקטן">−</TopBtn>

        <div style={{ width: 1, height: 18, background: C.border, flexShrink: 0 }} />

        {/* Undo / Redo / Select */}
        <TopBtn onClick={undo} title="בטל (Ctrl+Z)" active={canUndo}>↩</TopBtn>
        <TopBtn onClick={redo} title="חזור (Ctrl+Y)" active={canRedo}>↪</TopBtn>
        <TopBtn onClick={selectAll} title="בחר הכל (Ctrl+A)">⊞</TopBtn>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Autosave */}
        <button onClick={() => setAutoSave(s => !s)} title="שמירה אוטומטית כל 30 שניות"
          style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 9px", borderRadius: 8, background: autoSave ? "rgba(212,160,23,0.12)" : "rgba(255,255,255,0.05)", border: `1px solid ${autoSave ? "rgba(212,160,23,0.35)" : "rgba(255,255,255,0.1)"}`, color: autoSave ? C.gold : C.muted, fontSize: 12, fontWeight: 700, cursor: "pointer", outline: "none", fontFamily: "inherit", whiteSpace: "nowrap" as const, flexShrink: 0 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: autoSave ? "#4caf50" : "#555", display: "inline-block", flexShrink: 0 }} />
          אוטו
        </button>

        <div style={{ width: 1, height: 18, background: C.border, flexShrink: 0 }} />

        {/* Clear */}
        <TopBtn onClick={clearAll} title="נקה הכל" danger wide>✕ נקה</TopBtn>

        {/* Fullscreen */}
        <TopBtn active={isFullscreen} onClick={() => { if (!document.fullscreenElement) document.documentElement.requestFullscreen?.(); else document.exitFullscreen?.(); }} title={isFullscreen ? "יציאה ממסך מלא" : "מסך מלא"} wide>
          {isFullscreen ? "⛶ יציאה" : "⛶ מסך מלא"}
        </TopBtn>

        {/* Save — leftmost */}
        <button onClick={saveLayout} disabled={saving} style={{ padding: "5px 18px", borderRadius: 8, background: saved ? "rgba(76,175,80,0.22)" : "linear-gradient(135deg,#7a5a0e,#d4a017)", color: saved ? "#4caf50" : "#fff", fontWeight: 800, fontSize: 13, border: "none", cursor: "pointer", opacity: saving ? 0.6 : 1, whiteSpace: "nowrap" as const, letterSpacing: ".02em", flexShrink: 0 }}>
          {saving ? "שומר..." : saved ? "✓ נשמר" : "שמור"}
        </button>
      </div>

      {/* ── Room tabs ── */}
      {/* ── Room tabs ── RTL */}
      <div style={{ display: "flex", alignItems: "center", padding: "0 14px", borderBottom: "1px solid rgba(212,160,23,0.15)", background: "rgba(10,4,2,0.92)", flexShrink: 0, direction: "rtl", height: 36 }}>
        {/* Tabs on right */}
        {layout.rooms.map((room, idx) => (
          <div key={room.id} style={{ display: "flex", alignItems: "center" }}>
            <button onClick={() => setRoomIdx(idx)}
              style={{ padding: "0 14px", height: 36, fontSize: 13, fontWeight: idx === roomIdx ? 700 : 500, cursor: "pointer", background: "none", border: "none", borderBottom: idx === roomIdx ? `2px solid ${C.gold}` : "2px solid transparent", color: idx === roomIdx ? C.gold : C.muted, whiteSpace: "nowrap", fontFamily: "inherit" }}>
              {room.name}
            </button>
            {layout.rooms.length > 1 && (
              <button onClick={() => delRoom(idx)} style={{ fontSize: 14, color: C.muted, background: "none", border: "none", cursor: "pointer", padding: "0 2px", lineHeight: 1 }}>×</button>
            )}
          </div>
        ))}
        <button onClick={() => setShowNewRoom(true)}
          style={{ padding: "0 10px", height: 36, fontSize: 13, color: C.muted, background: "none", border: "none", cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit" }}>
          + חדר
        </button>

        {/* Stats on left */}
        <div style={{ marginRight: "auto", display: "flex", gap: 10, alignItems: "center", direction: "rtl" }}>
          {[
            { label: "שולחנות", val: activeRoom?.tables.length ?? 0 },
            { label: "מקומות",  val: activeRoom?.tables.reduce((a, t) => a + t.seats, 0) ?? 0 },
            { label: "יושבים",  val: activeRoom?.tables.reduce((a, t) => a + t.seatedCount, 0) ?? 0 },
          ].map(s => (
            <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12 }}>
              <span style={{ color: C.muted, fontWeight: 500 }}>{s.label}:</span>
              <span style={{ minWidth: 28, textAlign: "center", padding: "1px 7px", borderRadius: 5, border: `1px solid rgba(212,160,23,0.45)`, background: "rgba(212,160,23,0.08)", color: C.gold, fontWeight: 700, fontSize: 13 }}>{s.val}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Main: Sidebar + Canvas ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", direction: "ltr" }}>

        {/* Sidebar */}
        <div
          style={{ width: showSidebar ? sidebarWidth : 36, flexShrink: 0, background: "rgba(10,4,2,0.30)", backdropFilter: "blur(10px)", borderRight: "1px solid rgba(212,160,23,0.18)", display: "flex", flexDirection: "column", overflow: "visible", transition: sidebarResizing.current ? "none" : "width 0.18s ease", direction: "rtl", position: "relative" }}>

          {/* Header row: collapse toggle */}
          <div style={{ display: "flex", alignItems: "center", borderBottom: "1px solid rgba(212,160,23,0.12)", flexShrink: 0 }}>
            <button onClick={() => setShowSidebar(s => !s)} title={showSidebar ? "כווץ סרגל" : "פתח סרגל"}
              style={{ flex: 1, padding: "7px 0", background: "none", border: "none", color: C.gold, fontSize: 13, cursor: "pointer", lineHeight: 1 }}>
              {showSidebar ? "◁" : "▷"}
            </button>
          </div>

          {/* Resize handle */}
          {showSidebar && (
            <div
              title="גרור לשינוי רוחב"
              onMouseDown={e => {
                sidebarResizing.current = true;
                sidebarResizeStartX.current = e.clientX;
                sidebarResizeStartW.current = sidebarWidth;
                const mm = (me: MouseEvent) => {
                  if (!sidebarResizing.current) return;
                  const newW = Math.max(140, Math.min(400, sidebarResizeStartW.current + me.clientX - sidebarResizeStartX.current));
                  setSidebarWidth(newW);
                };
                const mu = () => { sidebarResizing.current = false; document.removeEventListener("mousemove", mm); document.removeEventListener("mouseup", mu); };
                document.addEventListener("mousemove", mm);
                document.addEventListener("mouseup", mu);
                e.preventDefault();
              }}
              style={{ position: "absolute", top: 0, right: -3, width: 6, height: "100%", cursor: "ew-resize", zIndex: 20, background: "transparent" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(212,160,23,0.25)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            />
          )}

          {showSidebar ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "10px 8px", gap: 5, overflow: "hidden" }}>
              {/* Section: tables */}
              <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 3, paddingRight: 4 }}>גרור לקנבס</div>
              {PALETTE.map(pi => (
                <div key={pi.label} draggable
                  onDragStart={e => { e.dataTransfer.effectAllowed = "copy"; e.dataTransfer.setData("text/plain", pi.label); paletteDrag.current = pi; }}
                  onDragEnd={() => { paletteDrag.current = null; }}
                  onDoubleClick={() => { spawnTable((vSize.w / 2 - panX) / zoom, (vSize.h / 2 - panY) / zoom, pi); }}
                  style={{ display: "flex", alignItems: "center", padding: "6px 8px", borderRadius: 8, cursor: "grab", userSelect: "none", border: "1px solid rgba(212,160,23,0.22)", background: "rgba(212,160,23,0.04)", transition: "all 0.12s", gap: 0 }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = C.gold; (e.currentTarget as HTMLElement).style.background = "rgba(212,160,23,0.12)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(212,160,23,0.22)"; (e.currentTarget as HTMLElement).style.background = "rgba(212,160,23,0.04)"; }}>
                  <span style={{ fontSize: 16, color: "#d4a017", marginLeft: 8 }}>{pi.icon}</span>
                  <span style={{ fontSize: 12, color: C.text, fontWeight: 600, flex: 1 }}>{pi.label}</span>
                  <span style={{ fontSize: 13, color: "rgba(212,160,23,0.3)", letterSpacing: "1px" }}>⠿</span>
                </div>
              ))}

              {/* Divider */}
              <div style={{ height: 1, background: "rgba(212,160,23,0.15)", margin: "4px 0" }} />

              {/* Section: decos */}
              <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 3, paddingRight: 4 }}>עיצוב</div>
              {DECO_PALETTE.map(pi => (
                <div key={pi.label} draggable
                  onDragStart={e => { e.dataTransfer.effectAllowed = "copy"; e.dataTransfer.setData("text/plain", pi.label); paletteDragDeco.current = pi; }}
                  onDragEnd={() => { paletteDragDeco.current = null; }}
                  onDoubleClick={() => { spawnDeco((vSize.w / 2 - panX) / zoom, (vSize.h / 2 - panY) / zoom, pi); }}
                  style={{ display: "flex", alignItems: "center", padding: "6px 8px", borderRadius: 8, cursor: "grab", userSelect: "none", border: "1px solid rgba(212,160,23,0.22)", background: "rgba(212,160,23,0.04)", transition: "all 0.12s" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = C.gold; (e.currentTarget as HTMLElement).style.background = "rgba(212,160,23,0.12)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(212,160,23,0.22)"; (e.currentTarget as HTMLElement).style.background = "rgba(212,160,23,0.04)"; }}>
                  <span style={{ fontSize: 16, color: "#d4a017", marginLeft: 8 }}>{pi.icon}</span>
                  <span style={{ fontSize: 12, color: C.text, fontWeight: 600, flex: 1 }}>{pi.label}</span>
                  <span style={{ fontSize: 13, color: "rgba(212,160,23,0.3)", letterSpacing: "1px" }}>⠿</span>
                </div>
              ))}
            </div>
          ) : (
            /* Collapsed: icons only */
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "8px 0", gap: 6, overflow: "hidden" }}>
              {([...PALETTE, ...DECO_PALETTE] as (PaletteItem | DecoPaletteItem)[]).map(pi => (
                <div key={pi.label} draggable title={pi.label}
                  onDragStart={e => { e.dataTransfer.effectAllowed = "copy"; e.dataTransfer.setData("text/plain", pi.label); if ("shape" in pi) paletteDrag.current = pi; else paletteDragDeco.current = pi; }}
                  onDragEnd={() => { paletteDrag.current = null; paletteDragDeco.current = null; }}
                  onDoubleClick={() => { const cx = (vSize.w / 2 - panX) / zoom, cy = (vSize.h / 2 - panY) / zoom; if ("shape" in pi) spawnTable(cx, cy, pi); else spawnDeco(cx, cy, pi); }}
                  style={{ width: 28, height: 28, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", cursor: "grab", userSelect: "none", border: "1px solid rgba(212,160,23,0.25)", background: "rgba(212,160,23,0.05)", flexShrink: 0 }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(212,160,23,0.2)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(212,160,23,0.05)"; }}>
                  <span style={{ fontSize: 14, color: "#d4a017" }}>{pi.icon}</span>
                </div>
              ))}
            </div>
          )}
        </div>

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
                <div style={{ width: vSize.w, height: vSize.h, position: "relative" }}>
                  {/* Background layer (separate so bgImg opacity doesn't affect tables) */}
                  <div data-canvas="bg" style={{ position: "absolute", inset: 0, zIndex: 0, cursor: "grab", ...(activeRoom?.bgImg ? { backgroundImage: `url(${activeRoom.bgImg})`, backgroundSize: "cover", backgroundPosition: "center", opacity: activeRoom.bgOpacity ?? 1 } : { background: bgCfg.cw, backgroundSize: "40px 40px" }) }} />

                  {/* Decorations */}
                  {(activeRoom?.decos ?? [])
                    .slice()
                    .sort((a, b) => a.zIdx - b.zIdx)
                    .map(deco => (
                      <DecorationItem
                        key={deco.id}
                        deco={deco}
                        selected={selDecoId === deco.id || multiSelDecoIds.has(deco.id)}
                        onMD={e => handleDecoMD(e, deco)}
                        onCtx={e => handleDecoCtx(e, deco.id)}
                        onResizeMD={e => handleDecoResizeMD(e, deco)}
                        onRotateMD={e => handleDecoRotateMD(e, deco)}
                        onRotateStep={deg => rotateDecoStep(deco.id, deg)}
                        onTextCommit={text => updDeco(deco.id, { text })}
                        onPickImage={() => pickImageForDeco(deco.id)}
                      />
                    ))}

                  {/* Tables */}
                  {activeRoom?.tables
                    .slice()
                    .sort((a, b) => a.zIdx - b.zIdx)
                    .map(table => (
                      <TableItem
                        key={table.id}
                        table={table}
                        selected={selId === table.id || multiSelIds.has(table.id)}
                        inlineSeated={inlineSeated?.id === table.id ? {
                          val: inlineSeated.val,
                          onChange: val => setInlineSeated(s => s ? { ...s, val } : null),
                          onCommit: () => {
                            const n = parseInt(inlineSeated.val);
                            if (!isNaN(n)) updTable(table.id, { seatedCount: Math.max(0, Math.min(n, table.seats)) });
                            setInlineSeated(null);
                          },
                        } : null}
                        onMD={e => handleTableMD(e, table)}
                        onDbl={e => handleTableDbl(e, table.id)}
                        onCtx={e => handleTableCtx(e, table.id)}
                        onRotateMD={e => handleRotateMD(e, table)}
                        onResizeMD={e => handleResizeMD(e, table)}
                        onRotateStep={deg => rotateTableStep(table.id, deg)}
                        onSeatedClick={e => {
                          e.stopPropagation();
                          setSelId(table.id);
                          setInlineSeated({ id: table.id, val: String(table.seatedCount) });
                        }}
                      />
                    ))}
                </div>
              </div>


            </>
          )}
        </div>
      </div>

      {/* ── Context menu ── */}
      {ctxMenu && (() => {
        const isDeco = ctxMenu.kind === "deco";
        const menuH = isDeco ? 110 : 380;
        const menuW = 178;
        const cx = ctxMenu.x + menuW > window.innerWidth - 8 ? ctxMenu.x - menuW : ctxMenu.x;
        const cy = ctxMenu.y + menuH > window.innerHeight - 8 ? Math.max(8, ctxMenu.y - menuH) : ctxMenu.y;
        const items = isDeco
          ? [
              { icon: "⎘", label: "שכפל", action: () => dupDeco(ctxMenu.id) },
              null,
              { icon: "🗑", label: "מחק", color: "#f44336", action: () => delDeco(ctxMenu.id) },
            ]
          : [
              { icon: "✏️", label: "ערוך",      action: () => { openEdit(ctxMenu.id); setCtxMenu(null); } },
              { icon: "⎘",  label: "שכפל",      action: () => dupTable(ctxMenu.id) },
              null,
              { icon: "↺",  label: "סובב -15°", action: () => { rotateTableStep(ctxMenu.id, -15); setCtxMenu(null); } },
              { icon: "↻",  label: "סובב +15°", action: () => { rotateTableStep(ctxMenu.id, 15);  setCtxMenu(null); } },
              null,
              ...Object.entries(STATUS_CFG).map(([s, cfg]) => ({ icon: "●", label: cfg.label, color: cfg.color, action: () => { updTable(ctxMenu.id, { status: s as TableStatus }); setCtxMenu(null); } })),
              null,
              { icon: "🗑", label: "מחק", color: "#f44336", action: () => delTable(ctxMenu.id) },
            ];
        return (
          <div style={{ position: "fixed", left: cx, top: cy, zIndex: 3000, background: "linear-gradient(145deg,#1a0a06,#2a1008)", border: "1px solid rgba(212,160,23,0.35)", borderRadius: 10, boxShadow: "0 8px 32px rgba(0,0,0,0.65)", overflow: "hidden", minWidth: menuW }}
            onMouseLeave={() => setCtxMenu(null)}>
            {(items as (null | { icon: string; label: string; color?: string; action: () => void })[]).map((item, i) => {
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
        );
      })()}

      {/* ── Tools dropdown ── */}
      {toolsMenu && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 3998 }} onClick={() => setToolsMenu(null)} />
          <div style={{ position: "fixed", top: toolsMenu.y, left: toolsMenu.x, zIndex: 3999, background: "linear-gradient(145deg,#1a0a06,#2a1008)", border: "1px solid rgba(212,160,23,0.4)", borderRadius: 10, boxShadow: "0 8px 28px rgba(0,0,0,0.65)", overflow: "hidden", minWidth: 170 }}>
            {([
              { icon: "⊞", label: "רשת (G)",   active: snapOn,    action: () => setSnapOn(s => !s) },
              { icon: "⚡", label: "סדר אוטו",  active: false,     action: () => { autoArrange(); setToolsMenu(null); } },
              { icon: "▣", label: "רקע קנבס",  active: showBg,    action: () => setShowBg(s => !s) },
              { icon: "≡", label: "נתונים",    active: showStats, action: () => setShowStats(s => !s) },
              null,
              { icon: "⬇", label: "ייצא Layout", active: false, action: () => { exportLayout(); setToolsMenu(null); } },
              { icon: "⬆", label: "ייבא Layout", active: false, action: () => { importFileRef.current?.click(); setToolsMenu(null); } },
              { icon: "📊", label: "ייצא שולחנות לאקסל", active: false, action: () => { exportTablesToExcel(); setToolsMenu(null); } },
            ] as (null | { icon: string; label: string; active: boolean; action: () => void })[]).map((item, i) => {
              if (!item) return <div key={i} style={{ height: 1, background: "rgba(255,255,255,0.07)" }} />;
              return (
                <button key={i} onClick={item.action}
                  style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "9px 14px", fontSize: 13, color: item.active ? "#ffd700" : "#e9ecef", background: item.active ? "rgba(212,160,23,0.12)" : "none", border: "none", cursor: "pointer", textAlign: "right" as const, fontFamily: "inherit" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(212,160,23,0.15)")}
                  onMouseLeave={e => (e.currentTarget.style.background = item.active ? "rgba(212,160,23,0.12)" : "none")}>
                  <span style={{ minWidth: 16, color: "#d4a017" }}>{item.icon}</span>{item.label}
                  {item.active && <span style={{ marginLeft: "auto", fontSize: 10, color: "#ffd700" }}>✓</span>}
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* ── Edit popup ── */}
      {editTable && (
        <EditPopup
          table={editTable}
          pos={editPos}
          restaurantId={restaurantId}
          origin={origin}
          onClose={() => setEditId(null)}
          onUpdate={u => updTable(editTable.id, u)}
          onDelete={() => delTable(editTable.id)}
          onDup={() => dupTable(editTable.id)}
          onBringFront={() => bringFront(editTable.id)}
          onSendBack={() => sendBack(editTable.id)}
        />
      )}

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
