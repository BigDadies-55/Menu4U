"use client";

import { useState, useRef, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";

type CellType  = "empty" | "wall" | "table" | "bar";
type BarSide   = "top" | "bottom" | "left" | "right";
type TableShape = "square" | "round" | "oval";

type Cell = {
  r: number;
  c: number;
  type: CellType;
  tableNumber?: string;
  seats?: number;
  barSide?: BarSide;
  tableShape?: TableShape;
};

type Layout = { rows: number; cols: number; cells: Cell[] };
type Restaurant = { id: string; name: string };

const ROWS = 12;
const COLS = 20;
const CELL = 44;

function cellKey(r: number, c: number) { return `${r}:${c}`; }
function layoutToMap(l: Layout): Map<string, Cell> {
  const m = new Map<string, Cell>();
  for (const c of l.cells) m.set(cellKey(c.r, c.c), c);
  return m;
}
function mapToLayout(m: Map<string, Cell>): Layout {
  return { rows: ROWS, cols: COLS, cells: Array.from(m.values()) };
}

function connRadius(hasN: boolean, hasS: boolean, hasE: boolean, hasW: boolean) {
  return `${!hasN && !hasW ? 3 : 0}px ${!hasN && !hasE ? 3 : 0}px ${!hasS && !hasE ? 3 : 0}px ${!hasS && !hasW ? 3 : 0}px`;
}

/* ── Chair helpers ── */
function getChairDist(seats: number) {
  if (seats <= 2) return { top: 1, bottom: 1, left: 0, right: 0 };
  if (seats <= 4) return { top: 1, bottom: 1, left: 1, right: 1 };
  if (seats <= 6) return { top: 2, bottom: 2, left: 1, right: 1 };
  if (seats <= 8) return { top: 2, bottom: 2, left: 2, right: 2 };
  return           { top: 3, bottom: 3, left: 2, right: 2 };
}
function HChair() {
  return <div style={{ width: 8, height: 5, background: "#92400e", borderRadius: 2, flexShrink: 0 }} />;
}
function VChair() {
  return <div style={{ width: 5, height: 8, background: "#92400e", borderRadius: 2, flexShrink: 0 }} />;
}
function Stool() {
  return <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#fbbf24", border: "1.5px solid #92400e", flexShrink: 0 }} />;
}

/* ── Table visuals ── */
function SquareTableVisual({ cell }: { cell: Cell }) {
  const d = getChairDist(cell.seats ?? 4);
  return (
    <div className="absolute inset-0 pointer-events-none">
      {d.top > 0 && (
        <div className="absolute left-0 right-0 flex justify-center gap-0.5" style={{ top: 2 }}>
          {Array.from({ length: d.top }).map((_, i) => <HChair key={i} />)}
        </div>
      )}
      {d.bottom > 0 && (
        <div className="absolute left-0 right-0 flex justify-center gap-0.5" style={{ bottom: 2 }}>
          {Array.from({ length: d.bottom }).map((_, i) => <HChair key={i} />)}
        </div>
      )}
      {d.left > 0 && (
        <div className="absolute top-0 bottom-0 flex flex-col justify-center gap-0.5" style={{ left: 2 }}>
          {Array.from({ length: d.left }).map((_, i) => <VChair key={i} />)}
        </div>
      )}
      {d.right > 0 && (
        <div className="absolute top-0 bottom-0 flex flex-col justify-center gap-0.5" style={{ right: 2 }}>
          {Array.from({ length: d.right }).map((_, i) => <VChair key={i} />)}
        </div>
      )}
      <div className="absolute rounded flex flex-col items-center justify-center"
        style={{ inset: 10, background: "linear-gradient(135deg,#fef3c7,#fde68a)", border: "2px solid #d97706", boxShadow: "0 1px 3px rgba(0,0,0,0.18)" }}>
        <span className="font-black text-amber-900 leading-none" style={{ fontSize: 9 }}>{cell.tableNumber || "?"}</span>
      </div>
    </div>
  );
}

function RoundTableVisual({ cell }: { cell: Cell }) {
  const seats  = cell.seats ?? 4;
  const half   = CELL / 2;
  const tableR = 13;
  const chairR = 17; // distance from center to chair center

  return (
    <div className="absolute inset-0 pointer-events-none">
      {Array.from({ length: seats }).map((_, i) => {
        const angle = (i * 2 * Math.PI / seats) - Math.PI / 2;
        const x = half + chairR * Math.cos(angle);
        const y = half + chairR * Math.sin(angle);
        return (
          <div key={i} className="absolute rounded-full"
            style={{ width: 7, height: 7, background: "#92400e", left: x - 3.5, top: y - 3.5 }} />
        );
      })}
      <div className="absolute rounded-full flex items-center justify-center"
        style={{
          left: half - tableR, top: half - tableR,
          width: tableR * 2, height: tableR * 2,
          background: "linear-gradient(135deg,#fef3c7,#fde68a)",
          border: "2px solid #d97706",
          boxShadow: "0 1px 3px rgba(0,0,0,0.18)",
        }}>
        <span className="font-black text-amber-900" style={{ fontSize: 8 }}>{cell.tableNumber || "?"}</span>
      </div>
    </div>
  );
}

function OvalTableVisual({ cell }: { cell: Cell }) {
  const seats = cell.seats ?? 4;
  const half  = CELL / 2;
  const rx    = 18; // horizontal radius to chair
  const ry    = 12; // vertical radius to chair
  const trx   = 14; // table horizontal radius
  const try_  = 9;  // table vertical radius

  return (
    <div className="absolute inset-0 pointer-events-none">
      {Array.from({ length: seats }).map((_, i) => {
        const angle = (i * 2 * Math.PI / seats) - Math.PI / 2;
        const x = half + rx * Math.cos(angle);
        const y = half + ry * Math.sin(angle);
        return (
          <div key={i} className="absolute rounded-full"
            style={{ width: 7, height: 7, background: "#92400e", left: x - 3.5, top: y - 3.5 }} />
        );
      })}
      <div className="absolute flex items-center justify-center"
        style={{
          left: half - trx, top: half - try_,
          width: trx * 2, height: try_ * 2,
          borderRadius: "50%",
          background: "linear-gradient(135deg,#fef3c7,#fde68a)",
          border: "2px solid #d97706",
          boxShadow: "0 1px 3px rgba(0,0,0,0.18)",
        }}>
        <span className="font-black text-amber-900" style={{ fontSize: 8 }}>{cell.tableNumber || "?"}</span>
      </div>
    </div>
  );
}

function TableCellVisual({ cell }: { cell: Cell }) {
  const shape = cell.tableShape ?? "square";
  if (shape === "round") return <RoundTableVisual cell={cell} />;
  if (shape === "oval")  return <OvalTableVisual  cell={cell} />;
  return <SquareTableVisual cell={cell} />;
}

/* ── Wall / Bar visuals ── */
function WallCellVisual({ r, c, cellMap }: { r: number; c: number; cellMap: Map<string, Cell> }) {
  const hasN = cellMap.get(cellKey(r - 1, c))?.type === "wall";
  const hasS = cellMap.get(cellKey(r + 1, c))?.type === "wall";
  const hasE = cellMap.get(cellKey(r, c + 1))?.type === "wall";
  const hasW = cellMap.get(cellKey(r, c - 1))?.type === "wall";
  return (
    <div className="absolute inset-0" style={{
      borderRadius: connRadius(hasN, hasS, hasE, hasW),
      background: "#374151",
      backgroundImage: [
        "repeating-linear-gradient(0deg,rgba(255,255,255,0.06) 0,rgba(255,255,255,0.06) 1px,transparent 1px,transparent 8px)",
        "repeating-linear-gradient(90deg,rgba(255,255,255,0.06) 0,rgba(255,255,255,0.06) 1px,transparent 1px,transparent 14px)",
      ].join(","),
    }} />
  );
}

function BarCellVisual({ r, c, cell, cellMap }: { r: number; c: number; cell: Cell; cellMap: Map<string, Cell> }) {
  const side = cell.barSide ?? "top";
  const hasN = cellMap.get(cellKey(r - 1, c))?.type === "bar";
  const hasS = cellMap.get(cellKey(r + 1, c))?.type === "bar";
  const hasE = cellMap.get(cellKey(r, c + 1))?.type === "bar";
  const hasW = cellMap.get(cellKey(r, c - 1))?.type === "bar";
  return (
    <div className="absolute inset-0 pointer-events-none">
      <div className="absolute inset-0" style={{
        borderRadius: connRadius(hasN, hasS, hasE, hasW),
        background: "linear-gradient(135deg,#78350f,#92400e)",
        backgroundImage: "repeating-linear-gradient(90deg,rgba(255,255,255,0.05) 0,rgba(255,255,255,0.05) 1px,transparent 1px,transparent 8px)",
      }} />
      {side === "top"    && <div className="absolute left-0 right-0 flex justify-around px-2" style={{ top: 3 }}><Stool /><Stool /></div>}
      {side === "bottom" && <div className="absolute left-0 right-0 flex justify-around px-2" style={{ bottom: 3 }}><Stool /><Stool /></div>}
      {side === "left"   && <div className="absolute top-0 bottom-0 flex flex-col justify-around py-2" style={{ left: 3 }}><Stool /><Stool /></div>}
      {side === "right"  && <div className="absolute top-0 bottom-0 flex flex-col justify-around py-2" style={{ right: 3 }}><Stool /><Stool /></div>}
    </div>
  );
}

/* ── Main component ── */
const BAR_SIDE_LABELS: { side: BarSide; label: string; title: string }[] = [
  { side: "top",    label: "↑", title: "ישיבה מלמעלה" },
  { side: "bottom", label: "↓", title: "ישיבה מלמטה" },
  { side: "left",   label: "←", title: "ישיבה משמאל" },
  { side: "right",  label: "→", title: "ישיבה מימין" },
];

const TABLE_SHAPES: { shape: TableShape; label: string; title: string }[] = [
  { shape: "square", label: "⬜", title: "מרובע" },
  { shape: "round",  label: "⭕", title: "עגול" },
  { shape: "oval",   label: "🥚", title: "אובלי" },
];

export default function LayoutClient({ restaurants }: { restaurants: Restaurant[] }) {
  const [restaurantId, setRestaurantId] = useState(restaurants[0]?.id ?? "");
  const [tool, setTool]               = useState<CellType>("table");
  const [barSide, setBarSide]         = useState<BarSide>("top");
  const [tableShape, setTableShape]   = useState<TableShape>("square");
  const [cellMap, setCellMap]         = useState<Map<string, Cell>>(new Map());
  const [editCell, setEditCell]       = useState<{ r: number; c: number } | null>(null);
  const [editForm, setEditForm]       = useState({ tableNumber: "", seats: "4", shape: "square" as TableShape });
  const [saving, setSaving]           = useState(false);
  const [saved, setSaved]             = useState(false);
  const [loading, setLoading]         = useState(false);
  const [copied, setCopied]           = useState(false);
  const [origin, setOrigin]           = useState("");
  const isPainting = useRef(false);

  useEffect(() => { setOrigin(window.location.origin); }, []);

  // Load on initial mount
  useEffect(() => {
    if (restaurants[0]?.id) loadLayout(restaurants[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadLayout(rid: string) {
    setLoading(true);
    const res = await fetch(`/api/admin/restaurants/${rid}/layout`);
    if (res.ok) {
      const data = await res.json();
      if (data.tableLayoutJson) {
        try { setCellMap(layoutToMap(JSON.parse(data.tableLayoutJson))); }
        catch { setCellMap(new Map()); }
      } else { setCellMap(new Map()); }
    }
    setLoading(false);
  }

  function handleRestaurantChange(rid: string) {
    setRestaurantId(rid);
    loadLayout(rid);
  }

  function applyTool(r: number, c: number) {
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
          setEditForm({
            tableNumber: existing.tableNumber ?? "",
            seats: String(existing.seats ?? 4),
            shape: existing.tableShape ?? "square",
          });
        } else {
          next.set(key, { r, c, type: "table", tableNumber: "", seats: 4, tableShape });
          setEditCell({ r, c });
          setEditForm({ tableNumber: "", seats: "4", shape: tableShape });
        }
      }
      return next;
    });
  }

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
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const tableCount = Array.from(cellMap.values()).filter(c => c.type === "table").length;
  const totalSeats = Array.from(cellMap.values()).filter(c => c.type === "table").reduce((s, c) => s + (c.seats ?? 4), 0);

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">🗺 פריסת שולחנות</h1>
        <p className="text-gray-500 mt-1 text-sm">תכנן את מפת המסעדה — שולחנות, בר, קירות ומעברים</p>
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-3 mb-5">
        <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
          {restaurants.length > 1 && (
            <select value={restaurantId} onChange={e => handleRestaurantChange(e.target.value)}
              className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400">
              {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          )}

          <div className="flex rounded-xl overflow-hidden border border-gray-200 bg-white">
            {([
              { t: "table" as CellType, label: "🪑 שולחן" },
              { t: "bar"   as CellType, label: "🍺 בר" },
              { t: "wall"  as CellType, label: "🧱 קיר" },
              { t: "empty" as CellType, label: "🗑 מחק" },
            ]).map(({ t, label }) => (
              <button key={t} onClick={() => setTool(t)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${tool === t ? "text-white" : "text-gray-600 hover:bg-gray-50"}`}
                style={tool === t ? { background: "linear-gradient(135deg,#8B6914,#C9A84C)" } : undefined}>
                {label}
              </button>
            ))}
          </div>

          <div className="flex gap-2 mr-auto">
            <button onClick={clearAll}
              className="px-4 py-2 text-sm rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors">
              נקה הכל
            </button>
            <button onClick={saveLayout} disabled={saving || !restaurantId}
              className="px-5 py-2 text-sm font-semibold rounded-xl text-white disabled:opacity-50"
              style={{ background: "linear-gradient(135deg,#8B6914,#C9A84C)" }}>
              {saving ? "שומר..." : saved ? "✓ נשמר!" : "שמור פריסה"}
            </button>
          </div>
        </div>

        {/* Table shape sub-toolbar */}
        {tool === "table" && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-gray-600 font-medium">צורת שולחן:</span>
            {TABLE_SHAPES.map(({ shape, label, title }) => (
              <button key={shape} title={title} onClick={() => setTableShape(shape)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium border transition-colors ${
                  tableShape === shape ? "text-white border-amber-500" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                }`}
                style={tableShape === shape ? { background: "linear-gradient(135deg,#8B6914,#C9A84C)" } : undefined}>
                {label} {title}
              </button>
            ))}
          </div>
        )}

        {/* Bar side sub-toolbar */}
        {tool === "bar" && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-gray-600 font-medium">כיסאות בר:</span>
            {BAR_SIDE_LABELS.map(({ side, label, title }) => (
              <button key={side} title={title} onClick={() => setBarSide(side)}
                className={`w-9 h-9 rounded-xl text-base font-bold border transition-colors ${
                  barSide === side ? "text-white border-amber-500" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                }`}
                style={barSide === side ? { background: "linear-gradient(135deg,#78350f,#92400e)" } : undefined}>
                {label}
              </button>
            ))}
            <span className="text-xs text-gray-400">{BAR_SIDE_LABELS.find(s => s.side === barSide)?.title}</span>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="flex gap-4 mb-4 text-sm text-gray-600 flex-wrap">
        <span className="flex items-center gap-1.5">
          <span className="inline-block rounded" style={{ width: 16, height: 16, background: "linear-gradient(135deg,#fef3c7,#fde68a)", border: "2px solid #d97706" }} />
          {tableCount} שולחנות · {totalSeats} מושבים
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block" style={{ width: 16, height: 16, background: "linear-gradient(135deg,#78350f,#92400e)", borderRadius: 3 }} />
          בר
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block" style={{ width: 16, height: 16, background: "#374151", borderRadius: 2 }} />
          קיר
        </span>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64 text-gray-400">טוען...</div>
      ) : (
        <div className="overflow-auto rounded-2xl border border-gray-200 bg-white shadow-sm p-3">
          <div className="grid select-none"
            style={{ gridTemplateColumns: `repeat(${COLS}, ${CELL}px)`, gap: 1, width: "fit-content" }}
            onMouseLeave={() => { isPainting.current = false; }}>
            {Array.from({ length: ROWS }, (_, r) =>
              Array.from({ length: COLS }, (_, c) => {
                const cell = cellMap.get(cellKey(r, c));
                const isTable = cell?.type === "table";
                const isWall  = cell?.type === "wall";
                const isBar   = cell?.type === "bar";
                return (
                  <div key={`${r}-${c}`}
                    title={isTable ? `שולחן ${cell?.tableNumber ?? "?"} · ${cell?.seats ?? 4} כסאות` : undefined}
                    className="relative cursor-pointer transition-colors"
                    style={{
                      width: CELL, height: CELL,
                      background: isTable || isWall || isBar ? "transparent" : "#f9fafb",
                      border: isWall || isBar ? "none" : "1px solid #e5e7eb",
                    }}
                    onMouseDown={() => { isPainting.current = true; applyTool(r, c); }}
                    onMouseUp={() => { isPainting.current = false; }}
                    onMouseEnter={e => {
                      if (isPainting.current && tool !== "table") applyTool(r, c);
                      if (!isTable && !isWall && !isBar) (e.currentTarget as HTMLDivElement).style.background = "#fef9ec";
                    }}
                    onMouseLeave={e => {
                      if (!isTable && !isWall && !isBar) (e.currentTarget as HTMLDivElement).style.background = "#f9fafb";
                    }}>
                    {isWall  && <WallCellVisual  r={r} c={c} cellMap={cellMap} />}
                    {isBar   && <BarCellVisual   r={r} c={c} cell={cell!} cellMap={cellMap} />}
                    {isTable && <TableCellVisual cell={cell!} />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="mt-4 flex gap-5 text-xs text-gray-500 flex-wrap">
        {[
          { bg: "linear-gradient(135deg,#fef3c7,#fde68a)", border: "2px solid #d97706", radius: 4, label: "שולחן (לחץ לעריכה)" },
          { bg: "linear-gradient(135deg,#78350f,#92400e)", border: "none", radius: 3, label: "בר" },
          { bg: "#374151", border: "none", radius: 2, label: "קיר" },
          { bg: "#f9fafb", border: "1px solid #e5e7eb", radius: 2, label: "ריק" },
        ].map(({ bg, border, radius, label }) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className="inline-block" style={{ width: 14, height: 14, background: bg, border, borderRadius: radius }} />
            {label}
          </span>
        ))}
      </div>

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
                      <button key={shape} type="button"
                        onClick={() => setEditForm(f => ({ ...f, shape }))}
                        className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                          editForm.shape === shape ? "border-amber-400 text-white" : "border-gray-200 text-gray-600 hover:bg-gray-50"
                        }`}
                        style={editForm.shape === shape ? { background: "linear-gradient(135deg,#8B6914,#C9A84C)" } : undefined}>
                        {label} {title}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">מספר כסאות</label>
                  <div className="flex gap-2">
                    {[2, 4, 6, 8, 10].map(n => (
                      <button key={n} type="button"
                        onClick={() => setEditForm(f => ({ ...f, seats: String(n) }))}
                        className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                          editForm.seats === String(n) ? "border-amber-400 text-white" : "border-gray-200 text-gray-600 hover:bg-gray-50"
                        }`}
                        style={editForm.seats === String(n) ? { background: "linear-gradient(135deg,#8B6914,#C9A84C)" } : undefined}>
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
