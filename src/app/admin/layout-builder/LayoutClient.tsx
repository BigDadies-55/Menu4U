"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";

type CellType    = "empty" | "wall" | "table" | "bar";
type ToolMode    = CellType | "move";
type BarSide     = "top" | "bottom" | "left" | "right";
type TableShape  = "square" | "round" | "oval";

type Cell = {
  r: number; c: number; type: CellType;
  tableNumber?: string; seats?: number;
  barSide?: BarSide; tableShape?: TableShape;
};

type Layout = { rows: number; cols: number; cells: Cell[] };
type Restaurant = { id: string; name: string };

// Grid dimensions — large fixed canvas, displayed cell-size adapts to screen
const ROWS = 22;
const COLS = 42;
const BASE = 30; // px the visual components were designed for

function cellKey(r: number, c: number) { return `${r}:${c}`; }
function layoutToMap(l: Layout): Map<string, Cell> {
  const m = new Map<string, Cell>();
  for (const c of l.cells) m.set(cellKey(c.r, c.c), c);
  return m;
}
function mapToLayout(m: Map<string, Cell>): Layout {
  return { rows: ROWS, cols: COLS, cells: Array.from(m.values()) };
}
function connRadius(N: boolean, S: boolean, E: boolean, W: boolean) {
  return `${!N&&!W?2:0}px ${!N&&!E?2:0}px ${!S&&!E?2:0}px ${!S&&!W?2:0}px`;
}

/* ─── Chair helpers (designed for BASE=30) ─── */
function getChairDist(seats: number) {
  if (seats <= 2) return { top: 1, bottom: 1, left: 0, right: 0 };
  if (seats <= 4) return { top: 1, bottom: 1, left: 1, right: 1 };
  if (seats <= 6) return { top: 2, bottom: 2, left: 1, right: 1 };
  if (seats <= 8) return { top: 2, bottom: 2, left: 2, right: 2 };
  return           { top: 3, bottom: 3, left: 2, right: 2 };
}
const HC = () => <div style={{ width: 6, height: 4, background: "#92400e", borderRadius: 1, flexShrink: 0 }} />;
const VC = () => <div style={{ width: 4, height: 6, background: "#92400e", borderRadius: 1, flexShrink: 0 }} />;
const ST = () => <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#fbbf24", border: "1px solid #92400e", flexShrink: 0 }} />;

/* ─── Table visuals (all sized for BASE=30) ─── */
function SquareTableVisual({ cell, ghost }: { cell: Cell; ghost?: boolean }) {
  const d = getChairDist(cell.seats ?? 4);
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ opacity: ghost ? 0.5 : 1 }}>
      {d.top    > 0 && <div className="absolute left-0 right-0 flex justify-center gap-px" style={{ top: 1 }}>{Array.from({length: d.top   }).map((_,i)=><HC key={i}/>)}</div>}
      {d.bottom > 0 && <div className="absolute left-0 right-0 flex justify-center gap-px" style={{ bottom: 1 }}>{Array.from({length: d.bottom}).map((_,i)=><HC key={i}/>)}</div>}
      {d.left   > 0 && <div className="absolute top-0 bottom-0 flex flex-col justify-center gap-px" style={{ left: 1 }}>{Array.from({length: d.left  }).map((_,i)=><VC key={i}/>)}</div>}
      {d.right  > 0 && <div className="absolute top-0 bottom-0 flex flex-col justify-center gap-px" style={{ right: 1 }}>{Array.from({length: d.right }).map((_,i)=><VC key={i}/>)}</div>}
      <div className="absolute rounded flex items-center justify-center"
        style={{ inset: 7, background: "linear-gradient(135deg,#fef3c7,#fde68a)", border: "1.5px solid #d97706", boxShadow: "0 1px 2px rgba(0,0,0,0.15)" }}>
        <span className="font-black text-amber-900 leading-none" style={{ fontSize: 8 }}>{cell.tableNumber || "?"}</span>
      </div>
    </div>
  );
}

function RoundTableVisual({ cell, ghost }: { cell: Cell; ghost?: boolean }) {
  const seats = cell.seats ?? 4;
  const half = BASE / 2; const tR = 9; const cR = 12;
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ opacity: ghost ? 0.5 : 1 }}>
      {Array.from({length: seats}).map((_,i) => {
        const a = (i * 2 * Math.PI / seats) - Math.PI / 2;
        return <div key={i} className="absolute rounded-full" style={{ width: 5, height: 5, background: "#92400e", left: half + cR*Math.cos(a)-2.5, top: half + cR*Math.sin(a)-2.5 }} />;
      })}
      <div className="absolute rounded-full flex items-center justify-center"
        style={{ left: half-tR, top: half-tR, width: tR*2, height: tR*2, background: "linear-gradient(135deg,#fef3c7,#fde68a)", border: "1.5px solid #d97706" }}>
        <span className="font-black text-amber-900" style={{ fontSize: 7 }}>{cell.tableNumber || "?"}</span>
      </div>
    </div>
  );
}

function OvalTableVisual({ cell, ghost }: { cell: Cell; ghost?: boolean }) {
  const seats = cell.seats ?? 4;
  const half = BASE / 2; const rx = 13; const ry = 9; const trx = 10; const try_ = 7;
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ opacity: ghost ? 0.5 : 1 }}>
      {Array.from({length: seats}).map((_,i) => {
        const a = (i * 2 * Math.PI / seats) - Math.PI / 2;
        return <div key={i} className="absolute rounded-full" style={{ width: 5, height: 5, background: "#92400e", left: half+rx*Math.cos(a)-2.5, top: half+ry*Math.sin(a)-2.5 }} />;
      })}
      <div className="absolute flex items-center justify-center"
        style={{ left: half-trx, top: half-try_, width: trx*2, height: try_*2, borderRadius: "50%", background: "linear-gradient(135deg,#fef3c7,#fde68a)", border: "1.5px solid #d97706" }}>
        <span className="font-black text-amber-900" style={{ fontSize: 7 }}>{cell.tableNumber || "?"}</span>
      </div>
    </div>
  );
}

function TableCellVisual({ cell, ghost }: { cell: Cell; ghost?: boolean }) {
  const s = cell.tableShape ?? "square";
  if (s === "round") return <RoundTableVisual cell={cell} ghost={ghost} />;
  if (s === "oval")  return <OvalTableVisual  cell={cell} ghost={ghost} />;
  return <SquareTableVisual cell={cell} ghost={ghost} />;
}

function WallCellVisual({ r, c, cellMap }: { r: number; c: number; cellMap: Map<string, Cell> }) {
  const N = cellMap.get(cellKey(r-1,c))?.type === "wall";
  const S = cellMap.get(cellKey(r+1,c))?.type === "wall";
  const E = cellMap.get(cellKey(r,c+1))?.type === "wall";
  const W = cellMap.get(cellKey(r,c-1))?.type === "wall";
  return (
    <div className="absolute inset-0" style={{
      borderRadius: connRadius(N,S,E,W),
      background: "#374151",
      backgroundImage: ["repeating-linear-gradient(0deg,rgba(255,255,255,0.06) 0,rgba(255,255,255,0.06) 1px,transparent 1px,transparent 7px)",
        "repeating-linear-gradient(90deg,rgba(255,255,255,0.06) 0,rgba(255,255,255,0.06) 1px,transparent 1px,transparent 12px)"].join(","),
    }} />
  );
}

function BarCellVisual({ r, c, cell, cellMap }: { r: number; c: number; cell: Cell; cellMap: Map<string, Cell> }) {
  const side = cell.barSide ?? "top";
  const N = cellMap.get(cellKey(r-1,c))?.type === "bar";
  const S = cellMap.get(cellKey(r+1,c))?.type === "bar";
  const E = cellMap.get(cellKey(r,c+1))?.type === "bar";
  const W = cellMap.get(cellKey(r,c-1))?.type === "bar";
  return (
    <div className="absolute inset-0 pointer-events-none">
      <div className="absolute inset-0" style={{
        borderRadius: connRadius(N,S,E,W),
        background: "linear-gradient(135deg,#78350f,#92400e)",
        backgroundImage: "repeating-linear-gradient(90deg,rgba(255,255,255,0.05) 0,rgba(255,255,255,0.05) 1px,transparent 1px,transparent 7px)",
      }} />
      {side==="top"    && <div className="absolute left-0 right-0 flex justify-around px-1" style={{top:2}}><ST/><ST/></div>}
      {side==="bottom" && <div className="absolute left-0 right-0 flex justify-around px-1" style={{bottom:2}}><ST/><ST/></div>}
      {side==="left"   && <div className="absolute top-0 bottom-0 flex flex-col justify-around py-1" style={{left:2}}><ST/><ST/></div>}
      {side==="right"  && <div className="absolute top-0 bottom-0 flex flex-col justify-around py-1" style={{right:2}}><ST/><ST/></div>}
    </div>
  );
}

/* ─── Constants ─── */
const BAR_SIDES: { side: BarSide; label: string; title: string }[] = [
  { side: "top", label: "↑", title: "מלמעלה" },
  { side: "bottom", label: "↓", title: "מלמטה" },
  { side: "left", label: "←", title: "משמאל" },
  { side: "right", label: "→", title: "מימין" },
];
const TABLE_SHAPES: { shape: TableShape; label: string; title: string }[] = [
  { shape: "square", label: "⬜", title: "מרובע" },
  { shape: "round",  label: "⭕", title: "עגול" },
  { shape: "oval",   label: "🥚", title: "אובלי" },
];

/* ─── Main component ─── */
export default function LayoutClient({ restaurants }: { restaurants: Restaurant[] }) {
  const [restaurantId, setRestaurantId] = useState(restaurants[0]?.id ?? "");
  const [tool, setTool]             = useState<ToolMode>("table");
  const [barSide, setBarSide]       = useState<BarSide>("top");
  const [tableShape, setTableShape] = useState<TableShape>("square");
  const [cellMap, setCellMap]       = useState<Map<string, Cell>>(new Map());
  const [editCell, setEditCell]     = useState<{ r: number; c: number } | null>(null);
  const [editForm, setEditForm]     = useState({ tableNumber: "", seats: "4", shape: "square" as TableShape });
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [loading, setLoading]       = useState(false);
  const [copied, setCopied]         = useState(false);
  const [origin, setOrigin]         = useState("");
  const [cellPx, setCellPx]         = useState(BASE);

  const [dragSource, setDragSource] = useState<Cell | null>(null);
  const [dragOver, setDragOver]     = useState<{ r: number; c: number } | null>(null);
  const isDragging = useRef(false);
  const isPainting = useRef(false);
  const gridRef    = useRef<HTMLDivElement>(null);

  useEffect(() => { setOrigin(window.location.origin); }, []);

  // Dynamic cell size: fill container width
  useEffect(() => {
    const recalc = () => {
      if (!gridRef.current) return;
      const w = gridRef.current.clientWidth - 16; // 8px padding each side
      const size = Math.max(14, Math.floor((w - (COLS - 1)) / COLS));
      setCellPx(size);
    };
    recalc();
    const ro = new ResizeObserver(recalc);
    if (gridRef.current) ro.observe(gridRef.current);
    return () => ro.disconnect();
  }, []);

  const scale = cellPx / BASE;

  useEffect(() => {
    if (restaurants[0]?.id) loadLayout(restaurants[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadLayout(rid: string) {
    setLoading(true);
    const res = await fetch(`/api/admin/restaurants/${rid}/layout`);
    if (res.ok) {
      const data = await res.json();
      try { setCellMap(data.tableLayoutJson ? layoutToMap(JSON.parse(data.tableLayoutJson)) : new Map()); }
      catch { setCellMap(new Map()); }
    }
    setLoading(false);
  }

  function handleRestaurantChange(rid: string) {
    setRestaurantId(rid);
    loadLayout(rid);
  }

  function applyTool(r: number, c: number) {
    if (tool === "move") return;
    const key = cellKey(r, c);
    setCellMap(prev => {
      const next = new Map(prev);
      if (tool === "empty") {
        next.delete(key);
      } else if (tool === "wall") {
        next.set(key, { r, c, type: "wall" });
      } else if (tool === "bar") {
        next.set(key, { r, c, type: "bar", barSide });
      } else {
        const existing = prev.get(key);
        if (existing?.type === "table") {
          setEditCell({ r, c });
          setEditForm({ tableNumber: existing.tableNumber ?? "", seats: String(existing.seats ?? 4), shape: existing.tableShape ?? "square" });
        } else {
          next.set(key, { r, c, type: "table", tableNumber: "", seats: 4, tableShape });
          setEditCell({ r, c });
          setEditForm({ tableNumber: "", seats: "4", shape: tableShape });
        }
      }
      return next;
    });
  }

  const commitMove = useCallback(() => {
    if (dragSource && dragOver) {
      const srcKey = cellKey(dragSource.r, dragSource.c);
      const dstKey = cellKey(dragOver.r, dragOver.c);
      if (srcKey !== dstKey) {
        setCellMap(prev => {
          const next = new Map(prev);
          next.delete(srcKey);
          next.set(dstKey, { ...dragSource, r: dragOver.r, c: dragOver.c });
          return next;
        });
      }
    }
    setDragSource(null); setDragOver(null); isDragging.current = false;
  }, [dragSource, dragOver]);

  function saveEditCell() {
    if (!editCell) return;
    setCellMap(prev => {
      const next = new Map(prev);
      next.set(cellKey(editCell.r, editCell.c), {
        r: editCell.r, c: editCell.c, type: "table",
        tableNumber: editForm.tableNumber,
        seats: parseInt(editForm.seats) || 4,
        tableShape: editForm.shape,
      });
      return next;
    });
    setEditCell(null);
  }

  function clearAll() {
    if (!confirm("למחוק את כל הפריסה?")) return;
    setCellMap(new Map());
  }

  async function saveLayout() {
    if (!restaurantId) return;
    setSaving(true);
    await fetch(`/api/admin/restaurants/${restaurantId}/layout`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tableLayoutJson: JSON.stringify(mapToLayout(cellMap)) }),
    });
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2500);
  }

  const tableCount = Array.from(cellMap.values()).filter(c => c.type === "table").length;
  const totalSeats = Array.from(cellMap.values()).filter(c => c.type === "table").reduce((s, c) => s + (c.seats ?? 4), 0);

  return (
    <div className="p-4 md:p-6 flex flex-col h-full"
      onMouseUp={() => { if (isDragging.current) commitMove(); isPainting.current = false; }}>
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">🗺 פריסת שולחנות</h1>
        <p className="text-gray-500 mt-0.5 text-sm">תכנן את מפת המסעדה — שולחנות, בר, קירות ומעברים</p>
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-2 mb-4">
        <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
          {restaurants.length > 1 && (
            <select value={restaurantId} onChange={e => handleRestaurantChange(e.target.value)}
              className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400">
              {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          )}

          <div className="flex rounded-xl overflow-hidden border border-gray-200 bg-white">
            {([
              { t: "table" as ToolMode, label: "🪑 שולחן" },
              { t: "bar"   as ToolMode, label: "🍺 בר" },
              { t: "wall"  as ToolMode, label: "🧱 קיר" },
              { t: "move"  as ToolMode, label: "✋ הזז" },
              { t: "empty" as ToolMode, label: "🗑 מחק" },
            ]).map(({ t, label }) => (
              <button key={t} onClick={() => setTool(t)}
                className={`px-3 py-2 text-sm font-medium transition-colors ${tool === t ? "text-white" : "text-gray-600 hover:bg-gray-50"}`}
                style={tool === t ? { background: "linear-gradient(135deg,#8B6914,#C9A84C)" } : undefined}>
                {label}
              </button>
            ))}
          </div>

          <div className="flex gap-2 mr-auto">
            <button onClick={clearAll}
              className="px-3 py-2 text-sm rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors">
              נקה הכל
            </button>
            <button onClick={saveLayout} disabled={saving || !restaurantId}
              className="px-4 py-2 text-sm font-semibold rounded-xl text-white disabled:opacity-50"
              style={{ background: "linear-gradient(135deg,#8B6914,#C9A84C)" }}>
              {saving ? "שומר..." : saved ? "✓ נשמר!" : "שמור פריסה"}
            </button>
          </div>
        </div>

        {tool === "table" && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-gray-600 font-medium">צורת שולחן:</span>
            {TABLE_SHAPES.map(({ shape, label, title }) => (
              <button key={shape} onClick={() => setTableShape(shape)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-sm font-medium border transition-colors ${tableShape === shape ? "text-white border-amber-500" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}
                style={tableShape === shape ? { background: "linear-gradient(135deg,#8B6914,#C9A84C)" } : undefined}>
                {label} {title}
              </button>
            ))}
          </div>
        )}

        {tool === "bar" && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-gray-600 font-medium">כיסאות בר:</span>
            {BAR_SIDES.map(({ side, label, title }) => (
              <button key={side} title={title} onClick={() => setBarSide(side)}
                className={`w-8 h-8 rounded-lg text-base font-bold border transition-colors ${barSide === side ? "text-white border-amber-500" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}
                style={barSide === side ? { background: "linear-gradient(135deg,#78350f,#92400e)" } : undefined}>
                {label}
              </button>
            ))}
            <span className="text-xs text-gray-400">{BAR_SIDES.find(s => s.side === barSide)?.title}</span>
          </div>
        )}

        {tool === "move" && (
          <p className="text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-1.5 w-fit">
            ✋ לחץ וגרור שולחן למיקום חדש
          </p>
        )}
      </div>

      {/* Stats */}
      <div className="flex gap-3 mb-3 text-xs text-gray-500 flex-wrap">
        <span className="flex items-center gap-1.5">
          <span className="inline-block rounded" style={{ width: 12, height: 12, background: "linear-gradient(135deg,#fef3c7,#fde68a)", border: "1.5px solid #d97706" }} />
          {tableCount} שולחנות · {totalSeats} מושבים
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block" style={{ width: 12, height: 12, background: "linear-gradient(135deg,#78350f,#92400e)", borderRadius: 2 }} />
          בר
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block" style={{ width: 12, height: 12, background: "#374151", borderRadius: 2 }} />
          קיר
        </span>
        <span className="text-gray-400 mr-auto">{COLS}×{ROWS} · תא {cellPx}px</span>
      </div>

      {/* Grid — fills remaining width */}
      {loading ? (
        <div className="flex items-center justify-center h-64 text-gray-400">טוען...</div>
      ) : (
        <div ref={gridRef} className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-auto p-2">
          <div className="grid select-none"
            style={{ gridTemplateColumns: `repeat(${COLS}, ${cellPx}px)`, gap: 1, width: "fit-content" }}
            onMouseLeave={() => { if (isDragging.current) commitMove(); isPainting.current = false; }}>
            {Array.from({ length: ROWS }, (_, r) =>
              Array.from({ length: COLS }, (_, c) => {
                const cell    = cellMap.get(cellKey(r, c));
                const isTable = cell?.type === "table";
                const isWall  = cell?.type === "wall";
                const isBar   = cell?.type === "bar";
                const isSrc   = dragSource?.r === r && dragSource?.c === c;
                const isDst   = !!dragSource && dragOver?.r === r && dragOver?.c === c;

                return (
                  <div key={`${r}-${c}`}
                    className="relative"
                    style={{
                      width: cellPx, height: cellPx,
                      background: isTable || isWall || isBar ? "transparent" : "#f8f9fa",
                      border: isWall || isBar ? "none" : "1px solid #e9ecef",
                      cursor: tool === "move" ? (isTable ? "grab" : "default") : "crosshair",
                      outline: isDst ? "2px solid #3b82f6" : undefined,
                      outlineOffset: "-1px",
                    }}
                    onMouseDown={() => {
                      if (tool === "move" && isTable) {
                        isDragging.current = true;
                        setDragSource(cell!);
                        setDragOver({ r, c });
                      } else {
                        isPainting.current = true;
                        applyTool(r, c);
                      }
                    }}
                    onMouseUp={() => { if (isDragging.current) commitMove(); isPainting.current = false; }}
                    onMouseEnter={() => {
                      if (isDragging.current) setDragOver({ r, c });
                      else if (isPainting.current && tool !== "table") applyTool(r, c);
                    }}>

                    {/* Scale wrapper — renders visuals at BASE size then scales to cellPx */}
                    {(isWall || isBar || isTable || isDst) && (
                      <div style={{
                        position: "absolute", width: BASE, height: BASE, left: 0, top: 0,
                        transform: `scale(${scale})`, transformOrigin: "top left",
                        pointerEvents: "none",
                      }}>
                        {isWall  && <WallCellVisual  r={r} c={c} cellMap={cellMap} />}
                        {isBar   && <BarCellVisual   r={r} c={c} cell={cell!} cellMap={cellMap} />}
                        {isTable && <TableCellVisual cell={cell!} ghost={isSrc && isDragging.current} />}
                        {isDst && dragSource && !isTable && <TableCellVisual cell={{ ...dragSource, r, c }} ghost />}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Edit table dialog */}
      {editCell && (() => {
        const tableUrl = editForm.tableNumber && restaurantId && origin
          ? `${origin}/menu/${restaurantId}?table=${encodeURIComponent(editForm.tableNumber)}`
          : null;
        return (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setEditCell(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-gray-900 mb-4">✏️ הגדרת שולחן</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">מספר שולחן</label>
                  <input type="text" value={editForm.tableNumber}
                    onChange={e => setEditForm(f => ({ ...f, tableNumber: e.target.value }))}
                    placeholder="לדוגמה: 1, A3, בר..."
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400"
                    autoFocus />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">צורת שולחן</label>
                  <div className="flex gap-2">
                    {TABLE_SHAPES.map(({ shape, label, title }) => (
                      <button key={shape} type="button" onClick={() => setEditForm(f => ({ ...f, shape }))}
                        className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors ${editForm.shape === shape ? "border-amber-400 text-white" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                        style={editForm.shape === shape ? { background: "linear-gradient(135deg,#8B6914,#C9A84C)" } : undefined}>
                        {label} {title}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">מספר כסאות</label>
                  <div className="flex gap-2">
                    {[2,4,6,8,10].map(n => (
                      <button key={n} type="button" onClick={() => setEditForm(f => ({ ...f, seats: String(n) }))}
                        className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors ${editForm.seats===String(n) ? "border-amber-400 text-white" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                        style={editForm.seats===String(n) ? { background: "linear-gradient(135deg,#8B6914,#C9A84C)" } : undefined}>
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                {tableUrl && (
                  <div className="border border-gray-100 rounded-xl p-4 bg-gray-50 space-y-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">קישור ו-QR לשולחן</p>
                    <div className="flex justify-center">
                      <div className="p-2 bg-white rounded-xl border border-gray-200 inline-block">
                        <QRCodeSVG value={tableUrl} size={160} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input readOnly value={tableUrl}
                        className="flex-1 text-xs text-gray-600 bg-white border border-gray-200 rounded-lg px-2 py-1.5 truncate focus:outline-none"
                        onClick={e => (e.target as HTMLInputElement).select()} />
                      <button type="button"
                        onClick={() => { navigator.clipboard.writeText(tableUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                        className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                        style={{ background: copied ? "#22c55e" : "linear-gradient(135deg,#8B6914,#C9A84C)" }}>
                        {copied ? "✓ הועתק" : "העתק"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={saveEditCell} className="flex-1 py-2.5 rounded-xl text-white font-semibold text-sm"
                  style={{ background: "linear-gradient(135deg,#8B6914,#C9A84C)" }}>
                  שמור שולחן
                </button>
                <button onClick={() => {
                  setCellMap(prev => { const next = new Map(prev); next.delete(cellKey(editCell.r, editCell.c)); return next; });
                  setEditCell(null);
                }} className="px-4 py-2.5 rounded-xl text-red-600 bg-red-50 hover:bg-red-100 text-sm font-medium">
                  מחק
                </button>
                <button onClick={() => setEditCell(null)} className="px-4 py-2.5 rounded-xl bg-gray-100 text-gray-600 text-sm">
                  ביטול
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
