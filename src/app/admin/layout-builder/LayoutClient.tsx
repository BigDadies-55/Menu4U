"use client";

import { useState, useCallback, useRef } from "react";

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
const EMPTY_LAYOUT: Layout = { rows: ROWS, cols: COLS, cells: [] };

function cellKey(r: number, c: number) { return `${r}:${c}`; }

function layoutToMap(layout: Layout): Map<string, Cell> {
  const map = new Map<string, Cell>();
  for (const cell of layout.cells) {
    map.set(cellKey(cell.r, cell.c), cell);
  }
  return map;
}

function mapToLayout(map: Map<string, Cell>, rows: number, cols: number): Layout {
  return { rows, cols, cells: Array.from(map.values()) };
}

export default function LayoutClient({
  restaurants,
}: {
  restaurants: Restaurant[];
}) {
  const [restaurantId, setRestaurantId] = useState(restaurants[0]?.id ?? "");
  const [tool, setTool] = useState<CellType>("table");
  const [cellMap, setCellMap] = useState<Map<string, Cell>>(new Map());
  const [editCell, setEditCell] = useState<{ r: number; c: number } | null>(null);
  const [editForm, setEditForm] = useState({ tableNumber: "", seats: "4" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const isPainting = useRef(false);

  async function loadLayout(rid: string) {
    setLoading(true);
    const res = await fetch(`/api/admin/restaurants/${rid}/layout`);
    if (res.ok) {
      const data = await res.json();
      if (data.tableLayoutJson) {
        try {
          const layout: Layout = JSON.parse(data.tableLayoutJson);
          setCellMap(layoutToMap(layout));
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
      } else if (tool === "table") {
        const existing = prev.get(key);
        if (existing?.type === "table") {
          setEditCell({ r, c });
          setEditForm({
            tableNumber: existing.tableNumber ?? "",
            seats: String(existing.seats ?? 4),
          });
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
    const layout = mapToLayout(cellMap, ROWS, COLS);
    await fetch(`/api/admin/restaurants/${restaurantId}/layout`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tableLayoutJson: JSON.stringify(layout) }),
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

        {/* Tools */}
        <div className="flex rounded-xl overflow-hidden border border-gray-200 bg-white">
          {([
            { t: "table" as CellType, label: "🪑 שולחן", color: "amber" },
            { t: "wall" as CellType, label: "🧱 קיר", color: "gray" },
            { t: "empty" as CellType, label: "🗑 מחק", color: "red" },
          ]).map(({ t, label }) => (
            <button
              key={t}
              onClick={() => setTool(t)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                tool === t ? "text-white" : "text-gray-600 hover:bg-gray-50"
              }`}
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
          <span className="w-4 h-4 rounded bg-amber-200 border border-amber-400 inline-block"></span>
          {tableCount} שולחנות
        </span>
        <span>|</span>
        <span>{totalSeats} מקומות ישיבה סה"כ</span>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64 text-gray-400">טוען...</div>
      ) : (
        <div className="overflow-auto rounded-2xl border border-gray-200 bg-white shadow-sm p-4">
          <div
            className="grid select-none"
            style={{
              gridTemplateColumns: `repeat(${COLS}, 1fr)`,
              gap: 2,
              width: "fit-content",
              minWidth: "100%",
            }}
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
                    className={`
                      relative cursor-pointer rounded transition-all
                      ${isTable
                        ? "bg-amber-100 border-2 border-amber-400 hover:bg-amber-200"
                        : isWall
                          ? "bg-gray-600 border border-gray-700"
                          : "bg-gray-50 border border-gray-100 hover:bg-amber-50"
                      }
                    `}
                    style={{ width: 38, height: 38 }}
                    onMouseDown={() => {
                      isPainting.current = true;
                      applyTool(r, c);
                    }}
                    onMouseUp={() => { isPainting.current = false; }}
                    onMouseEnter={() => {
                      if (isPainting.current && tool !== "table") applyTool(r, c);
                    }}
                  >
                    {isTable && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <div className="text-amber-800 font-bold text-xs leading-tight">
                          {cell?.tableNumber || "?"}
                        </div>
                        <div className="text-amber-600 text-[9px] leading-none">{cell?.seats ?? 4}👤</div>
                      </div>
                    )}
                    {isWall && (
                      <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-xs pointer-events-none">
                        ▪
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="mt-4 flex gap-5 text-xs text-gray-500 flex-wrap">
        <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-amber-100 border-2 border-amber-400 inline-block"></span>שולחן — לחץ לעריכה</span>
        <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-gray-600 inline-block"></span>קיר — גרור לצייר</span>
        <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-gray-50 border border-gray-200 inline-block"></span>ריק</span>
      </div>

      {/* Edit table dialog */}
      {editCell && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setEditCell(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
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
                        editForm.seats === String(n)
                          ? "border-amber-400 text-white"
                          : "border-gray-200 text-gray-600 hover:bg-gray-50"
                      }`}
                      style={editForm.seats === String(n) ? { background: "linear-gradient(135deg,#8B6914,#C9A84C)" } : undefined}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
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
      )}
    </div>
  );
}
