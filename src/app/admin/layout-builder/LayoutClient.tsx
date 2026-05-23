"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";

type CellType = "empty" | "wall" | "table";

type Cell = {
  r: number;
  c: number;
  type: CellType;
  tableNumber?: string;
  seats?: number;
};

type Layout = {
  rows: number;
  cols: number;
  cells: Cell[];
};

type Restaurant = { id: string; name: string };

const ROWS = 12;
const COLS = 20;
const CELL = 44;
const EMPTY_LAYOUT: Layout = { rows: ROWS, cols: COLS, cells: [] };

function cellKey(r: number, c: number) { return `${r}:${c}`; }

function layoutToMap(layout: Layout): Map<string, Cell> {
  const map = new Map<string, Cell>();
  for (const cell of layout.cells) map.set(cellKey(cell.r, cell.c), cell);
  return map;
}

function mapToLayout(map: Map<string, Cell>, rows: number, cols: number): Layout {
  return { rows, cols, cells: Array.from(map.values()) };
}

function getChairDist(seats: number) {
  if (seats <= 2)  return { top: 1, bottom: 1, left: 0, right: 0 };
  if (seats <= 4)  return { top: 1, bottom: 1, left: 1, right: 1 };
  if (seats <= 6)  return { top: 2, bottom: 2, left: 1, right: 1 };
  if (seats <= 8)  return { top: 2, bottom: 2, left: 2, right: 2 };
  return           { top: 3, bottom: 3, left: 2, right: 2 };
}

function HChair() {
  return <div style={{ width: 8, height: 5, background: "#92400e", borderRadius: 2, flexShrink: 0 }} />;
}

function VChair() {
  return <div style={{ width: 5, height: 8, background: "#92400e", borderRadius: 2, flexShrink: 0 }} />;
}

function TableCellVisual({ cell }: { cell: Cell }) {
  const seats = cell.seats ?? 4;
  const dist = getChairDist(seats);
  const INSET = 10;

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Top chairs */}
      {dist.top > 0 && (
        <div className="absolute left-0 right-0 flex justify-center gap-0.5" style={{ top: 2 }}>
          {Array.from({ length: dist.top }).map((_, i) => <HChair key={i} />)}
        </div>
      )}
      {/* Bottom chairs */}
      {dist.bottom > 0 && (
        <div className="absolute left-0 right-0 flex justify-center gap-0.5" style={{ bottom: 2 }}>
          {Array.from({ length: dist.bottom }).map((_, i) => <HChair key={i} />)}
        </div>
      )}
      {/* Left chairs */}
      {dist.left > 0 && (
        <div className="absolute top-0 bottom-0 flex flex-col justify-center gap-0.5" style={{ left: 2 }}>
          {Array.from({ length: dist.left }).map((_, i) => <VChair key={i} />)}
        </div>
      )}
      {/* Right chairs */}
      {dist.right > 0 && (
        <div className="absolute top-0 bottom-0 flex flex-col justify-center gap-0.5" style={{ right: 2 }}>
          {Array.from({ length: dist.right }).map((_, i) => <VChair key={i} />)}
        </div>
      )}
      {/* Table surface */}
      <div
        className="absolute rounded flex flex-col items-center justify-center"
        style={{
          inset: INSET,
          background: "linear-gradient(135deg,#fef3c7,#fde68a)",
          border: "2px solid #d97706",
          boxShadow: "0 1px 3px rgba(0,0,0,0.18)",
        }}
      >
        <span className="font-black text-amber-900 leading-none" style={{ fontSize: 9 }}>
          {cell.tableNumber || "?"}
        </span>
      </div>
    </div>
  );
}

function WallCellVisual({ r, c, cellMap }: { r: number; c: number; cellMap: Map<string, Cell> }) {
  const hasN = cellMap.get(cellKey(r - 1, c))?.type === "wall";
  const hasS = cellMap.get(cellKey(r + 1, c))?.type === "wall";
  const hasE = cellMap.get(cellKey(r, c + 1))?.type === "wall";
  const hasW = cellMap.get(cellKey(r, c - 1))?.type === "wall";

  // Border-radius: round corners that don't connect to another wall
  const tl = !hasN && !hasW ? 3 : 0;
  const tr = !hasN && !hasE ? 3 : 0;
  const br = !hasS && !hasE ? 3 : 0;
  const bl = !hasS && !hasW ? 3 : 0;

  return (
    <div
      className="absolute inset-0"
      style={{
        borderRadius: `${tl}px ${tr}px ${br}px ${bl}px`,
        background: "#374151",
        backgroundImage: [
          "repeating-linear-gradient(0deg,rgba(255,255,255,0.06) 0,rgba(255,255,255,0.06) 1px,transparent 1px,transparent 8px)",
          "repeating-linear-gradient(90deg,rgba(255,255,255,0.06) 0,rgba(255,255,255,0.06) 1px,transparent 1px,transparent 14px)",
        ].join(","),
      }}
    />
  );
}

export default function LayoutClient({ restaurants }: { restaurants: Restaurant[] }) {
  const [restaurantId, setRestaurantId] = useState(restaurants[0]?.id ?? "");
  const [tool, setTool] = useState<CellType>("table");
  const [cellMap, setCellMap] = useState<Map<string, Cell>>(new Map());
  const [editCell, setEditCell] = useState<{ r: number; c: number } | null>(null);
  const [editForm, setEditForm] = useState({ tableNumber: "", seats: "4" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");
  const isPainting = useRef(false);

  useEffect(() => { setOrigin(window.location.origin); }, []);

  async function loadLayout(rid: string) {
    setLoading(true);
    const res = await fetch(`/api/admin/restaurants/${rid}/layout`);
    if (res.ok) {
      const data = await res.json();
      if (data.tableLayoutJson) {
        try {
          setCellMap(layoutToMap(JSON.parse(data.tableLayoutJson)));
        } catch { setCellMap(new Map()); }
      } else {
        setCellMap(new Map());
      }
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
      } else {
        const existing = prev.get(key);
        if (existing?.type === "table") {
          setEditCell({ r, c });
          setEditForm({ tableNumber: existing.tableNumber ?? "", seats: String(existing.seats ?? 4) });
        } else {
          next.set(key, { r, c, type: "table", tableNumber: "", seats: 4 });
          setEditCell({ r, c });
          setEditForm({ tableNumber: "", seats: "4" });
        }
      }
      return next;
    });
  }

  function saveEditCell() {
    if (!editCell) return;
    const key = cellKey(editCell.r, editCell.c);
    setCellMap(prev => {
      const next = new Map(prev);
      next.set(key, {
        r: editCell.r,
        c: editCell.c,
        type: "table",
        tableNumber: editForm.tableNumber,
        seats: parseInt(editForm.seats) || 4,
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
      body: JSON.stringify({ tableLayoutJson: JSON.stringify(mapToLayout(cellMap, ROWS, COLS)) }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const tableCount = Array.from(cellMap.values()).filter(c => c.type === "table").length;
  const totalSeats = Array.from(cellMap.values())
    .filter(c => c.type === "table")
    .reduce((s, c) => s + (c.seats ?? 4), 0);

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">🗺 פריסת שולחנות</h1>
        <p className="text-gray-500 mt-1 text-sm">תכנן את מפת המסעדה — שולחנות, קירות ומעברים</p>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5 flex-wrap">
        <select
          value={restaurantId}
          onChange={e => handleRestaurantChange(e.target.value)}
          className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
        >
          {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>

        <div className="flex rounded-xl overflow-hidden border border-gray-200 bg-white">
          {([
            { t: "table" as CellType, label: "🪑 שולחן" },
            { t: "wall" as CellType,  label: "🧱 קיר" },
            { t: "empty" as CellType, label: "🗑 מחק" },
          ]).map(({ t, label }) => (
            <button
              key={t}
              onClick={() => setTool(t)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${tool === t ? "text-white" : "text-gray-600 hover:bg-gray-50"}`}
              style={tool === t ? { background: "linear-gradient(135deg,#8B6914,#C9A84C)" } : undefined}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex gap-2 mr-auto">
          <button
            onClick={clearAll}
            className="px-4 py-2 text-sm rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            נקה הכל
          </button>
          <button
            onClick={saveLayout}
            disabled={saving || !restaurantId}
            className="px-5 py-2 text-sm font-semibold rounded-xl text-white disabled:opacity-50 transition-all"
            style={{ background: "linear-gradient(135deg,#8B6914,#C9A84C)" }}
          >
            {saving ? "שומר..." : saved ? "✓ נשמר!" : "שמור פריסה"}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-4 mb-4 text-sm text-gray-600">
        <span className="flex items-center gap-1.5">
          <span className="inline-block rounded" style={{ width: 16, height: 16, background: "linear-gradient(135deg,#fef3c7,#fde68a)", border: "2px solid #d97706" }} />
          {tableCount} שולחנות · {totalSeats} מושבים
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
          <div
            className="grid select-none"
            style={{ gridTemplateColumns: `repeat(${COLS}, ${CELL}px)`, gap: 1, width: "fit-content" }}
            onMouseLeave={() => { isPainting.current = false; }}
          >
            {Array.from({ length: ROWS }, (_, r) =>
              Array.from({ length: COLS }, (_, c) => {
                const cell = cellMap.get(cellKey(r, c));
                const isTable = cell?.type === "table";
                const isWall = cell?.type === "wall";

                return (
                  <div
                    key={`${r}-${c}`}
                    title={isTable ? `שולחן ${cell?.tableNumber ?? "?"} · ${cell?.seats ?? 4} כסאות` : undefined}
                    className="relative cursor-pointer transition-colors"
                    style={{
                      width: CELL,
                      height: CELL,
                      background: isTable
                        ? "transparent"
                        : isWall
                          ? "transparent"
                          : tool === "empty" ? "#fef2f2" : "#f9fafb",
                      border: isWall ? "none" : isTable ? "none" : "1px solid #e5e7eb",
                    }}
                    onMouseDown={() => { isPainting.current = true; applyTool(r, c); }}
                    onMouseUp={() => { isPainting.current = false; }}
                    onMouseEnter={e => {
                      if (isPainting.current && tool !== "table") applyTool(r, c);
                      if (!isTable && !isWall) (e.currentTarget as HTMLDivElement).style.background = "#fef9ec";
                    }}
                    onMouseLeave={e => {
                      if (!isTable && !isWall) (e.currentTarget as HTMLDivElement).style.background = tool === "empty" ? "#fef2f2" : "#f9fafb";
                    }}
                  >
                    {isWall && <WallCellVisual r={r} c={c} cellMap={cellMap} />}
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
        <span className="flex items-center gap-1.5">
          <span className="inline-block rounded" style={{ width: 14, height: 14, background: "linear-gradient(135deg,#fef3c7,#fde68a)", border: "2px solid #d97706" }} />
          שולחן — לחץ לעריכה
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block" style={{ width: 14, height: 14, background: "#374151", borderRadius: 2 }} />
          קיר — גרור לצייר
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block rounded border border-gray-200" style={{ width: 14, height: 14, background: "#f9fafb" }} />
          ריק
        </span>
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
                  <input
                    type="text"
                    value={editForm.tableNumber}
                    onChange={e => setEditForm(f => ({ ...f, tableNumber: e.target.value }))}
                    placeholder="לדוגמה: 1, A3, בר..."
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">מספר כסאות</label>
                  <div className="flex gap-2">
                    {[2, 4, 6, 8, 10].map(n => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setEditForm(f => ({ ...f, seats: String(n) }))}
                        className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                          editForm.seats === String(n) ? "border-amber-400 text-white" : "border-gray-200 text-gray-600 hover:bg-gray-50"
                        }`}
                        style={editForm.seats === String(n) ? { background: "linear-gradient(135deg,#8B6914,#C9A84C)" } : undefined}
                      >
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
                      <input
                        readOnly
                        value={tableUrl}
                        className="flex-1 text-xs text-gray-600 bg-white border border-gray-200 rounded-lg px-2 py-1.5 truncate focus:outline-none"
                        onClick={e => (e.target as HTMLInputElement).select()}
                      />
                      <button
                        type="button"
                        onClick={() => { navigator.clipboard.writeText(tableUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                        className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all"
                        style={{ background: copied ? "#22c55e" : "linear-gradient(135deg,#8B6914,#C9A84C)" }}
                      >
                        {copied ? "✓ הועתק" : "העתק"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-3 mt-5">
                <button
                  onClick={saveEditCell}
                  className="flex-1 py-2.5 rounded-xl text-white font-semibold text-sm"
                  style={{ background: "linear-gradient(135deg,#8B6914,#C9A84C)" }}
                >
                  שמור שולחן
                </button>
                <button
                  onClick={() => {
                    const key = cellKey(editCell.r, editCell.c);
                    setCellMap(prev => { const next = new Map(prev); next.delete(key); return next; });
                    setEditCell(null);
                  }}
                  className="px-4 py-2.5 rounded-xl text-red-600 bg-red-50 hover:bg-red-100 text-sm font-medium"
                >
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
