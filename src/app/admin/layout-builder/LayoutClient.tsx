"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
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
  // bar (group-level settings stored on every cell in the group)
  barSide?: BarSide; barGroupSeats?: number; barLabel?: string;
};

type Layout     = { rows: number; cols: number; cells: Cell[] };
type Restaurant = { id: string; name: string };

const ROWS = 22;
const COLS = 42;
const BASE = 30;

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

/* ── Bar group BFS ── */
function findBarGroup(startR: number, startC: number, cellMap: Map<string, Cell>): Cell[] {
  const visited = new Set<string>();
  const queue = [{ r: startR, c: startC }];
  const group: Cell[] = [];
  while (queue.length) {
    const { r, c } = queue.shift()!;
    const key = cellKey(r, c);
    if (visited.has(key)) continue;
    visited.add(key);
    const cell = cellMap.get(key);
    if (!cell || cell.type !== "bar") continue;
    group.push(cell);
    for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]])
      queue.push({ r: r+dr, c: c+dc });
  }
  return group;
}

/* Distribute totalSeats across group cells, sorted by position */
function getGroupStoolsMap(group: Cell[]): Map<string, number> {
  const result = new Map<string, number>();
  if (!group.length) return result;
  const side = group[0].barSide ?? "top";
  const total = group[0].barGroupSeats ?? group.length * 2;
  // Sort cells along the bar direction
  const sorted = [...group].sort((a, b) =>
    (side === "left" || side === "right") ? (a.r - b.r || a.c - b.c) : (a.c - b.c || a.r - b.r)
  );
  const base  = Math.floor(total / sorted.length);
  const extra = total % sorted.length;
  sorted.forEach((cell, i) => result.set(cellKey(cell.r, cell.c), base + (i < extra ? 1 : 0)));
  return result;
}

/* ── Table sizing ── */
function getDefaultTableSize(seats: number): { w: number; h: number } {
  if (seats <= 2) return { w: 1, h: 1 };
  if (seats <= 4) return { w: 2, h: 1 };
  if (seats <= 6) return { w: 2, h: 2 };
  if (seats <= 8) return { w: 3, h: 2 };
  return           { w: 4, h: 2 };
}
function getChairDist(seats: number, w = 1, h = 1) {
  if (w >= 2 && h === 1) { const half = Math.round(seats/2); return { top: half, bottom: seats-half, left: 0, right: 0 }; }
  if (w === 1 && h >= 2) { const half = Math.round(seats/2); return { top: 0, bottom: 0, left: half, right: seats-half }; }
  const tbSeat = Math.max(1, Math.round(seats*w/(2*(w+h))));
  const lrSeat = Math.max(0, Math.round((seats-tbSeat*2)/2));
  return { top: tbSeat, bottom: tbSeat, left: lrSeat, right: lrSeat };
}

/* ── Chair atoms ── */
const HC = () => <div style={{ width: 10, height: 7, background: "#92400e", borderRadius: 2, flexShrink: 0, boxShadow:"0 1px 2px rgba(0,0,0,0.25)" }} />;
const VC = () => <div style={{ width: 7, height: 10, background: "#92400e", borderRadius: 2, flexShrink: 0, boxShadow:"0 1px 2px rgba(0,0,0,0.25)" }} />;
/* Bar stool at screen-pixel scale – round seat + outer backrest (top-down view).
   Rendered OUTSIDE the transform:scale wrapper so z-index works correctly. */
function BarStoolPx({ side, sz }: { side: BarSide; sz: number }) {
  const B  = Math.max(2, Math.round(sz * 0.28));
  const bw = Math.round(sz * 0.68);
  const seat = <div style={{ width:sz, height:sz, borderRadius:"50%", flexShrink:0,
    background:"radial-gradient(circle at 35% 35%,#fde68a,#d97706)",
    border:"1px solid #92400e", boxShadow:"0 1px 2px rgba(0,0,0,0.3)" }} />;
  const bH = <div style={{ width:bw, height:B, borderRadius:1, flexShrink:0, background:"#78350f" }} />;
  const bV = <div style={{ width:B, height:bw, borderRadius:1, flexShrink:0, background:"#78350f" }} />;
  if (side==="top")    return <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:1,pointerEvents:"none"}}>{bH}{seat}</div>;
  if (side==="bottom") return <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:1,pointerEvents:"none"}}>{seat}{bH}</div>;
  if (side==="left")   return <div style={{display:"flex",flexDirection:"row",alignItems:"center",gap:1,pointerEvents:"none"}}>{bV}{seat}</div>;
  return                      <div style={{display:"flex",flexDirection:"row",alignItems:"center",gap:1,pointerEvents:"none"}}>{seat}{bV}</div>;
}

/* ── Table visuals ── */
function SquareTableVisual({ cell, ghost, w = 1, h = 1 }: { cell: Cell; ghost?: boolean; w?: number; h?: number }) {
  const d = getChairDist(cell.seats ?? 4, w, h);
  return (
    <div style={{ width: BASE*w, height: BASE*h, position: "relative", opacity: ghost?0.5:1, pointerEvents: "none" }}>
      {d.top    > 0 && <div className="absolute left-0 right-0 flex justify-around px-1" style={{top:1}}>{Array.from({length:d.top   }).map((_,i)=><HC key={i}/>)}</div>}
      {d.bottom > 0 && <div className="absolute left-0 right-0 flex justify-around px-1" style={{bottom:1}}>{Array.from({length:d.bottom}).map((_,i)=><HC key={i}/>)}</div>}
      {d.left   > 0 && <div className="absolute top-0 bottom-0 flex flex-col justify-around py-1" style={{left:1}}>{Array.from({length:d.left  }).map((_,i)=><VC key={i}/>)}</div>}
      {d.right  > 0 && <div className="absolute top-0 bottom-0 flex flex-col justify-around py-1" style={{right:1}}>{Array.from({length:d.right }).map((_,i)=><VC key={i}/>)}</div>}
      <div className="absolute rounded flex items-center justify-center"
        style={{ inset:9, background:"linear-gradient(135deg,#fef3c7,#fde68a)", border:"1.5px solid #d97706", boxShadow:"0 1px 2px rgba(0,0,0,0.15)" }}>
        <span className="font-black text-amber-900 leading-none" style={{fontSize:8}}>{cell.tableNumber||"?"}</span>
      </div>
    </div>
  );
}
function RoundTableVisual({ cell, ghost }: { cell: Cell; ghost?: boolean }) {
  const seats=cell.seats??4; const half=BASE/2; const tR=9; const cR=13; const cS=7;
  return (
    <div style={{ width:BASE, height:BASE, position:"relative", opacity:ghost?0.5:1, pointerEvents:"none" }}>
      {Array.from({length:seats}).map((_,i)=>{ const a=(i*2*Math.PI/seats)-Math.PI/2; return <div key={i} className="absolute rounded-full" style={{width:cS,height:cS,background:"#92400e",boxShadow:"0 1px 2px rgba(0,0,0,0.25)",left:half+cR*Math.cos(a)-cS/2,top:half+cR*Math.sin(a)-cS/2}}/>; })}
      <div className="absolute rounded-full flex items-center justify-center" style={{left:half-tR,top:half-tR,width:tR*2,height:tR*2,background:"linear-gradient(135deg,#fef3c7,#fde68a)",border:"1.5px solid #d97706"}}>
        <span className="font-black text-amber-900" style={{fontSize:7}}>{cell.tableNumber||"?"}</span>
      </div>
    </div>
  );
}
function OvalTableVisual({ cell, ghost }: { cell: Cell; ghost?: boolean }) {
  const seats=cell.seats??4; const half=BASE/2; const rx=13; const ry=10; const trx=10; const try_=7; const cS=7;
  return (
    <div style={{ width:BASE, height:BASE, position:"relative", opacity:ghost?0.5:1, pointerEvents:"none" }}>
      {Array.from({length:seats}).map((_,i)=>{ const a=(i*2*Math.PI/seats)-Math.PI/2; return <div key={i} className="absolute rounded-full" style={{width:cS,height:cS,background:"#92400e",boxShadow:"0 1px 2px rgba(0,0,0,0.25)",left:half+rx*Math.cos(a)-cS/2,top:half+ry*Math.sin(a)-cS/2}}/>; })}
      <div className="absolute flex items-center justify-center" style={{left:half-trx,top:half-try_,width:trx*2,height:try_*2,borderRadius:"50%",background:"linear-gradient(135deg,#fef3c7,#fde68a)",border:"1.5px solid #d97706"}}>
        <span className="font-black text-amber-900" style={{fontSize:7}}>{cell.tableNumber||"?"}</span>
      </div>
    </div>
  );
}
function TableCellVisual({ cell, ghost, w, h }: { cell: Cell; ghost?: boolean; w?: number; h?: number }) {
  const s = cell.tableShape ?? "square";
  if (s==="round") return <RoundTableVisual cell={cell} ghost={ghost}/>;
  if (s==="oval")  return <OvalTableVisual  cell={cell} ghost={ghost}/>;
  return <SquareTableVisual cell={cell} ghost={ghost} w={w} h={h}/>;
}

function WallCellVisual({ r, c, cellMap }: { r: number; c: number; cellMap: Map<string,Cell> }) {
  const N=cellMap.get(cellKey(r-1,c))?.type==="wall"; const S=cellMap.get(cellKey(r+1,c))?.type==="wall";
  const E=cellMap.get(cellKey(r,c+1))?.type==="wall"; const W=cellMap.get(cellKey(r,c-1))?.type==="wall";
  return <div style={{ width:BASE, height:BASE, position:"relative", borderRadius:connRadius(N,S,E,W), background:"#374151",
    backgroundImage:["repeating-linear-gradient(0deg,rgba(255,255,255,0.06) 0,rgba(255,255,255,0.06) 1px,transparent 1px,transparent 7px)",
      "repeating-linear-gradient(90deg,rgba(255,255,255,0.06) 0,rgba(255,255,255,0.06) 1px,transparent 1px,transparent 12px)"].join(",") }} />;
}

function BarCellVisual({ r, c, cell, cellMap }: { r: number; c: number; cell: Cell; cellMap: Map<string,Cell> }) {
  const N=cellMap.get(cellKey(r-1,c))?.type==="bar"; const Sc=cellMap.get(cellKey(r+1,c))?.type==="bar";
  const E=cellMap.get(cellKey(r,c+1))?.type==="bar"; const W=cellMap.get(cellKey(r,c-1))?.type==="bar";
  return (
    <div style={{ width:BASE, height:BASE, position:"relative", pointerEvents:"none" }}>
      <div className="absolute inset-0" style={{ borderRadius:connRadius(N,Sc,E,W), background:"linear-gradient(135deg,#78350f,#92400e)",
        backgroundImage:"repeating-linear-gradient(90deg,rgba(255,255,255,0.05) 0,rgba(255,255,255,0.05) 1px,transparent 1px,transparent 7px)" }} />
      {cell.barLabel && !N && !W && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="font-black text-amber-200 leading-none" style={{fontSize:7}}>{cell.barLabel}</span>
        </div>
      )}
    </div>
  );
}

/* ── Constants ── */
const BAR_SIDES: { side: BarSide; label: string }[] = [
  { side: "top",    label: "↑ מלמעלה" },
  { side: "bottom", label: "↓ מלמטה" },
  { side: "left",   label: "← משמאל" },
  { side: "right",  label: "→ מימין" },
];
const TABLE_SHAPES: { shape: TableShape; label: string }[] = [
  { shape: "square", label: "⬜ מרובע" },
  { shape: "round",  label: "⭕ עגול" },
  { shape: "oval",   label: "🥚 אובלי" },
];

/* ── Main ── */
export default function LayoutClient({ restaurants }: { restaurants: Restaurant[] }) {
  const [restaurantId, setRestaurantId] = useState(restaurants[0]?.id ?? "");
  const [tool, setTool]             = useState<ToolMode>("table");
  const [barSide, setBarSide]       = useState<BarSide>("top");
  const [tableShape, setTableShape] = useState<TableShape>("square");
  const [cellMap, setCellMap]       = useState<Map<string,Cell>>(new Map());
  const [cellPx, setCellPx]         = useState(BASE);

  const [editTable, setEditTable]   = useState<{r:number;c:number}|null>(null);
  const [tableForm, setTableForm]   = useState({ tableNumber:"", seats:"4", shape:"square" as TableShape, w:"2", h:"1" });
  const [editBar, setEditBar]       = useState<{r:number;c:number}|null>(null);
  const [barForm, setBarForm]       = useState({ barLabel:"", barSeats:"4", barSide:"top" as BarSide });

  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [loading, setLoading]       = useState(false);
  const [copied, setCopied]         = useState(false);
  const [origin, setOrigin]         = useState("");

  const [dragSource, setDragSource] = useState<Cell|null>(null);
  const [dragOver, setDragOver]     = useState<{r:number;c:number}|null>(null);
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
      setCellPx(Math.max(14, Math.floor((w-(COLS-1))/COLS)));
    };
    recalc();
    const ro = new ResizeObserver(recalc);
    if (gridRef.current) ro.observe(gridRef.current);
    return () => ro.disconnect();
  }, []);

  const scale = cellPx / BASE;

  /* Precompute bar group stool maps for O(1) lookup during render */
  const barStoolsMap = useMemo(() => {
    const visited = new Set<string>();
    const result  = new Map<string,number>(); // cellKey → stool count for that cell
    for (const [, cell] of cellMap) {
      if (cell.type !== "bar") continue;
      const key = cellKey(cell.r, cell.c);
      if (visited.has(key)) continue;
      const group = findBarGroup(cell.r, cell.c, cellMap);
      const stoolsMap = getGroupStoolsMap(group);
      for (const [k, v] of stoolsMap) { result.set(k, v); visited.add(k); }
    }
    return result;
  }, [cellMap]);

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

  /* Multi-cell table helpers */
  function placeTable(map: Map<string,Cell>, r: number, c: number, cell: Omit<Cell,"r"|"c"|"type">) {
    const w=cell.tableW??1; const h=cell.tableH??1;
    map.set(cellKey(r,c), { r, c, type:"table", ...cell });
    for (let dr=0; dr<h; dr++) for (let dc=0; dc<w; dc++)
      if (dr>0||dc>0) map.set(cellKey(r+dr,c+dc), { r:r+dr, c:c+dc, type:"table-part", anchorR:r, anchorC:c });
  }
  function removeTable(map: Map<string,Cell>, ar: number, ac: number) {
    const anchor=map.get(cellKey(ar,ac)); if (!anchor) return;
    for (let dr=0; dr<(anchor.tableH??1); dr++) for (let dc=0; dc<(anchor.tableW??1); dc++) map.delete(cellKey(ar+dr,ac+dc));
  }

  /* Paint a bar cell, inheriting adjacent group settings */
  function paintBarCell(map: Map<string,Cell>, r: number, c: number) {
    let inherited: Partial<Cell> = {};
    for (const [dr,dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      const nb = map.get(cellKey(r+dr,c+dc));
      if (nb?.type==="bar") { inherited = { barSide:nb.barSide, barGroupSeats:nb.barGroupSeats, barLabel:nb.barLabel }; break; }
    }
    map.set(cellKey(r,c), { r, c, type:"bar", barSide: inherited.barSide??barSide, barGroupSeats: inherited.barGroupSeats??0, barLabel: inherited.barLabel??"" });
  }

  function handleCellMouseDown(r: number, c: number) {
    const key = cellKey(r, c);
    const cell = cellMap.get(key);

    if (tool==="move") {
      if (cell?.type==="table") { isDragging.current=true; setDragSource(cell); setDragOver({r,c}); }
      return;
    }
    if (tool==="table") {
      if (cell?.type==="table" || cell?.type==="table-part") {
        const anchor = cell.type==="table" ? cell : cellMap.get(cellKey(cell.anchorR!,cell.anchorC!));
        if (anchor) {
          setTableForm({ tableNumber:anchor.tableNumber??"", seats:String(anchor.seats??4), shape:anchor.tableShape??"square", w:String(anchor.tableW??1), h:String(anchor.tableH??1) });
          setEditTable({ r:anchor.r, c:anchor.c });
        }
        return;
      }
      const seats=4; const {w,h}=getDefaultTableSize(seats);
      setCellMap(prev => { const next=new Map(prev); placeTable(next,r,c,{tableNumber:"",seats,tableShape,tableW:w,tableH:h}); return next; });
      setTableForm({ tableNumber:"", seats:String(seats), shape:tableShape, w:String(w), h:String(h) });
      setEditTable({r,c});
      return;
    }
    if (tool==="bar") {
      if (cell?.type==="bar") {
        const group = findBarGroup(r, c, cellMap);
        const canon = group[0];
        setBarForm({ barLabel:canon.barLabel??"", barSeats:String(canon.barGroupSeats||group.length*2), barSide:canon.barSide??barSide });
        setEditBar({r,c});
        return;
      }
      isPainting.current=true;
      setCellMap(prev => { const next=new Map(prev); paintBarCell(next,r,c); return next; });
      return;
    }
    isPainting.current=true;
    // wall / empty
    setCellMap(prev => {
      const next=new Map(prev);
      if (tool==="empty") {
        if (cell?.type==="table") removeTable(next,r,c);
        else if (cell?.type==="table-part") removeTable(next,cell.anchorR!,cell.anchorC!);
        else next.delete(key);
      } else if (tool==="wall") {
        next.set(key, {r,c,type:"wall"});
      }
      return next;
    });
  }

  const commitMove = useCallback(() => {
    if (dragSource && dragOver && (dragSource.r!==dragOver.r||dragSource.c!==dragOver.c)) {
      setCellMap(prev => {
        const next=new Map(prev);
        removeTable(next,dragSource.r,dragSource.c);
        placeTable(next,dragOver.r,dragOver.c,{ tableNumber:dragSource.tableNumber, seats:dragSource.seats, tableShape:dragSource.tableShape, tableW:dragSource.tableW, tableH:dragSource.tableH });
        return next;
      });
    }
    setDragSource(null); setDragOver(null); isDragging.current=false;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragSource, dragOver]);

  function saveTableEdit() {
    if (!editTable) return;
    const seats=parseInt(tableForm.seats)||4;
    const w=parseInt(tableForm.w)||getDefaultTableSize(seats).w;
    const h=parseInt(tableForm.h)||getDefaultTableSize(seats).h;
    setCellMap(prev => { const next=new Map(prev); removeTable(next,editTable.r,editTable.c); placeTable(next,editTable.r,editTable.c,{tableNumber:tableForm.tableNumber,seats,tableShape:tableForm.shape,tableW:w,tableH:h}); return next; });
    setEditTable(null);
  }

  function saveBarEdit() {
    if (!editBar) return;
    const group = findBarGroup(editBar.r, editBar.c, cellMap);
    const totalSeats = parseInt(barForm.barSeats) || group.length * 2;
    setCellMap(prev => {
      const next=new Map(prev);
      for (const c of group) {
        next.set(cellKey(c.r,c.c), { ...c, barLabel:barForm.barLabel, barGroupSeats:totalSeats, barSide:barForm.barSide });
      }
      return next;
    });
    setEditBar(null);
  }

  function clearAll() { if (!confirm("למחוק את כל הפריסה?")) return; setCellMap(new Map()); }
  async function saveLayout() {
    if (!restaurantId) return;
    setSaving(true);
    await fetch(`/api/admin/restaurants/${restaurantId}/layout`, { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify({tableLayoutJson:JSON.stringify(mapToLayout(cellMap))}) });
    setSaving(false); setSaved(true); setTimeout(()=>setSaved(false),2500);
  }

  const skipSet = new Set<string>();
  for (const [key,cell] of cellMap) if (cell.type==="table-part") skipSet.add(key);
  const tableCount = Array.from(cellMap.values()).filter(c=>c.type==="table").length;
  const totalSeatsAll = Array.from(cellMap.values()).filter(c=>c.type==="table").reduce((s,c)=>s+(c.seats??4),0);

  return (
    <div className="p-4 md:p-6" onMouseUp={()=>{ if(isDragging.current) commitMove(); isPainting.current=false; }}>
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">🗺 פריסת שולחנות</h1>
        <p className="text-gray-500 mt-0.5 text-sm">תכנן את מפת המסעדה — שולחנות, בר, קירות ומעברים</p>
      </div>

      <div className="flex flex-col gap-2 mb-4">
        <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
          {restaurants.length>1 && (
            <select value={restaurantId} onChange={e=>handleRestaurantChange(e.target.value)}
              className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400">
              {restaurants.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          )}
          <div className="flex rounded-xl overflow-hidden border border-gray-200 bg-white">
            {([{t:"table",label:"🪑 שולחן"},{t:"bar",label:"🍺 בר"},{t:"wall",label:"🧱 קיר"},{t:"move",label:"✋ הזז"},{t:"empty",label:"🗑 מחק"}] as {t:ToolMode;label:string}[]).map(({t,label})=>(
              <button key={t} onClick={()=>setTool(t)}
                className={`px-3 py-2 text-sm font-medium transition-colors ${tool===t?"text-white":"text-gray-600 hover:bg-gray-50"}`}
                style={tool===t?{background:"linear-gradient(135deg,#8B6914,#C9A84C)"}:undefined}>{label}</button>
            ))}
          </div>
          <div className="flex gap-2 mr-auto">
            <button onClick={clearAll} className="px-3 py-2 text-sm rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-red-50 hover:text-red-600">נקה הכל</button>
            <button onClick={saveLayout} disabled={saving||!restaurantId} className="px-4 py-2 text-sm font-semibold rounded-xl text-white disabled:opacity-50" style={{background:"linear-gradient(135deg,#8B6914,#C9A84C)"}}>
              {saving?"שומר...":saved?"✓ נשמר!":"שמור פריסה"}
            </button>
          </div>
        </div>

        {tool==="table" && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-gray-600 font-medium">צורת שולחן:</span>
            {TABLE_SHAPES.map(({shape,label})=>(
              <button key={shape} onClick={()=>setTableShape(shape)}
                className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition-colors ${tableShape===shape?"text-white border-amber-500":"bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}
                style={tableShape===shape?{background:"linear-gradient(135deg,#8B6914,#C9A84C)"}:undefined}>{label}</button>
            ))}
          </div>
        )}
        {tool==="bar" && (
          <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-1.5 w-fit">
            🍺 גרור לשרטט את הבר · לחץ על בר קיים להגדרות
          </p>
        )}
        {tool==="move" && (
          <p className="text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-1.5 w-fit">✋ לחץ וגרור שולחן למיקום חדש</p>
        )}
      </div>

      <div className="flex gap-3 mb-3 text-xs text-gray-500">
        <span>{tableCount} שולחנות · {totalSeatsAll} מושבים</span>
        <span className="text-gray-300">|</span>
        <span className="text-gray-400">{COLS}×{ROWS} · {cellPx}px/תא</span>
      </div>

      {loading ? <div className="flex items-center justify-center h-64 text-gray-400">טוען...</div> : (
        <div ref={gridRef} className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-auto p-2">
          <div className="grid select-none"
            style={{gridTemplateColumns:`repeat(${COLS}, ${cellPx}px)`, gap:1, width:"fit-content"}}
            onMouseLeave={()=>{ if(isDragging.current) commitMove(); isPainting.current=false; }}>
            {(() => {
              const els = [];
              for (let r=0; r<ROWS; r++) {
                for (let c=0; c<COLS; c++) {
                  if (skipSet.has(cellKey(r,c))) continue;
                  const cell=cellMap.get(cellKey(r,c));
                  const isTable=cell?.type==="table"; const isWall=cell?.type==="wall"; const isBar=cell?.type==="bar";
                  const w=isTable?(cell!.tableW??1):1; const h=isTable?(cell!.tableH??1):1;
                  const isSrc=dragSource?.r===r&&dragSource?.c===c;
                  const isDst=!!dragSource&&dragOver?.r===r&&dragOver?.c===c;
                  const pxW=cellPx*w+(w-1); const pxH=cellPx*h+(h-1);
                  const stools = isBar ? (barStoolsMap.get(cellKey(r,c))??0) : 0;

                  els.push(
                    <div key={`${r}-${c}`}
                      style={{ gridColumn:w>1?`span ${w}`:undefined, gridRow:h>1?`span ${h}`:undefined,
                        width:pxW, height:pxH, position:"relative",
                        background:isTable||isWall||isBar?"transparent":"#f8f9fa",
                        border:isWall||isBar?"none":"1px solid #e9ecef",
                        cursor:tool==="move"?(isTable?"grab":"default"):"crosshair",
                        outline:isDst?"2px solid #3b82f6":undefined, outlineOffset:"-1px" }}
                      onMouseDown={()=>handleCellMouseDown(r,c)}
                      onMouseUp={()=>{ if(isDragging.current) commitMove(); isPainting.current=false; }}
                      onMouseEnter={()=>{
                        if (isDragging.current) setDragOver({r,c});
                        else if (isPainting.current) {
                          if (tool==="bar") setCellMap(prev=>{const next=new Map(prev);paintBarCell(next,r,c);return next;});
                          else if (tool==="wall") setCellMap(prev=>{const next=new Map(prev);next.set(cellKey(r,c),{r,c,type:"wall"});return next;});
                          else if (tool==="empty") setCellMap(prev=>{const next=new Map(prev);const cc=next.get(cellKey(r,c));if(cc?.type==="table") removeTable(next,r,c);else if(cc?.type==="table-part") removeTable(next,cc.anchorR!,cc.anchorC!);else next.delete(cellKey(r,c));return next;});
                        }
                      }}>
                      {(isWall||isBar||isTable||isDst) && (
                        <div style={{ position:"absolute", left:0, top:0, width:BASE*w, height:BASE*h, transform:`scale(${scale})`, transformOrigin:"top left", pointerEvents:"none" }}>
                          {isWall  && <WallCellVisual  r={r} c={c} cellMap={cellMap}/>}
                          {isBar   && <BarCellVisual   r={r} c={c} cell={cell!} cellMap={cellMap}/>}
                          {isTable && <TableCellVisual cell={cell!} ghost={isSrc&&isDragging.current} w={w} h={h}/>}
                          {isDst&&dragSource&&!isTable && <TableCellVisual cell={{...dragSource,r,c}} ghost w={dragSource.tableW??1} h={dragSource.tableH??1}/>}
                        </div>
                      )}
                      {/* Bar stools rendered at screen-pixel scale OUTSIDE the scaled wrapper.
                          z-index:20 ensures they always paint above adjacent grid cells regardless of DOM order. */}
                      {isBar && stools > 0 && (() => {
                        const side = cell!.barSide ?? "top";
                        const isH  = side === "top" || side === "bottom";
                        const sz   = Math.max(7, Math.round(cellPx * 0.42));
                        const gap  = Math.max(2, Math.round(cellPx * 0.1));
                        const cs: React.CSSProperties = {
                          position:"absolute", display:"flex", alignItems:"center",
                          justifyContent:"space-around", pointerEvents:"none", zIndex:20,
                          flexDirection: isH ? "row" : "column",
                          ...(side==="top"    ? { left:1, right:1, bottom: pxH + gap } : {}),
                          ...(side==="bottom" ? { left:1, right:1, top:    pxH + gap } : {}),
                          ...(side==="left"   ? { top:1, bottom:1, right:  pxW + gap } : {}),
                          ...(side==="right"  ? { top:1, bottom:1, left:   pxW + gap } : {}),
                        };
                        return (
                          <div style={cs}>
                            {Array.from({length:stools}).map((_,i)=><BarStoolPx key={i} side={side} sz={sz}/>)}
                          </div>
                        );
                      })()}
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
        const tableUrl=tableForm.tableNumber&&restaurantId&&origin?`${origin}/menu/${restaurantId}?table=${encodeURIComponent(tableForm.tableNumber)}`:null;
        return (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={()=>setEditTable(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 overflow-y-auto max-h-[90vh]" onClick={e=>e.stopPropagation()}>
              <h3 className="text-lg font-bold text-gray-900 mb-4">✏️ הגדרת שולחן</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">מספר / שם שולחן</label>
                  <input type="text" value={tableForm.tableNumber} onChange={e=>setTableForm(f=>({...f,tableNumber:e.target.value}))} placeholder="1, A3, בר..." autoFocus className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">צורת שולחן</label>
                  <div className="flex gap-2">
                    {TABLE_SHAPES.map(({shape,label})=>(
                      <button key={shape} type="button" onClick={()=>setTableForm(f=>({...f,shape}))}
                        className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors ${tableForm.shape===shape?"border-amber-400 text-white":"border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                        style={tableForm.shape===shape?{background:"linear-gradient(135deg,#8B6914,#C9A84C)"}:undefined}>{label}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">מספר כסאות</label>
                  <div className="flex gap-2">
                    {[2,4,6,8,10].map(n=>{
                      const def=getDefaultTableSize(n);
                      return <button key={n} type="button" onClick={()=>setTableForm(f=>({...f,seats:String(n),w:String(def.w),h:String(def.h)}))}
                        className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors ${tableForm.seats===String(n)?"border-amber-400 text-white":"border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                        style={tableForm.seats===String(n)?{background:"linear-gradient(135deg,#8B6914,#C9A84C)"}:undefined}>{n}</button>;
                    })}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">גודל על המפה (תאים)</label>
                  <div className="flex gap-4 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-500">רוחב</span>
                      {[1,2,3,4].map(n=><button key={n} type="button" onClick={()=>setTableForm(f=>({...f,w:String(n)}))}
                        className={`w-8 h-8 rounded-lg text-sm font-bold border transition-colors ${tableForm.w===String(n)?"text-white border-amber-400":"bg-white text-gray-600 border-gray-200"}`}
                        style={tableForm.w===String(n)?{background:"linear-gradient(135deg,#8B6914,#C9A84C)"}:undefined}>{n}</button>)}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-500">גובה</span>
                      {[1,2,3].map(n=><button key={n} type="button" onClick={()=>setTableForm(f=>({...f,h:String(n)}))}
                        className={`w-8 h-8 rounded-lg text-sm font-bold border transition-colors ${tableForm.h===String(n)?"text-white border-amber-400":"bg-white text-gray-600 border-gray-200"}`}
                        style={tableForm.h===String(n)?{background:"linear-gradient(135deg,#8B6914,#C9A84C)"}:undefined}>{n}</button>)}
                    </div>
                  </div>
                </div>
                {tableUrl && (
                  <div className="border border-gray-100 rounded-xl p-4 bg-gray-50 space-y-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">QR לשולחן</p>
                    <div className="flex justify-center"><div className="p-2 bg-white rounded-xl border border-gray-200 inline-block"><QRCodeSVG value={tableUrl} size={140}/></div></div>
                    <div className="flex items-center gap-2">
                      <input readOnly value={tableUrl} className="flex-1 text-xs text-gray-600 bg-white border border-gray-200 rounded-lg px-2 py-1.5 truncate" onClick={e=>(e.target as HTMLInputElement).select()}/>
                      <button type="button" onClick={()=>{navigator.clipboard.writeText(tableUrl);setCopied(true);setTimeout(()=>setCopied(false),2000);}}
                        className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold text-white" style={{background:copied?"#22c55e":"linear-gradient(135deg,#8B6914,#C9A84C)"}}>
                        {copied?"✓":"העתק"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={saveTableEdit} className="flex-1 py-2.5 rounded-xl text-white font-semibold text-sm" style={{background:"linear-gradient(135deg,#8B6914,#C9A84C)"}}>שמור</button>
                <button onClick={()=>{setCellMap(prev=>{const next=new Map(prev);removeTable(next,editTable.r,editTable.c);return next;});setEditTable(null);}} className="px-4 py-2.5 rounded-xl text-red-600 bg-red-50 hover:bg-red-100 text-sm">מחק</button>
                <button onClick={()=>setEditTable(null)} className="px-4 py-2.5 rounded-xl bg-gray-100 text-gray-600 text-sm">ביטול</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Bar edit dialog ── */}
      {editBar && (() => {
        const group = findBarGroup(editBar.r, editBar.c, cellMap);
        return (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={()=>setEditBar(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e=>e.stopPropagation()}>
              <h3 className="text-lg font-bold text-gray-900 mb-1">🍺 הגדרת בר</h3>
              <p className="text-xs text-gray-400 mb-4">{group.length} תאים מחוברים · ההגדרות חלות על כולם</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">שם הבר</label>
                  <input type="text" value={barForm.barLabel} onChange={e=>setBarForm(f=>({...f,barLabel:e.target.value}))} placeholder="בר, סושי בר..." autoFocus
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">סה&quot;כ כסאות בר</label>
                  <div className="flex gap-2 flex-wrap">
                    {[2,4,6,8,10,12,16,20].map(n=>(
                      <button key={n} type="button" onClick={()=>setBarForm(f=>({...f,barSeats:String(n)}))}
                        className={`flex-1 min-w-[36px] py-2 rounded-xl text-sm font-semibold border transition-colors ${barForm.barSeats===String(n)?"border-amber-400 text-white":"border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                        style={barForm.barSeats===String(n)?{background:"linear-gradient(135deg,#78350f,#92400e)"}:undefined}>{n}</button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">מחולקים שווה בשווה בין {group.length} תאי הבר</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">צד ישיבה</label>
                  <div className="grid grid-cols-2 gap-2">
                    {BAR_SIDES.map(({side,label})=>(
                      <button key={side} type="button" onClick={()=>setBarForm(f=>({...f,barSide:side}))}
                        className={`py-2.5 rounded-xl text-sm font-semibold border transition-colors ${barForm.barSide===side?"border-amber-400 text-white":"border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                        style={barForm.barSide===side?{background:"linear-gradient(135deg,#78350f,#92400e)"}:undefined}>{label}</button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={saveBarEdit} className="flex-1 py-2.5 rounded-xl text-white font-semibold text-sm" style={{background:"linear-gradient(135deg,#78350f,#92400e)"}}>שמור</button>
                <button onClick={()=>{
                  setCellMap(prev=>{const next=new Map(prev);for(const c of group)next.delete(cellKey(c.r,c.c));return next;});
                  setEditBar(null);
                }} className="px-4 py-2.5 rounded-xl text-red-600 bg-red-50 hover:bg-red-100 text-sm">מחק בר</button>
                <button onClick={()=>setEditBar(null)} className="px-4 py-2.5 rounded-xl bg-gray-100 text-gray-600 text-sm">ביטול</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
