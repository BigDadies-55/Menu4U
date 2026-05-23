"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";

type CellType    = "empty" | "wall" | "table" | "table-part" | "bar";
type ToolMode    = "table" | "bar" | "wall" | "move" | "empty";
type BarSide     = "top" | "bottom" | "left" | "right";
type TableShape  = "square" | "round" | "oval";

type Cell = {
  r: number; c: number; type: CellType;
  // table
  tableNumber?: string; seats?: number; tableShape?: TableShape;
  tableW?: number; tableH?: number;
  // table-part (secondary cells of a multi-cell table)
  anchorR?: number; anchorC?: number;
  // bar
  barSide?: BarSide; barSeats?: number; barLabel?: string;
};

type Layout     = { rows: number; cols: number; cells: Cell[] };
type Restaurant = { id: string; name: string };

const ROWS = 22;
const COLS = 42;
const BASE = 30; // px visual components are designed for

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

function getDefaultTableSize(seats: number): { w: number; h: number } {
  if (seats <= 2) return { w: 1, h: 1 };
  if (seats <= 4) return { w: 2, h: 1 };
  if (seats <= 6) return { w: 2, h: 2 };
  if (seats <= 8) return { w: 3, h: 2 };
  return           { w: 4, h: 2 };
}

function getChairDist(seats: number, w = 1, h = 1) {
  if (w >= 2 && h === 1) {
    // Wide — chairs on top/bottom only
    const half = Math.round(seats / 2);
    return { top: half, bottom: seats - half, left: 0, right: 0 };
  }
  if (w === 1 && h >= 2) {
    // Tall — chairs on left/right only
    const half = Math.round(seats / 2);
    return { top: 0, bottom: 0, left: half, right: seats - half };
  }
  // Square — distribute proportionally
  const perSide = Math.round(seats * w / (2 * (w + h)));
  const tbSeat = Math.max(1, perSide);
  const lrSeat = Math.max(0, Math.round((seats - tbSeat * 2) / 2));
  return { top: tbSeat, bottom: tbSeat, left: lrSeat, right: lrSeat };
}

/* ─── Chair atoms ─── */
const HC = () => <div style={{ width: 6, height: 4, background: "#92400e", borderRadius: 1, flexShrink: 0 }} />;
const VC = () => <div style={{ width: 4, height: 6, background: "#92400e", borderRadius: 1, flexShrink: 0 }} />;
function Stool({ size = 6 }: { size?: number }) {
  return <div style={{ width: size, height: size, borderRadius: "50%", background: "#fbbf24", border: "1px solid #92400e", flexShrink: 0 }} />;
}

/* ─── Table visuals (sized in BASE units) ─── */
function SquareTableVisual({ cell, ghost, w = 1, h = 1 }: { cell: Cell; ghost?: boolean; w?: number; h?: number }) {
  const d = getChairDist(cell.seats ?? 4, w, h);
  const bW = BASE * w; const bH = BASE * h;
  return (
    <div style={{ width: bW, height: bH, position: "relative", opacity: ghost ? 0.5 : 1, pointerEvents: "none" }}>
      {d.top    > 0 && <div className="absolute left-0 right-0 flex justify-around px-2" style={{ top: 1 }}>{Array.from({length:d.top   }).map((_,i)=><HC key={i}/>)}</div>}
      {d.bottom > 0 && <div className="absolute left-0 right-0 flex justify-around px-2" style={{ bottom: 1 }}>{Array.from({length:d.bottom}).map((_,i)=><HC key={i}/>)}</div>}
      {d.left   > 0 && <div className="absolute top-0 bottom-0 flex flex-col justify-around py-2" style={{ left: 1 }}>{Array.from({length:d.left  }).map((_,i)=><VC key={i}/>)}</div>}
      {d.right  > 0 && <div className="absolute top-0 bottom-0 flex flex-col justify-around py-2" style={{ right: 1 }}>{Array.from({length:d.right }).map((_,i)=><VC key={i}/>)}</div>}
      <div className="absolute rounded flex items-center justify-center text-center"
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
    <div style={{ width: BASE, height: BASE, position: "relative", opacity: ghost ? 0.5 : 1, pointerEvents: "none" }}>
      {Array.from({length: seats}).map((_,i) => {
        const a = (i * 2 * Math.PI / seats) - Math.PI / 2;
        return <div key={i} className="absolute rounded-full" style={{ width: 5, height: 5, background: "#92400e", left: half+cR*Math.cos(a)-2.5, top: half+cR*Math.sin(a)-2.5 }} />;
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
    <div style={{ width: BASE, height: BASE, position: "relative", opacity: ghost ? 0.5 : 1, pointerEvents: "none" }}>
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

function TableCellVisual({ cell, ghost, w, h }: { cell: Cell; ghost?: boolean; w?: number; h?: number }) {
  const s = cell.tableShape ?? "square";
  if (s === "round") return <RoundTableVisual cell={cell} ghost={ghost} />;
  if (s === "oval")  return <OvalTableVisual  cell={cell} ghost={ghost} />;
  return <SquareTableVisual cell={cell} ghost={ghost} w={w} h={h} />;
}

function WallCellVisual({ r, c, cellMap }: { r: number; c: number; cellMap: Map<string, Cell> }) {
  const N = cellMap.get(cellKey(r-1,c))?.type==="wall";
  const S = cellMap.get(cellKey(r+1,c))?.type==="wall";
  const E = cellMap.get(cellKey(r,c+1))?.type==="wall";
  const W = cellMap.get(cellKey(r,c-1))?.type==="wall";
  return (
    <div style={{
      width: BASE, height: BASE, position: "relative", borderRadius: connRadius(N,S,E,W),
      background: "#374151",
      backgroundImage: ["repeating-linear-gradient(0deg,rgba(255,255,255,0.06) 0,rgba(255,255,255,0.06) 1px,transparent 1px,transparent 7px)",
        "repeating-linear-gradient(90deg,rgba(255,255,255,0.06) 0,rgba(255,255,255,0.06) 1px,transparent 1px,transparent 12px)"].join(","),
    }} />
  );
}

function BarCellVisual({ r, c, cell, cellMap }: { r: number; c: number; cell: Cell; cellMap: Map<string, Cell> }) {
  const side   = cell.barSide  ?? "top";
  const stools = cell.barSeats ?? 2;
  const N = cellMap.get(cellKey(r-1,c))?.type==="bar";
  const S = cellMap.get(cellKey(r+1,c))?.type==="bar";
  const E = cellMap.get(cellKey(r,c+1))?.type==="bar";
  const W = cellMap.get(cellKey(r,c-1))?.type==="bar";
  return (
    <div style={{ width: BASE, height: BASE, position: "relative", pointerEvents: "none" }}>
      <div className="absolute inset-0" style={{
        borderRadius: connRadius(N,S,E,W),
        background: "linear-gradient(135deg,#78350f,#92400e)",
        backgroundImage: "repeating-linear-gradient(90deg,rgba(255,255,255,0.05) 0,rgba(255,255,255,0.05) 1px,transparent 1px,transparent 7px)",
      }} />
      {/* Label */}
      {cell.barLabel && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="font-black text-amber-200 leading-none" style={{ fontSize: 7 }}>{cell.barLabel}</span>
        </div>
      )}
      {side==="top"    && <div className="absolute left-0 right-0 flex justify-around px-1" style={{top:2,pointerEvents:"none"}}>{Array.from({length:stools}).map((_,i)=><Stool key={i}/>)}</div>}
      {side==="bottom" && <div className="absolute left-0 right-0 flex justify-around px-1" style={{bottom:2,pointerEvents:"none"}}>{Array.from({length:stools}).map((_,i)=><Stool key={i}/>)}</div>}
      {side==="left"   && <div className="absolute top-0 bottom-0 flex flex-col justify-around py-1" style={{left:2,pointerEvents:"none"}}>{Array.from({length:stools}).map((_,i)=><Stool key={i}/>)}</div>}
      {side==="right"  && <div className="absolute top-0 bottom-0 flex flex-col justify-around py-1" style={{right:2,pointerEvents:"none"}}>{Array.from({length:stools}).map((_,i)=><Stool key={i}/>)}</div>}
    </div>
  );
}

/* ─── Constants ─── */
const BAR_SIDES: { side: BarSide; label: string }[] = [
  { side: "top", label: "↑ מלמעלה" },
  { side: "bottom", label: "↓ מלמטה" },
  { side: "left", label: "← משמאל" },
  { side: "right", label: "→ מימין" },
];
const TABLE_SHAPES: { shape: TableShape; label: string }[] = [
  { shape: "square", label: "⬜ מרובע" },
  { shape: "round",  label: "⭕ עגול" },
  { shape: "oval",   label: "🥚 אובלי" },
];

/* ─── Main component ─── */
export default function LayoutClient({ restaurants }: { restaurants: Restaurant[] }) {
  const [restaurantId, setRestaurantId] = useState(restaurants[0]?.id ?? "");
  const [tool, setTool]             = useState<ToolMode>("table");
  const [barSide, setBarSide]       = useState<BarSide>("top");
  const [tableShape, setTableShape] = useState<TableShape>("square");
  const [cellMap, setCellMap]       = useState<Map<string, Cell>>(new Map());
  const [cellPx, setCellPx]         = useState(BASE);

  // Table edit
  const [editTable, setEditTable]   = useState<{ r: number; c: number } | null>(null);
  const [tableForm, setTableForm]   = useState({ tableNumber: "", seats: "4", shape: "square" as TableShape, w: "2", h: "1" });
  // Bar edit
  const [editBar, setEditBar]       = useState<{ r: number; c: number } | null>(null);
  const [barForm, setBarForm]       = useState({ barLabel: "", barSeats: "2", barSide: "top" as BarSide });

  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [loading, setLoading]       = useState(false);
  const [copied, setCopied]         = useState(false);
  const [origin, setOrigin]         = useState("");

  const [dragSource, setDragSource] = useState<Cell | null>(null);
  const [dragOver, setDragOver]     = useState<{ r: number; c: number } | null>(null);
  const isDragging = useRef(false);
  const isPainting = useRef(false);
  const gridRef    = useRef<HTMLDivElement>(null);

  useEffect(() => { setOrigin(window.location.origin); }, []);
  useEffect(() => {
    if (restaurants[0]?.id) loadLayout(restaurants[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const recalc = () => {
      if (!gridRef.current) return;
      const w = gridRef.current.clientWidth - 16;
      setCellPx(Math.max(14, Math.floor((w - (COLS-1)) / COLS)));
    };
    recalc();
    const ro = new ResizeObserver(recalc);
    if (gridRef.current) ro.observe(gridRef.current);
    return () => ro.disconnect();
  }, []);

  const scale = cellPx / BASE;

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

  function handleRestaurantChange(rid: string) { setRestaurantId(rid); loadLayout(rid); }

  /* Helpers for multi-cell tables */
  function placeTable(map: Map<string, Cell>, r: number, c: number, cell: Omit<Cell, "r"|"c"|"type">) {
    const w = cell.tableW ?? 1; const h = cell.tableH ?? 1;
    map.set(cellKey(r, c), { r, c, type: "table", ...cell });
    for (let dr = 0; dr < h; dr++)
      for (let dc = 0; dc < w; dc++)
        if (dr > 0 || dc > 0)
          map.set(cellKey(r+dr, c+dc), { r: r+dr, c: c+dc, type: "table-part", anchorR: r, anchorC: c });
  }

  function removeTable(map: Map<string, Cell>, anchorR: number, anchorC: number) {
    const anchor = map.get(cellKey(anchorR, anchorC));
    if (!anchor) return;
    const w = anchor.tableW ?? 1; const h = anchor.tableH ?? 1;
    for (let dr = 0; dr < h; dr++)
      for (let dc = 0; dc < w; dc++)
        map.delete(cellKey(anchorR+dr, anchorC+dc));
  }

  function applyTool(r: number, c: number) {
    const key = cellKey(r, c);
    setCellMap(prev => {
      const next = new Map(prev);
      if (tool === "empty") {
        const cell = next.get(key);
        if (cell?.type === "table") removeTable(next, r, c);
        else if (cell?.type === "table-part") removeTable(next, cell.anchorR!, cell.anchorC!);
        else next.delete(key);
      } else if (tool === "wall") {
        next.set(key, { r, c, type: "wall" });
      } else if (tool === "bar") {
        const existing = next.get(key);
        if (existing?.type === "bar") {
          // open edit — do not modify map, we'll open dialog below
          return prev;
        }
        next.set(key, { r, c, type: "bar", barSide, barSeats: 2 });
      } else if (tool === "table") {
        const existing = next.get(key);
        if (existing?.type === "table" || existing?.type === "table-part") {
          // open edit — handled outside
          return prev;
        }
        const seats = 4;
        const { w, h } = getDefaultTableSize(seats);
        placeTable(next, r, c, { tableNumber: "", seats, tableShape, tableW: w, tableH: h });
        return next;
      }
      return next;
    });
  }

  function handleCellMouseDown(r: number, c: number) {
    const key = cellKey(r, c);
    const cell = cellMap.get(key);

    if (tool === "move") {
      if (cell?.type === "table") {
        isDragging.current = true;
        setDragSource(cell);
        setDragOver({ r, c });
      }
      return;
    }

    // Table click: open edit or place new
    if (tool === "table") {
      if (cell?.type === "table") {
        const anchor = cell;
        setTableForm({
          tableNumber: anchor.tableNumber ?? "",
          seats: String(anchor.seats ?? 4),
          shape: anchor.tableShape ?? "square",
          w: String(anchor.tableW ?? 1),
          h: String(anchor.tableH ?? 1),
        });
        setEditTable({ r, c });
        return;
      }
      if (cell?.type === "table-part") {
        const anchorCell = cellMap.get(cellKey(cell.anchorR!, cell.anchorC!));
        if (anchorCell) {
          setTableForm({
            tableNumber: anchorCell.tableNumber ?? "",
            seats: String(anchorCell.seats ?? 4),
            shape: anchorCell.tableShape ?? "square",
            w: String(anchorCell.tableW ?? 1),
            h: String(anchorCell.tableH ?? 1),
          });
          setEditTable({ r: anchorCell.r, c: anchorCell.c });
        }
        return;
      }
      // Place new table
      const seats = 4;
      const { w, h } = getDefaultTableSize(seats);
      setCellMap(prev => {
        const next = new Map(prev);
        placeTable(next, r, c, { tableNumber: "", seats, tableShape, tableW: w, tableH: h });
        return next;
      });
      setTableForm({ tableNumber: "", seats: String(seats), shape: tableShape, w: String(w), h: String(h) });
      setEditTable({ r, c });
      return;
    }

    // Bar click: open edit or start painting
    if (tool === "bar") {
      if (cell?.type === "bar") {
        setBarForm({
          barLabel: cell.barLabel ?? "",
          barSeats: String(cell.barSeats ?? 2),
          barSide: cell.barSide ?? "top",
        });
        setEditBar({ r, c });
        return;
      }
      isPainting.current = true;
      applyTool(r, c);
      return;
    }

    isPainting.current = true;
    applyTool(r, c);
  }

  const commitMove = useCallback(() => {
    if (dragSource && dragOver) {
      const srcR = dragSource.r; const srcC = dragSource.c;
      const dstR = dragOver.r;  const dstC = dragOver.c;
      if (srcR !== dstR || srcC !== dstC) {
        setCellMap(prev => {
          const next = new Map(prev);
          removeTable(next, srcR, srcC);
          placeTable(next, dstR, dstC, {
            tableNumber: dragSource.tableNumber, seats: dragSource.seats,
            tableShape: dragSource.tableShape,
            tableW: dragSource.tableW, tableH: dragSource.tableH,
          });
          return next;
        });
      }
    }
    setDragSource(null); setDragOver(null); isDragging.current = false;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragSource, dragOver]);

  function saveTableEdit() {
    if (!editTable) return;
    const seats = parseInt(tableForm.seats) || 4;
    const w = parseInt(tableForm.w) || getDefaultTableSize(seats).w;
    const h = parseInt(tableForm.h) || getDefaultTableSize(seats).h;
    setCellMap(prev => {
      const next = new Map(prev);
      removeTable(next, editTable.r, editTable.c);
      placeTable(next, editTable.r, editTable.c, {
        tableNumber: tableForm.tableNumber, seats,
        tableShape: tableForm.shape, tableW: w, tableH: h,
      });
      return next;
    });
    setEditTable(null);
  }

  function saveBarEdit() {
    if (!editBar) return;
    setCellMap(prev => {
      const next = new Map(prev);
      const existing = next.get(cellKey(editBar.r, editBar.c));
      next.set(cellKey(editBar.r, editBar.c), {
        ...existing!,
        barLabel: barForm.barLabel,
        barSeats: parseInt(barForm.barSeats) || 2,
        barSide: barForm.barSide,
      });
      return next;
    });
    setEditBar(null);
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

  // Precompute skip set for table-part cells
  const skipSet = new Set<string>();
  for (const [key, cell] of cellMap)
    if (cell.type === "table-part") skipSet.add(key);

  const tableCount = Array.from(cellMap.values()).filter(c => c.type === "table").length;
  const totalSeats = Array.from(cellMap.values()).filter(c => c.type === "table").reduce((s, c) => s + (c.seats ?? 4), 0);

  return (
    <div className="p-4 md:p-6"
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
                className={`px-3 py-2 text-sm font-medium transition-colors ${tool===t?"text-white":"text-gray-600 hover:bg-gray-50"}`}
                style={tool===t?{background:"linear-gradient(135deg,#8B6914,#C9A84C)"}:undefined}>
                {label}
              </button>
            ))}
          </div>
          <div className="flex gap-2 mr-auto">
            <button onClick={clearAll} className="px-3 py-2 text-sm rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-red-50 hover:text-red-600">נקה הכל</button>
            <button onClick={saveLayout} disabled={saving||!restaurantId} className="px-4 py-2 text-sm font-semibold rounded-xl text-white disabled:opacity-50"
              style={{background:"linear-gradient(135deg,#8B6914,#C9A84C)"}}>
              {saving?"שומר...":saved?"✓ נשמר!":"שמור פריסה"}
            </button>
          </div>
        </div>

        {tool==="table" && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-gray-600 font-medium">צורת שולחן:</span>
            {TABLE_SHAPES.map(({ shape, label }) => (
              <button key={shape} onClick={() => setTableShape(shape)}
                className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition-colors ${tableShape===shape?"text-white border-amber-500":"bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}
                style={tableShape===shape?{background:"linear-gradient(135deg,#8B6914,#C9A84C)"}:undefined}>
                {label}
              </button>
            ))}
          </div>
        )}

        {tool==="bar" && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-gray-600 font-medium">צד ישיבה:</span>
            {BAR_SIDES.map(({ side, label }) => (
              <button key={side} onClick={() => setBarSide(side)}
                className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition-colors ${barSide===side?"text-white border-amber-500":"bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}
                style={barSide===side?{background:"linear-gradient(135deg,#78350f,#92400e)"}:undefined}>
                {label}
              </button>
            ))}
          </div>
        )}

        {tool==="move" && <p className="text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-1.5 w-fit">✋ לחץ וגרור שולחן למיקום חדש</p>}
      </div>

      <div className="flex gap-3 mb-3 text-xs text-gray-500">
        <span>{tableCount} שולחנות · {totalSeats} מושבים</span>
        <span className="text-gray-300">|</span>
        <span className="text-gray-400">{COLS}×{ROWS} · {cellPx}px/תא</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 text-gray-400">טוען...</div>
      ) : (
        <div ref={gridRef} className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-auto p-2">
          <div className="grid select-none"
            style={{ gridTemplateColumns: `repeat(${COLS}, ${cellPx}px)`, gap: 1, width: "fit-content" }}
            onMouseLeave={() => { if (isDragging.current) commitMove(); isPainting.current = false; }}>
            {(() => {
              const els = [];
              for (let r = 0; r < ROWS; r++) {
                for (let c = 0; c < COLS; c++) {
                  if (skipSet.has(cellKey(r, c))) continue;

                  const cell    = cellMap.get(cellKey(r, c));
                  const isTable = cell?.type === "table";
                  const isWall  = cell?.type === "wall";
                  const isBar   = cell?.type === "bar";
                  const w       = isTable ? (cell!.tableW ?? 1) : 1;
                  const h       = isTable ? (cell!.tableH ?? 1) : 1;

                  const isSrc = dragSource?.r===r && dragSource?.c===c;
                  const isDst = !!dragSource && dragOver?.r===r && dragOver?.c===c;

                  const pxW = cellPx * w + (w-1);
                  const pxH = cellPx * h + (h-1);

                  els.push(
                    <div key={`${r}-${c}`}
                      style={{
                        gridColumn: w>1 ? `span ${w}` : undefined,
                        gridRow:    h>1 ? `span ${h}` : undefined,
                        width: pxW, height: pxH,
                        position: "relative",
                        background: isTable||isWall||isBar ? "transparent" : "#f8f9fa",
                        border: isWall||isBar ? "none" : "1px solid #e9ecef",
                        cursor: tool==="move" ? (isTable?"grab":"default") : "crosshair",
                        outline: isDst ? "2px solid #3b82f6" : undefined,
                        outlineOffset: "-1px",
                      }}
                      onMouseDown={() => handleCellMouseDown(r, c)}
                      onMouseUp={() => { if (isDragging.current) commitMove(); isPainting.current = false; }}
                      onMouseEnter={() => {
                        if (isDragging.current) setDragOver({ r, c });
                        else if (isPainting.current && tool!=="table" && tool!=="bar") applyTool(r, c);
                      }}>

                      {(isWall||isBar||isTable||isDst) && (
                        <div style={{
                          position:"absolute", left:0, top:0,
                          width: BASE*w, height: BASE*h,
                          transform:`scale(${scale})`, transformOrigin:"top left",
                          pointerEvents:"none",
                        }}>
                          {isWall  && <WallCellVisual  r={r} c={c} cellMap={cellMap} />}
                          {isBar   && <BarCellVisual   r={r} c={c} cell={cell!} cellMap={cellMap} />}
                          {isTable && <TableCellVisual cell={cell!} ghost={isSrc&&isDragging.current} w={w} h={h} />}
                          {isDst && dragSource && !isTable && <TableCellVisual cell={{...dragSource,r,c}} ghost w={dragSource.tableW??1} h={dragSource.tableH??1} />}
                        </div>
                      )}
                    </div>
                  );
                }
              }
              return els;
            })()}
          </div>
        </div>
      )}

      {/* ── Table edit dialog ── */}
      {editTable && (() => {
        const tableUrl = tableForm.tableNumber && restaurantId && origin
          ? `${origin}/menu/${restaurantId}?table=${encodeURIComponent(tableForm.tableNumber)}`
          : null;
        return (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setEditTable(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-gray-900 mb-4">✏️ הגדרת שולחן</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">מספר / שם שולחן</label>
                  <input type="text" value={tableForm.tableNumber}
                    onChange={e => setTableForm(f=>({...f, tableNumber:e.target.value}))}
                    placeholder="1, A3, בר..." autoFocus
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">צורת שולחן</label>
                  <div className="flex gap-2">
                    {TABLE_SHAPES.map(({shape, label}) => (
                      <button key={shape} type="button" onClick={() => setTableForm(f=>({...f, shape}))}
                        className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors ${tableForm.shape===shape?"border-amber-400 text-white":"border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                        style={tableForm.shape===shape?{background:"linear-gradient(135deg,#8B6914,#C9A84C)"}:undefined}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">מספר כסאות</label>
                  <div className="flex gap-2">
                    {[2,4,6,8,10].map(n => {
                      const def = getDefaultTableSize(n);
                      return (
                        <button key={n} type="button"
                          onClick={() => setTableForm(f=>({...f, seats:String(n), w:String(def.w), h:String(def.h)}))}
                          className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors ${tableForm.seats===String(n)?"border-amber-400 text-white":"border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                          style={tableForm.seats===String(n)?{background:"linear-gradient(135deg,#8B6914,#C9A84C)"}:undefined}>
                          {n}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">גודל על המפה (תאים)</label>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-500">רוחב</span>
                      {[1,2,3,4].map(n => (
                        <button key={n} type="button" onClick={() => setTableForm(f=>({...f, w:String(n)}))}
                          className={`w-8 h-8 rounded-lg text-sm font-bold border transition-colors ${tableForm.w===String(n)?"text-white border-amber-400":"bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}
                          style={tableForm.w===String(n)?{background:"linear-gradient(135deg,#8B6914,#C9A84C)"}:undefined}>
                          {n}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-500">גובה</span>
                      {[1,2,3].map(n => (
                        <button key={n} type="button" onClick={() => setTableForm(f=>({...f, h:String(n)}))}
                          className={`w-8 h-8 rounded-lg text-sm font-bold border transition-colors ${tableForm.h===String(n)?"text-white border-amber-400":"bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}
                          style={tableForm.h===String(n)?{background:"linear-gradient(135deg,#8B6914,#C9A84C)"}:undefined}>
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                {tableUrl && (
                  <div className="border border-gray-100 rounded-xl p-4 bg-gray-50 space-y-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">QR לשולחן</p>
                    <div className="flex justify-center"><div className="p-2 bg-white rounded-xl border border-gray-200 inline-block"><QRCodeSVG value={tableUrl} size={140} /></div></div>
                    <div className="flex items-center gap-2">
                      <input readOnly value={tableUrl} className="flex-1 text-xs text-gray-600 bg-white border border-gray-200 rounded-lg px-2 py-1.5 truncate" onClick={e=>(e.target as HTMLInputElement).select()} />
                      <button type="button" onClick={() => {navigator.clipboard.writeText(tableUrl);setCopied(true);setTimeout(()=>setCopied(false),2000);}}
                        className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                        style={{background:copied?"#22c55e":"linear-gradient(135deg,#8B6914,#C9A84C)"}}>
                        {copied?"✓":"העתק"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={saveTableEdit} className="flex-1 py-2.5 rounded-xl text-white font-semibold text-sm" style={{background:"linear-gradient(135deg,#8B6914,#C9A84C)"}}>שמור</button>
                <button onClick={() => { setCellMap(prev=>{const next=new Map(prev);removeTable(next,editTable.r,editTable.c);return next;}); setEditTable(null); }}
                  className="px-4 py-2.5 rounded-xl text-red-600 bg-red-50 hover:bg-red-100 text-sm">מחק</button>
                <button onClick={() => setEditTable(null)} className="px-4 py-2.5 rounded-xl bg-gray-100 text-gray-600 text-sm">ביטול</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Bar edit dialog ── */}
      {editBar && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setEditBar(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-4">🍺 הגדרת בר</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">שם / מספר הבר</label>
                <input type="text" value={barForm.barLabel}
                  onChange={e => setBarForm(f=>({...f, barLabel:e.target.value}))}
                  placeholder="בר, סושי בר..." autoFocus
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">כמות כסאות בר לתא</label>
                <div className="flex gap-2">
                  {[1,2,3,4].map(n => (
                    <button key={n} type="button" onClick={() => setBarForm(f=>({...f, barSeats:String(n)}))}
                      className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors ${barForm.barSeats===String(n)?"border-amber-400 text-white":"border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                      style={barForm.barSeats===String(n)?{background:"linear-gradient(135deg,#78350f,#92400e)"}:undefined}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">צד ישיבה</label>
                <div className="flex gap-2 flex-wrap">
                  {BAR_SIDES.map(({side, label}) => (
                    <button key={side} type="button" onClick={() => setBarForm(f=>({...f, barSide:side}))}
                      className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors ${barForm.barSide===side?"border-amber-400 text-white":"border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                      style={barForm.barSide===side?{background:"linear-gradient(135deg,#78350f,#92400e)"}:undefined}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={saveBarEdit} className="flex-1 py-2.5 rounded-xl text-white font-semibold text-sm" style={{background:"linear-gradient(135deg,#78350f,#92400e)"}}>שמור</button>
              <button onClick={() => { setCellMap(prev=>{const next=new Map(prev);next.delete(cellKey(editBar.r,editBar.c));return next;}); setEditBar(null); }}
                className="px-4 py-2.5 rounded-xl text-red-600 bg-red-50 hover:bg-red-100 text-sm">מחק</button>
              <button onClick={() => setEditBar(null)} className="px-4 py-2.5 rounded-xl bg-gray-100 text-gray-600 text-sm">ביטול</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
