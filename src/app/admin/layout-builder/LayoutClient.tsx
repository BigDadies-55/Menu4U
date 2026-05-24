"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { QRCodeSVG } from "qrcode.react";

type CellType    = "empty" | "wall" | "table" | "table-part" | "bar";
type BarSide     = "top" | "bottom" | "left" | "right";
type TableShape  = "square" | "round" | "oval";

type Cell = {
  r: number; c: number; type: CellType;
  tableNumber?: string; seats?: number; tableShape?: TableShape;
  tableW?: number; tableH?: number;
  anchorR?: number; anchorC?: number;
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

function getGroupStoolsMap(group: Cell[]): Map<string, number> {
  const result = new Map<string, number>();
  if (!group.length) return result;
  const side = group[0].barSide ?? "top";
  const total = group[0].barGroupSeats ?? group.length * 2;
  const sorted = [...group].sort((a, b) =>
    (side === "left" || side === "right") ? (a.r - b.r || a.c - b.c) : (a.c - b.c || a.r - b.r)
  );
  const base  = Math.floor(total / sorted.length);
  const extra = total % sorted.length;
  sorted.forEach((cell, i) => result.set(cellKey(cell.r, cell.c), base + (i < extra ? 1 : 0)));
  return result;
}

/* ── Table sizing ── */
function getDefaultTableSize(seats: number, shape: TableShape = "square"): { w: number; h: number } {
  if (shape === "round") {
    if (seats <= 2) return { w: 1, h: 1 };
    if (seats <= 6) return { w: 2, h: 2 };
    if (seats <= 9) return { w: 3, h: 3 };
    return           { w: 4, h: 4 };
  }
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
function RoundTableVisual({ cell, ghost, w = 1, h = 1 }: { cell: Cell; ghost?: boolean; w?: number; h?: number }) {
  const seats = cell.seats ?? 4;
  const s   = Math.min(w, h);
  const cx  = BASE * w / 2;
  const cy  = BASE * h / 2;
  const tR  = Math.round(BASE * s * 0.30);
  const cR  = Math.round(BASE * s * 0.43);
  const cS  = Math.max(5, Math.round(BASE * s * 0.23));
  const fS  = Math.max(6, Math.round(BASE * s * 0.22));
  return (
    <div style={{ width:BASE*w, height:BASE*h, position:"relative", opacity:ghost?0.5:1, pointerEvents:"none" }}>
      {Array.from({length:seats}).map((_,i)=>{ const a=(i*2*Math.PI/seats)-Math.PI/2;
        return <div key={i} className="absolute rounded-full" style={{width:cS,height:cS,background:"#92400e",boxShadow:"0 1px 2px rgba(0,0,0,0.25)",left:cx+cR*Math.cos(a)-cS/2,top:cy+cR*Math.sin(a)-cS/2}}/>; })}
      <div className="absolute rounded-full flex items-center justify-center"
        style={{left:cx-tR,top:cy-tR,width:tR*2,height:tR*2,background:"linear-gradient(135deg,#fef3c7,#fde68a)",border:"1.5px solid #d97706"}}>
        <span className="font-black text-amber-900" style={{fontSize:fS}}>{cell.tableNumber||"?"}</span>
      </div>
    </div>
  );
}
function OvalTableVisual({ cell, ghost, w = 1, h = 1 }: { cell: Cell; ghost?: boolean; w?: number; h?: number }) {
  const seats = cell.seats ?? 4;
  const cx  = BASE * w / 2;
  const cy  = BASE * h / 2;
  const trx = Math.round(BASE * w * 0.33);
  const try_= Math.round(BASE * h * 0.23);
  const rx  = Math.round(BASE * w * 0.43);
  const ry  = Math.round(BASE * h * 0.33);
  const cS  = Math.max(5, Math.round(BASE * Math.min(w,h) * 0.23));
  const fS  = Math.max(6, Math.round(BASE * Math.min(w,h) * 0.22));
  return (
    <div style={{ width:BASE*w, height:BASE*h, position:"relative", opacity:ghost?0.5:1, pointerEvents:"none" }}>
      {Array.from({length:seats}).map((_,i)=>{ const a=(i*2*Math.PI/seats)-Math.PI/2;
        return <div key={i} className="absolute rounded-full" style={{width:cS,height:cS,background:"#92400e",boxShadow:"0 1px 2px rgba(0,0,0,0.25)",left:cx+rx*Math.cos(a)-cS/2,top:cy+ry*Math.sin(a)-cS/2}}/>; })}
      <div className="absolute flex items-center justify-center"
        style={{left:cx-trx,top:cy-try_,width:trx*2,height:try_*2,borderRadius:"50%",background:"linear-gradient(135deg,#fef3c7,#fde68a)",border:"1.5px solid #d97706"}}>
        <span className="font-black text-amber-900" style={{fontSize:fS}}>{cell.tableNumber||"?"}</span>
      </div>
    </div>
  );
}
function TableCellVisual({ cell, ghost, w = 1, h = 1 }: { cell: Cell; ghost?: boolean; w?: number; h?: number }) {
  const s = cell.tableShape ?? "square";
  if (s==="round") return <RoundTableVisual cell={cell} ghost={ghost} w={w} h={h}/>;
  if (s==="oval")  return <OvalTableVisual  cell={cell} ghost={ghost} w={w} h={h}/>;
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

/* ── Palette draggable item ── */
type DragKind =
  | { from: "palette"; kind: "table"; shape: TableShape }
  | { from: "palette"; kind: "bar" }
  | { from: "palette"; kind: "wall" }
  | { from: "grid"; kind: "table"; cell: Cell }
  | { from: "grid"; kind: "bar"; group: Cell[]; draggedCell: Cell };

/* ── Main ── */
export default function LayoutClient({ restaurants }: { restaurants: Restaurant[] }) {
  const [restaurantId, setRestaurantId] = useState(restaurants[0]?.id ?? "");
  const [cellMap, setCellMap]           = useState<Map<string,Cell>>(new Map());
  const [cellPx, setCellPx]             = useState(BASE);

  const [editTable, setEditTable] = useState<{r:number;c:number}|null>(null);
  const [tableForm, setTableForm] = useState({ tableNumber:"", seats:"4", shape:"square" as TableShape, w:"2", h:"1" });
  const [editBar, setEditBar]     = useState<{r:number;c:number}|null>(null);
  const [barForm, setBarForm]     = useState({ barLabel:"", barSeats:"4", barSide:"top" as BarSide, barLength:"4" });

  const [wallMode, setWallMode]   = useState(false);
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [loading, setLoading]     = useState(false);
  const [copied, setCopied]       = useState(false);
  const [origin, setOrigin]       = useState("");
  const [dragOverCell, setDragOverCell] = useState<{r:number;c:number}|null>(null);

  const dragKind  = useRef<DragKind|null>(null);
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

  const barStoolsMap = useMemo(() => {
    const visited = new Set<string>();
    const result  = new Map<string,number>();
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

  function paintBarCells(map: Map<string,Cell>, cells: {r:number;c:number}[], side: BarSide, seats: number, label: string) {
    for (const {r,c} of cells) {
      map.set(cellKey(r,c), { r, c, type:"bar", barSide:side, barGroupSeats:seats, barLabel:label });
    }
  }

  /* ── Grid cell handlers ── */
  function handleCellClick(r: number, c: number) {
    const key  = cellKey(r, c);
    const cell = cellMap.get(key);

    if (wallMode) {
      setCellMap(prev => {
        const next = new Map(prev);
        if (cell?.type === "wall") next.delete(key);
        else next.set(key, {r,c,type:"wall"});
        return next;
      });
      return;
    }

    if (cell?.type === "table") {
      setTableForm({ tableNumber:cell.tableNumber??"", seats:String(cell.seats??4), shape:cell.tableShape??"square", w:String(cell.tableW??1), h:String(cell.tableH??1) });
      setEditTable({r, c});
      return;
    }
    if (cell?.type === "table-part") {
      const anchor = cellMap.get(cellKey(cell.anchorR!, cell.anchorC!));
      if (anchor) {
        setTableForm({ tableNumber:anchor.tableNumber??"", seats:String(anchor.seats??4), shape:anchor.tableShape??"square", w:String(anchor.tableW??1), h:String(anchor.tableH??1) });
        setEditTable({r:anchor.r, c:anchor.c});
      }
      return;
    }
    if (cell?.type === "bar") {
      const group = findBarGroup(r, c, cellMap);
      const canon = group[0];
      setBarForm({ barLabel:canon.barLabel??"", barSeats:String(canon.barGroupSeats||group.length*2), barSide:canon.barSide??"top", barLength:String(group.length) });
      setEditBar({r, c});
      return;
    }
  }

  function handleCellDragOver(e: React.DragEvent, r: number, c: number) {
    e.preventDefault();
    setDragOverCell({r, c});
  }

  function handleCellDrop(e: React.DragEvent, r: number, c: number) {
    e.preventDefault();
    setDragOverCell(null);
    const dk = dragKind.current;
    if (!dk) return;
    dragKind.current = null;

    if (dk.from === "palette") {
      if (dk.kind === "table") {
        const seats = 4;
        const { w, h } = getDefaultTableSize(seats, dk.shape);
        setCellMap(prev => { const next=new Map(prev); placeTable(next,r,c,{tableNumber:"",seats,tableShape:dk.shape,tableW:w,tableH:h}); return next; });
        setTableForm({ tableNumber:"", seats:String(seats), shape:dk.shape, w:String(w), h:String(h) });
        setEditTable({r, c});
      } else if (dk.kind === "bar") {
        const defaultLen = 4;
        const cells = Array.from({length:defaultLen}, (_,i) => ({r, c:c+i})).filter(p=>p.c<COLS);
        setCellMap(prev => { const next=new Map(prev); paintBarCells(next,cells,"top",cells.length*2,""); return next; });
        setBarForm({ barLabel:"", barSeats:String(cells.length*2), barSide:"top", barLength:String(cells.length) });
        setEditBar({r, c});
      } else if (dk.kind === "wall") {
        setCellMap(prev => { const next=new Map(prev); next.set(cellKey(r,c),{r,c,type:"wall"}); return next; });
      }
    } else if (dk.from === "grid") {
      if (dk.kind === "table") {
        const src = dk.cell;
        setCellMap(prev => {
          const next = new Map(prev);
          removeTable(next, src.r, src.c);
          placeTable(next, r, c, { tableNumber:src.tableNumber, seats:src.seats, tableShape:src.tableShape, tableW:src.tableW, tableH:src.tableH });
          return next;
        });
      } else if (dk.kind === "bar") {
        const { group, draggedCell } = dk;
        const dr = r - draggedCell.r;
        const dc = c - draggedCell.c;
        const newCells = group.map(gc => ({r:gc.r+dr, c:gc.c+dc}));
        const valid = newCells.every(nc => nc.r>=0&&nc.r<ROWS&&nc.c>=0&&nc.c<COLS);
        if (!valid) return;
        setCellMap(prev => {
          const next = new Map(prev);
          for (const gc of group) next.delete(cellKey(gc.r, gc.c));
          for (let i=0; i<newCells.length; i++) {
            const nc = newCells[i]; const gc = group[i];
            next.set(cellKey(nc.r,nc.c), {...gc, r:nc.r, c:nc.c});
          }
          return next;
        });
      }
    }
  }

  function handleCellDragStart(e: React.DragEvent, r: number, c: number) {
    const cell = cellMap.get(cellKey(r, c));
    if (!cell) { e.preventDefault(); return; }
    e.dataTransfer.effectAllowed = "move";
    if (cell.type === "table") {
      dragKind.current = { from:"grid", kind:"table", cell };
    } else if (cell.type === "table-part") {
      const anchor = cellMap.get(cellKey(cell.anchorR!, cell.anchorC!));
      if (anchor) dragKind.current = { from:"grid", kind:"table", cell:anchor };
    } else if (cell.type === "bar") {
      const group = findBarGroup(r, c, cellMap);
      dragKind.current = { from:"grid", kind:"bar", group, draggedCell:cell };
    } else { e.preventDefault(); }
  }

  const commitDragEnd = useCallback(() => {
    dragKind.current = null;
    setDragOverCell(null);
  }, []);

  /* ── Save helpers ── */
  function saveTableEdit() {
    if (!editTable) return;
    const seats=parseInt(tableForm.seats)||4;
    const w=parseInt(tableForm.w)||1;
    const h=parseInt(tableForm.h)||1;
    setCellMap(prev => { const next=new Map(prev); removeTable(next,editTable.r,editTable.c); placeTable(next,editTable.r,editTable.c,{tableNumber:tableForm.tableNumber,seats,tableShape:tableForm.shape,tableW:w,tableH:h}); return next; });
    setEditTable(null);
  }

  function deleteTable() {
    if (!editTable) return;
    setCellMap(prev => { const next=new Map(prev); removeTable(next,editTable.r,editTable.c); return next; });
    setEditTable(null);
  }

  function saveBarEdit() {
    if (!editBar) return;
    const group = findBarGroup(editBar.r, editBar.c, cellMap);
    const totalSeats   = parseInt(barForm.barSeats) || group.length * 2;
    const side         = barForm.barSide;
    const desiredLength = Math.max(1, parseInt(barForm.barLength) || group.length);

    const sorted = [...group].sort((a, b) =>
      (side === "left" || side === "right") ? (a.r - b.r || a.c - b.c) : (a.c - b.c || a.r - b.r)
    );
    const anchor = sorted[0];

    setCellMap(prev => {
      const next = new Map(prev);
      for (const c of group) next.delete(cellKey(c.r, c.c));
      for (let i = 0; i < desiredLength; i++) {
        const nr = (side === "left" || side === "right") ? anchor.r + i : anchor.r;
        const nc = (side === "top"  || side === "bottom") ? anchor.c + i : anchor.c;
        if (nr>=0&&nr<ROWS&&nc>=0&&nc<COLS)
          next.set(cellKey(nr,nc), { r:nr, c:nc, type:"bar", barSide:side, barGroupSeats:totalSeats, barLabel:barForm.barLabel });
      }
      return next;
    });
    setEditBar(null);
  }

  function deleteBar() {
    if (!editBar) return;
    const group = findBarGroup(editBar.r, editBar.c, cellMap);
    setCellMap(prev => { const next=new Map(prev); for (const c of group) next.delete(cellKey(c.r,c.c)); return next; });
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
  const tableCount    = Array.from(cellMap.values()).filter(c=>c.type==="table").length;
  const totalSeatsAll = Array.from(cellMap.values()).filter(c=>c.type==="table").reduce((s,c)=>s+(c.seats??4),0);

  /* ── Drag ghost cell for drop preview ── */
  const ghostCell = dragKind.current?.from === "grid" && dragOverCell
    ? (dragKind.current.kind === "table" ? dragKind.current.cell : null)
    : null;

  return (
    <div className="p-4 md:p-6" onMouseUp={()=>{isPainting.current=false;}} onDragEnd={commitDragEnd}>
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">🗺 פריסת שולחנות</h1>
        <p className="text-gray-500 mt-0.5 text-sm">גרור פריטים מהפלטה אל הגריד · לחץ על אובייקט קיים לעריכה</p>
      </div>

      {/* ── Restaurant selector + action buttons ── */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {restaurants.length > 1 && (
          <select value={restaurantId} onChange={e=>handleRestaurantChange(e.target.value)}
            className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400">
            {restaurants.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        )}
        <div className="mr-auto flex gap-2">
          <button onClick={clearAll} className="px-3 py-2 text-sm rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-red-50 hover:text-red-600">נקה הכל</button>
          <button onClick={saveLayout} disabled={saving||!restaurantId} className="px-4 py-2 text-sm font-semibold rounded-xl text-white disabled:opacity-50" style={{background:"linear-gradient(135deg,#8B6914,#C9A84C)"}}>
            {saving?"שומר...":saved?"✓ נשמר!":"שמור פריסה"}
          </button>
        </div>
      </div>

      {/* ── Palette ── */}
      <div className="flex flex-wrap items-center gap-2 p-3 mb-4 rounded-2xl border border-amber-200 bg-amber-50/60">
        <span className="text-xs font-bold text-amber-800 ml-1">גרור לגריד:</span>

        {TABLE_SHAPES.map(({ shape, label }) => (
          <div key={shape}
            draggable
            onDragStart={e => { e.dataTransfer.effectAllowed="copy"; dragKind.current={from:"palette",kind:"table",shape}; }}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-amber-200 rounded-xl cursor-grab hover:border-amber-400 hover:shadow-sm select-none text-xs font-semibold text-amber-900 transition-all active:opacity-60"
            title={`גרור לגריד להוספת שולחן ${label}`}
          >
            {label}
          </div>
        ))}

        <div
          draggable
          onDragStart={e => { e.dataTransfer.effectAllowed="copy"; dragKind.current={from:"palette",kind:"bar"}; }}
          className="flex items-center gap-1.5 px-3 py-2 bg-white border border-orange-200 rounded-xl cursor-grab hover:border-orange-400 hover:shadow-sm select-none text-xs font-semibold text-orange-900 transition-all active:opacity-60"
          title="גרור לגריד להוספת בר (4 תאים ברירת מחדל)"
        >
          🍺 בר
        </div>

        <div className="w-px h-7 bg-amber-200 mx-1" />

        <button
          onClick={() => setWallMode(w => !w)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${wallMode ? "text-white border-gray-600" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}
          style={wallMode ? { background: "#374151" } : undefined}
          title="לחץ להפעלת מצב צביעת קיר — לחץ/גרור על התאים לצביעה"
        >
          🧱 קיר {wallMode ? "(פעיל — לחץ לצביעה)" : ""}
        </button>
      </div>

      <div className="flex gap-3 mb-3 text-xs text-gray-500">
        <span>{tableCount} שולחנות · {totalSeatsAll} מושבים</span>
        <span className="text-gray-300">|</span>
        <span className="text-gray-400">{COLS}×{ROWS} · {cellPx}px/תא</span>
      </div>

      {loading ? <div className="flex items-center justify-center h-64 text-gray-400">טוען...</div> : (
        <div ref={gridRef} className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-auto p-2">
          <div
            className="grid select-none"
            style={{ gridTemplateColumns:`repeat(${COLS}, ${cellPx}px)`, gap:1, width:"fit-content" }}
            onMouseLeave={() => { isPainting.current=false; }}
          >
            {(() => {
              const els = [];
              for (let r=0; r<ROWS; r++) {
                for (let c=0; c<COLS; c++) {
                  if (skipSet.has(cellKey(r,c))) continue;
                  const cell = cellMap.get(cellKey(r,c));
                  const isTable = cell?.type==="table";
                  const isWall  = cell?.type==="wall";
                  const isBar   = cell?.type==="bar";
                  const isPart  = cell?.type==="table-part";
                  const isDraggableCell = isTable || isPart || isBar;
                  const w = isTable ? (cell!.tableW??1) : 1;
                  const h = isTable ? (cell!.tableH??1) : 1;
                  const pxW = cellPx*w+(w-1);
                  const pxH = cellPx*h+(h-1);
                  const stools = isBar ? (barStoolsMap.get(cellKey(r,c))??0) : 0;
                  const isDropTarget = dragOverCell?.r===r && dragOverCell?.c===c;

                  els.push(
                    <div key={`${r}-${c}`}
                      draggable={isDraggableCell}
                      style={{
                        gridColumn: w>1 ? `span ${w}` : undefined,
                        gridRow:    h>1 ? `span ${h}` : undefined,
                        width: pxW, height: pxH, position:"relative",
                        background: isTable||isWall||isBar ? "transparent" : "#f8f9fa",
                        border: isWall||isBar ? "none" : "1px solid #e9ecef",
                        cursor: isDraggableCell ? "grab" : wallMode ? "crosshair" : "default",
                        outline: isDropTarget ? "2px solid #3b82f6" : undefined,
                        outlineOffset: "-1px",
                      }}
                      onDragStart={e => handleCellDragStart(e, r, c)}
                      onDragOver={e => handleCellDragOver(e, r, c)}
                      onDrop={e => handleCellDrop(e, r, c)}
                      onDragLeave={() => setDragOverCell(null)}
                      onDragEnd={commitDragEnd}
                      onClick={() => handleCellClick(r, c)}
                      onMouseDown={() => { if (wallMode) isPainting.current=true; }}
                      onMouseEnter={() => {
                        if (isPainting.current && wallMode) {
                          setCellMap(prev => { const next=new Map(prev); next.set(cellKey(r,c),{r,c,type:"wall"}); return next; });
                        }
                      }}
                    >
                      {(isWall||isBar||isTable||isDropTarget) && (
                        <div style={{ position:"absolute", left:0, top:0, width:BASE*w, height:BASE*h, transform:`scale(${scale})`, transformOrigin:"top left", pointerEvents:"none" }}>
                          {isWall  && <WallCellVisual  r={r} c={c} cellMap={cellMap}/>}
                          {isBar   && <BarCellVisual   r={r} c={c} cell={cell!} cellMap={cellMap}/>}
                          {isTable && <TableCellVisual cell={cell!} w={w} h={h}/>}
                          {isDropTarget && ghostCell && !isTable &&
                            <TableCellVisual cell={{...ghostCell,r,c}} ghost w={ghostCell.tableW??1} h={ghostCell.tableH??1}/>}
                        </div>
                      )}
                      {/* Bar stools — outside scaled wrapper */}
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
        const tableUrl = tableForm.tableNumber && restaurantId && origin
          ? `${origin}/menu/${restaurantId}?table=${encodeURIComponent(tableForm.tableNumber)}` : null;
        return (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={()=>setEditTable(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 overflow-y-auto max-h-[90vh]" onClick={e=>e.stopPropagation()}>
              <h3 className="text-lg font-bold text-gray-900 mb-4">✏️ הגדרת שולחן</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">מספר / שם שולחן</label>
                  <input type="text" value={tableForm.tableNumber} onChange={e=>setTableForm(f=>({...f,tableNumber:e.target.value}))} placeholder="1, A3, בר..." autoFocus
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">צורת שולחן</label>
                  <div className="flex gap-2">
                    {TABLE_SHAPES.map(({shape,label})=>(
                      <button key={shape} type="button" onClick={()=>{
                        const seats=parseInt(tableForm.seats)||4;
                        const def=getDefaultTableSize(seats, shape);
                        setTableForm(f=>({...f,shape,w:String(def.w),h:String(def.h)}));
                      }}
                        className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors ${tableForm.shape===shape?"border-amber-400 text-white":"border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                        style={tableForm.shape===shape?{background:"linear-gradient(135deg,#8B6914,#C9A84C)"}:undefined}>{label}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">מספר כסאות</label>
                  <div className="flex gap-2">
                    {[2,4,6,8,10].map(n=>{
                      const def=getDefaultTableSize(n, tableForm.shape);
                      return <button key={n} type="button" onClick={()=>setTableForm(f=>({...f,seats:String(n),w:String(def.w),h:String(def.h)}))}
                        className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors ${tableForm.seats===String(n)?"border-amber-400 text-white":"border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                        style={tableForm.seats===String(n)?{background:"linear-gradient(135deg,#8B6914,#C9A84C)"}:undefined}>{n}</button>;
                    })}
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-700">גודל על המפה (תאים)</label>
                    <button type="button"
                      onClick={()=>setTableForm(f=>({...f, w:f.h, h:f.w}))}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors"
                      title="סובב שולחן — מחליף רוחב וגובה">
                      ↺ סובב
                    </button>
                  </div>
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
                <button onClick={deleteTable} className="px-4 py-2.5 rounded-xl text-red-600 bg-red-50 hover:bg-red-100 text-sm font-semibold">🗑 מחק</button>
                <button onClick={()=>setEditTable(null)} className="px-4 py-2.5 rounded-xl bg-gray-100 text-gray-600 text-sm">ביטול</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Bar edit dialog ── */}
      {editBar && (() => {
        const group = findBarGroup(editBar.r, editBar.c, cellMap);
        const currentLength = group.length;
        return (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={()=>setEditBar(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e=>e.stopPropagation()}>
              <h3 className="text-lg font-bold text-gray-900 mb-1">🍺 הגדרת בר</h3>
              <p className="text-xs text-gray-400 mb-4">נוכחי: {currentLength} תאים · ההגדרות חלות על כולם</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">שם הבר</label>
                  <input type="text" value={barForm.barLabel} onChange={e=>setBarForm(f=>({...f,barLabel:e.target.value}))} placeholder="בר, סושי בר..." autoFocus
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400"/>
                </div>

                {/* Bar length */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">אורך הבר (תאים)</label>
                  <div className="flex items-center gap-3">
                    <button type="button"
                      onClick={()=>setBarForm(f=>({...f,barLength:String(Math.max(1,parseInt(f.barLength||"1")-1))})) }
                      className="w-9 h-9 rounded-xl text-lg font-bold border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700 transition-colors">−</button>
                    <span className="text-2xl font-black text-amber-800 w-8 text-center">{barForm.barLength}</span>
                    <button type="button"
                      onClick={()=>setBarForm(f=>({...f,barLength:String(Math.min(20,parseInt(f.barLength||"1")+1))})) }
                      className="w-9 h-9 rounded-xl text-lg font-bold border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700 transition-colors">+</button>
                    <span className="text-xs text-gray-400">תאים (1–20)</span>
                  </div>
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
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">כיוון / סיבוב</label>
                  <div className="grid grid-cols-2 gap-2">
                    {BAR_SIDES.map(({side,label})=>(
                      <button key={side} type="button" onClick={()=>setBarForm(f=>({...f,barSide:side}))}
                        className={`py-2.5 rounded-xl text-sm font-semibold border transition-colors ${barForm.barSide===side?"border-amber-400 text-white":"border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                        style={barForm.barSide===side?{background:"linear-gradient(135deg,#78350f,#92400e)"}:undefined}>{label}</button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">כיוון הכסאות ביחס לבר</p>
                </div>
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={saveBarEdit} className="flex-1 py-2.5 rounded-xl text-white font-semibold text-sm" style={{background:"linear-gradient(135deg,#78350f,#92400e)"}}>שמור</button>
                <button onClick={deleteBar} className="px-4 py-2.5 rounded-xl text-red-600 bg-red-50 hover:bg-red-100 text-sm font-semibold">🗑 מחק</button>
                <button onClick={()=>setEditBar(null)} className="px-4 py-2.5 rounded-xl bg-gray-100 text-gray-600 text-sm">ביטול</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
