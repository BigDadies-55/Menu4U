"use client";

import React, { useState, useRef, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";

/* ── Types ── */
type TableStatus = "available" | "occupied" | "reserved" | "unavailable";
type TableShape  = "square" | "round" | "oval" | "rectangle";
type ToolMode    = "table" | "booth" | "bar" | "stats" | "bg" | "save" | null;

type FreeTable = {
  id: string;
  tableNumber: string;
  seats: number;
  shape: TableShape;
  x: number; y: number;
  width: number; height: number;
  rotation: number;
  status: TableStatus;
  kind?: "table" | "booth" | "bar";
};

type Room = {
  id: string; name: string;
  tables: FreeTable[];
  background: "grid" | "dots" | "plain";
};

type LayoutV2 = { version: 2; rooms: Room[] };
type Restaurant = { id: string; name: string };

type ResizeInfo = {
  handle: string; tableId: string;
  startMX: number; startMY: number;
  startX: number;  startY: number;
  startW: number;  startH: number;
  rotation: number;
};

/* ── Status ── */
const STATUS: Record<TableStatus, { label: string; color: string; bg: string }> = {
  available:   { label: "פנוי",    color: "#51cf66", bg: "rgba(81,207,102,0.13)" },
  occupied:    { label: "תפוס",    color: "#ff6b6b", bg: "rgba(255,107,107,0.13)" },
  reserved:    { label: "שמור",    color: "#fcc419", bg: "rgba(252,196,25,0.13)" },
  unavailable: { label: "לא זמין", color: "#868e96", bg: "rgba(134,142,150,0.13)" },
};

const C = {
  pageBg:"#1a1d23", cardBg:"#212529", cnvBg:"#181b20",
  border:"#2d3239", inBg:"#2d3239", inBrd:"#3a3f47",
  text:"#e9ecef", sub:"#adb5bd", muted:"#6c757d",
  amber:"#fcc419", gold:"#C9A84C", red:"#ff6b6b", green:"#51cf66",
  brd:"#5a0a1a",   // bordeaux
} as const;

const DK_INPUT: React.CSSProperties = {
  background:C.inBg, border:`1px solid ${C.inBrd}`, color:C.text,
  borderRadius:10, padding:"9px 13px", fontSize:14, width:"100%",
  outline:"none", fontFamily:"inherit",
};

const CANVAS_W = 1600;
const CANVAS_H = 1000;

const DEFAULT_SIZES: Record<TableShape, { w:number; h:number }> = {
  square:{w:80,h:80}, round:{w:80,h:80}, oval:{w:120,h:80}, rectangle:{w:120,h:70},
};

const SHAPES: { shape:TableShape; label:string }[] = [
  { shape:"square",    label:"מרובע"  },
  { shape:"round",     label:"עגול"   },
  { shape:"oval",      label:"אובלי"  },
  { shape:"rectangle", label:"מלבן"   },
];

const HANDLE_CURSORS: Record<string,string> = {
  nw:"nw-resize", n:"n-resize", ne:"ne-resize",
  e:"e-resize",  se:"se-resize", s:"s-resize",
  sw:"sw-resize", w:"w-resize",
};

function uid() { return Math.random().toString(36).slice(2,10); }
function mkRoom(name="חדר ראשי"): Room { return {id:uid(),name,tables:[],background:"grid"}; }
function mkTable(x:number,y:number,shape:TableShape="square",kind:FreeTable["kind"]="table"): FreeTable {
  const {w,h}=DEFAULT_SIZES[shape];
  return {id:uid(),tableNumber:"",seats:4,shape,x,y,width:w,height:h,rotation:0,status:"available",kind};
}
function emptyLayout(): LayoutV2 { return {version:2,rooms:[mkRoom()]}; }

/* ── SVG Icons for toolbar ── */
const IconTable = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
    <rect x="3" y="8" width="16" height="10" rx="2" fill="#C9A84C" opacity="0.9"/>
    <rect x="6" y="4" width="10" height="5" rx="1.5" fill="#fcc419"/>
    <rect x="5" y="17" width="3" height="3" rx="1" fill="#C9A84C"/>
    <rect x="14" y="17" width="3" height="3" rx="1" fill="#C9A84C"/>
  </svg>
);
const IconBooth = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
    <rect x="2" y="4" width="5" height="14" rx="2" fill="#c0392b"/>
    <rect x="15" y="4" width="5" height="14" rx="2" fill="#c0392b"/>
    <rect x="5" y="8" width="12" height="8" rx="2" fill="#922b21"/>
  </svg>
);
const IconBar = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
    <rect x="2" y="10" width="18" height="5" rx="2" fill="#8B4513"/>
    <rect x="3" y="14" width="3" height="6" rx="1" fill="#6B3410"/>
    <rect x="9.5" y="14" width="3" height="6" rx="1" fill="#6B3410"/>
    <rect x="16" y="14" width="3" height="6" rx="1" fill="#6B3410"/>
    <rect x="2" y="7" width="18" height="4" rx="1.5" fill="#A0522D" opacity="0.7"/>
  </svg>
);
const IconStats = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
    <rect x="2"  y="13" width="4" height="7" rx="1" fill="#51cf66"/>
    <rect x="8"  y="9"  width="4" height="11" rx="1" fill="#fcc419"/>
    <rect x="14" y="5"  width="4" height="15" rx="1" fill="#ff6b6b"/>
    <rect x="1"  y="20" width="20" height="1.5" rx="0.5" fill="#6c757d"/>
  </svg>
);
const IconGrid = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
    <rect x="2" y="2" width="7" height="7" rx="1.5" fill="#fcc419" opacity="0.7"/>
    <rect x="13" y="2" width="7" height="7" rx="1.5" fill="#fcc419" opacity="0.5"/>
    <rect x="2" y="13" width="7" height="7" rx="1.5" fill="#fcc419" opacity="0.5"/>
    <rect x="13" y="13" width="7" height="7" rx="1.5" fill="#fcc419" opacity="0.7"/>
  </svg>
);
const IconSave = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
    <path d="M13 2 L18 10 L14 10 L14 20 L8 20 L8 10 L4 10 Z" fill="#fcc419"/>
  </svg>
);

const TOOLBAR_ITEMS: { id:ToolMode; Icon:React.FC; label:string }[] = [
  { id:"table",  Icon:IconTable,  label:"שולחן"  },
  { id:"booth",  Icon:IconBooth,  label:"תא ישיבה" },
  { id:"bar",    Icon:IconBar,    label:"בר"     },
  { id:"stats",  Icon:IconStats,  label:"סטטס"   },
  { id:"bg",     Icon:IconGrid,   label:"רקע"    },
  { id:"save",   Icon:IconSave,   label:"שמור"   },
];

/* ── Chair visuals ── */
function ChairsRound({ w, h, seats }: { w:number; h:number; seats:number }) {
  const pad=14, cSz=10;
  return <>
    {Array.from({length:seats}).map((_,i) => {
      const a=(i/seats)*2*Math.PI - Math.PI/2;
      return <div key={i} style={{ position:"absolute", width:cSz, height:cSz, borderRadius:"50%", background:"#92400e", boxShadow:"0 1px 2px rgba(0,0,0,0.3)", left:w/2+(w/2+pad)*Math.cos(a)-cSz/2, top:h/2+(h/2+pad)*Math.sin(a)-cSz/2, pointerEvents:"none" }} />;
    })}
  </>;
}
function ChairsRect({ w, h, seats }: { w:number; h:number; seats:number }) {
  const gap=5, cW=10, cH=7;
  const top=Math.ceil(seats/2), bot=Math.floor(seats/2);
  const els: React.ReactNode[] = [];
  for (let i=0;i<top;i++) els.push(<div key={`t${i}`} style={{ position:"absolute", width:cW, height:cH, left:(w/(top+1))*(i+1)-cW/2, top:-cH-gap, borderRadius:2, background:"#92400e", pointerEvents:"none" }} />);
  for (let i=0;i<bot;i++) els.push(<div key={`b${i}`} style={{ position:"absolute", width:cW, height:cH, left:(w/(bot+1))*(i+1)-cW/2, top:h+gap, borderRadius:2, background:"#92400e", pointerEvents:"none" }} />);
  return <>{els}</>;
}

/* ── Resize handles ── */
function ResizeHandles({ w, h, onHMD }: { w:number; h:number; onHMD:(e:React.MouseEvent,h:string)=>void }) {
  return <>
    {[["nw",-5,-5],["n",w/2-5,-5],["ne",w-5,-5],["e",w-5,h/2-5],["se",w-5,h-5],["s",w/2-5,h-5],["sw",-5,h-5],["w",-5,h/2-5]].map(([id,l,t]) => (
      <div key={id as string} onMouseDown={e=>onHMD(e,id as string)} style={{ position:"absolute", width:10, height:10, left:l as number, top:t as number, background:C.amber, borderRadius:2, border:"1.5px solid #fff", zIndex:30, cursor:HANDLE_CURSORS[id as string] }} />
    ))}
  </>;
}

/* ── Mini shape preview for palette ── */
function ShapeChip({ shape }: { shape:TableShape }) {
  const isR = shape==="round"||shape==="oval";
  const w = shape==="oval"||shape==="rectangle" ? 44 : 34;
  return (
    <div style={{ width:w, height:30, borderRadius:isR?"50%":6, background:`linear-gradient(135deg,${C.amber}28,${C.gold}18)`, border:`1.5px solid ${C.gold}60`, flexShrink:0 }} />
  );
}

/* ── Table visual ── */
function TableVisual({ table, selected, onMD, onClick, onDbl, onCtx, onRMD }: {
  table:FreeTable; selected:boolean;
  onMD:(e:React.MouseEvent)=>void;
  onClick:(e:React.MouseEvent)=>void;
  onDbl:(e:React.MouseEvent)=>void;
  onCtx:(e:React.MouseEvent)=>void;
  onRMD:(e:React.MouseEvent,h:string)=>void;
}) {
  const {width:w,height:h,shape,status,tableNumber,seats,rotation,kind="table"} = table;
  const st = STATUS[status];
  const isRound = shape==="round"||shape==="oval";
  const br = isRound ? "50%" : kind==="bar" ? 4 : 10;
  const fSz = Math.max(10, Math.min(w,h)*0.22);
  const isBooth = kind==="booth";
  const isBar   = kind==="bar";

  /* Bar appearance */
  if (isBar) {
    return (
      <div onMouseDown={onMD} onClick={onClick} onDoubleClick={onDbl} onContextMenu={onCtx} style={{ position:"absolute", left:table.x, top:table.y, width:w, height:h, transform:`rotate(${rotation}deg)`, transformOrigin:"center", cursor:"grab", userSelect:"none", zIndex:selected?10:2 }}>
        {selected && <div style={{ position:"absolute", inset:-6, borderRadius:6, border:`2px dashed ${C.amber}`, boxShadow:`0 0 14px ${C.amber}55`, pointerEvents:"none" }} />}
        <div style={{ position:"absolute", inset:0, borderRadius:4, background:"linear-gradient(135deg,#5c2a0e,#78350f)", border:`2px solid #92400e`, boxShadow:selected?`0 0 0 2px ${C.amber},0 6px 24px rgba(0,0,0,0.45)`:"0 3px 12px rgba(0,0,0,0.35)", display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden" }}>
          <div style={{ position:"absolute", top:0, left:0, right:0, height:"40%", background:"linear-gradient(180deg,rgba(255,255,255,0.06) 0%,transparent 100%)", pointerEvents:"none" }} />
          <span style={{ fontSize:Math.max(10,Math.min(w,h)*0.2), fontWeight:900, color:"#fde68a", zIndex:1 }}>{tableNumber||"בר"}</span>
        </div>
        {selected && <ResizeHandles w={w} h={h} onHMD={onRMD} />}
      </div>
    );
  }

  /* Booth appearance */
  if (isBooth) {
    return (
      <div onMouseDown={onMD} onClick={onClick} onDoubleClick={onDbl} onContextMenu={onCtx} style={{ position:"absolute", left:table.x, top:table.y, width:w, height:h, transform:`rotate(${rotation}deg)`, transformOrigin:"center", cursor:"grab", userSelect:"none", zIndex:selected?10:2 }}>
        {selected && <div style={{ position:"absolute", inset:-6, borderRadius:14, border:`2px dashed ${C.amber}`, boxShadow:`0 0 14px ${C.amber}55`, pointerEvents:"none" }} />}
        <div style={{ position:"absolute", inset:0, borderRadius:10, background:`linear-gradient(145deg,rgba(139,0,0,0.25),rgba(100,0,0,0.15))`, border:`2px solid rgba(139,0,0,0.45)`, boxShadow:selected?`0 0 0 2px ${C.amber},0 6px 24px rgba(0,0,0,0.45)`:"0 3px 12px rgba(0,0,0,0.35)", display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div style={{ width:"60%", height:"55%", borderRadius:6, background:"linear-gradient(135deg,#fef3c7,#fde68a)", border:`1.5px solid ${C.gold}`, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <span style={{ fontSize:fSz, fontWeight:900, color:"#92400e" }}>{tableNumber||"?"}</span>
          </div>
        </div>
        {selected && <ResizeHandles w={w} h={h} onHMD={onRMD} />}
      </div>
    );
  }

  /* Standard table */
  return (
    <div onMouseDown={onMD} onClick={onClick} onDoubleClick={onDbl} onContextMenu={onCtx} style={{ position:"absolute", left:table.x, top:table.y, width:w, height:h, transform:`rotate(${rotation}deg)`, transformOrigin:"center", cursor:"grab", userSelect:"none", zIndex:selected?10:2 }}>
      {selected && <div style={{ position:"absolute", inset:-6, borderRadius:isRound?"50%":15, border:`2px dashed ${C.amber}`, boxShadow:`0 0 14px ${C.amber}55`, pointerEvents:"none" }} />}
      <div style={{ position:"absolute", inset:0, pointerEvents:"none" }}>
        {isRound ? <ChairsRound w={w} h={h} seats={seats}/> : <ChairsRect w={w} h={h} seats={seats}/>}
      </div>
      <div style={{ position:"absolute", inset:0, borderRadius:br, background:`linear-gradient(145deg,${st.bg},${st.bg})`, border:`2px solid ${st.color}50`, boxShadow:selected?`0 0 0 2px ${C.amber},0 6px 24px rgba(0,0,0,0.45)`:"0 3px 12px rgba(0,0,0,0.35)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", overflow:"hidden" }}>
        <div style={{ position:"absolute", top:0, left:0, right:0, height:"45%", background:"linear-gradient(180deg,rgba(255,255,255,0.07) 0%,transparent 100%)", pointerEvents:"none" }} />
        <div style={{ position:"absolute", top:6, right:6, width:7, height:7, borderRadius:"50%", background:st.color, boxShadow:`0 0 6px ${st.color}`, pointerEvents:"none" }} />
        <span style={{ fontSize:fSz, fontWeight:900, color:C.text, lineHeight:1, zIndex:1 }}>{tableNumber||"?"}</span>
        <span style={{ fontSize:Math.max(8,Math.min(w,h)*0.13), color:C.sub, zIndex:1, marginTop:2 }}>{seats}</span>
      </div>
      {selected && <ResizeHandles w={w} h={h} onHMD={onRMD} />}
    </div>
  );
}

/* ── Minimap ── */
function Minimap({ room, panX, panY, zoom, vw, vh }: { room:Room|undefined; panX:number; panY:number; zoom:number; vw:number; vh:number }) {
  if (!room) return null;
  const MW=160, MH=100, sx=MW/CANVAS_W, sy=MH/CANVAS_H;
  return (
    <div style={{ position:"absolute", bottom:16, right:16, width:MW, height:MH, background:"rgba(24,27,32,0.97)", border:`1px solid ${C.border}`, borderRadius:8, overflow:"hidden", zIndex:100, boxShadow:"0 4px 20px rgba(0,0,0,0.5)" }}>
      {room.tables.map(t => (
        <div key={t.id} style={{ position:"absolute", left:t.x*sx, top:t.y*sy, width:Math.max(4,t.width*sx), height:Math.max(4,t.height*sy), background:STATUS[t.status].color+"80", borderRadius:t.shape==="round"||t.shape==="oval"?"50%":2, border:`1px solid ${STATUS[t.status].color}` }} />
      ))}
      <div style={{ position:"absolute", left:Math.max(0,Math.min(MW-10,(-panX/zoom)*sx)), top:Math.max(0,Math.min(MH-10,(-panY/zoom)*sy)), width:Math.min(MW,Math.max(10,(vw/zoom)*sx)), height:Math.min(MH,Math.max(10,(vh/zoom)*sy)), border:`1.5px solid ${C.amber}`, background:`${C.amber}18`, pointerEvents:"none", borderRadius:2 }} />
      <div style={{ position:"absolute", bottom:2, left:4, fontSize:9, color:C.muted, userSelect:"none" }}>{Math.round(zoom*100)}%</div>
    </div>
  );
}

const Lbl = ({ t }: { t:string }) => (
  <div style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".06em", marginBottom:6 }}>{t}</div>
);

/* ═══════════════════════════════════════════════ Main ══ */
export default function LayoutClient({ restaurants }: { restaurants:Restaurant[] }) {
  const [restaurantId, setRestaurantId] = useState(restaurants[0]?.id ?? "");
  const [layout, setLayout]   = useState<LayoutV2>(emptyLayout());
  const [roomIdx, setRoomIdx] = useState(0);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [loading, setLoading] = useState(false);
  const [origin, setOrigin]   = useState("");

  /* pan / zoom */
  const [panX, setPanX]   = useState(0);
  const [panY, setPanY]   = useState(0);
  const [zoom, setZoom]   = useState(1);
  const fitDone           = useRef(false);
  const isPanning         = useRef(false);
  const panStart          = useRef({ mx:0, my:0, px:0, py:0 });
  const containerRef      = useRef<HTMLDivElement>(null);
  const [vSize, setVSize] = useState({ w:900, h:560 });

  /* drag / resize / palette */
  const draggingId       = useRef<string|null>(null);
  const dragStart        = useRef({ mx:0, my:0, tx:0, ty:0 });
  const didDrag          = useRef(false);
  const resizing         = useRef<ResizeInfo|null>(null);
  const paletteDragShape = useRef<{ shape:TableShape; kind:FreeTable["kind"] }|null>(null);
  const spaceDown        = useRef(false);

  /* UI state */
  const [selId, setSelId]         = useState<string|null>(null);
  const [activeTool, setActiveTool] = useState<ToolMode>(null);
  const [ctxMenu, setCtxMenu]     = useState<{x:number;y:number;id:string}|null>(null);
  const [editId, setEditId]       = useState<string|null>(null);
  const [editForm, setEditForm]   = useState({ tableNumber:"", seats:"4", shape:"square" as TableShape, status:"available" as TableStatus, width:"80", height:"80", rotation:"0" });
  const [showStats, setShowStats] = useState(false);
  const [showNewRoom, setShowNewRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");

  useEffect(() => { setOrigin(window.location.origin); }, []);
  useEffect(() => { if (restaurants[0]?.id) loadLayout(restaurants[0].id); }, []); // eslint-disable-line

  /* Resize observer + fit-to-view on first measure */
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(es => {
      for (const e of es) {
        const w = e.contentRect.width, h = e.contentRect.height;
        setVSize({ w, h });
        if (!fitDone.current && w > 100 && h > 100) {
          fitDone.current = true;
          const z = Math.min(w / CANVAS_W, h / CANVAS_H) * 0.97;
          setZoom(z);
          setPanX((w - CANVAS_W * z) / 2);
          setPanY((h - CANVAS_H * z) / 2);
        }
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  async function loadLayout(rid:string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/restaurants/${rid}/layout`);
      if (res.ok) {
        const data = await res.json();
        if (data.tableLayoutJson) {
          const p = JSON.parse(data.tableLayoutJson);
          setLayout(p.version===2 ? p : emptyLayout());
        } else setLayout(emptyLayout());
      }
    } catch { setLayout(emptyLayout()); }
    setLoading(false);
  }

  async function saveLayout() {
    if (!restaurantId) return;
    setSaving(true);
    await fetch(`/api/admin/restaurants/${restaurantId}/layout`, {
      method:"PUT", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ tableLayoutJson: JSON.stringify(layout) }),
    });
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const activeRoom = layout.rooms[roomIdx] ?? layout.rooms[0];

  function updRoom(fn:(r:Room)=>Room) {
    setLayout(prev => ({ ...prev, rooms: prev.rooms.map((r,i) => i===roomIdx ? fn(r) : r) }));
  }

  function fitView() {
    const z = Math.min(vSize.w/CANVAS_W, vSize.h/CANVAS_H) * 0.97;
    setZoom(z); setPanX((vSize.w-CANVAS_W*z)/2); setPanY((vSize.h-CANVAS_H*z)/2);
  }

  /* ── Table ops ── */
  function spawnTable(x:number, y:number, shape:TableShape="square", kind:FreeTable["kind"]="table") {
    const t = mkTable(x, y, shape, kind);
    // booths/bars have different default sizes
    if (kind==="booth") { t.width=100; t.height=120; }
    if (kind==="bar")   { t.width=200; t.height=60;  }
    updRoom(r => ({ ...r, tables:[...r.tables, t] }));
    setSelId(t.id); openEdit(t);
  }

  function openEdit(table:FreeTable) {
    setEditId(table.id);
    setEditForm({ tableNumber:table.tableNumber, seats:String(table.seats), shape:table.shape, status:table.status, width:String(table.width), height:String(table.height), rotation:String(table.rotation) });
  }

  function saveEdit() {
    if (!editId) return;
    const w=Math.max(40,parseInt(editForm.width)||80), h=Math.max(40,parseInt(editForm.height)||80);
    updRoom(r => ({ ...r, tables: r.tables.map(t => t.id!==editId ? t : { ...t, tableNumber:editForm.tableNumber, seats:parseInt(editForm.seats)||4, shape:editForm.shape, status:editForm.status, width:w, height:h, rotation:parseInt(editForm.rotation)||0 }) }));
    setEditId(null);
  }

  function delTable(id:string) {
    updRoom(r => ({ ...r, tables: r.tables.filter(t=>t.id!==id) }));
    if (selId===id) setSelId(null);
    setEditId(null); setCtxMenu(null);
  }

  function dupTable(id:string) {
    const t = activeRoom?.tables.find(t=>t.id===id);
    if (!t) return;
    const nt:FreeTable = {...t, id:uid(), x:t.x+24, y:t.y+24};
    updRoom(r => ({ ...r, tables:[...r.tables, nt] }));
    setSelId(nt.id); setCtxMenu(null);
  }

  function setStatus(id:string, s:TableStatus) {
    updRoom(r => ({ ...r, tables: r.tables.map(t => t.id===id ? {...t,status:s} : t) }));
    setCtxMenu(null);
  }

  /* ── Tool click ── */
  function handleToolClick(id:ToolMode) {
    if (id==="stats")  { setShowStats(true); setActiveTool(null); return; }
    if (id==="save")   { saveLayout(); setActiveTool(null); return; }
    if (id==="bg")     { setActiveTool(prev => prev==="bg" ? null : "bg"); return; }
    if (id==="booth") {
      const cx=(vSize.w/2-panX)/zoom-50, cy=(vSize.h/2-panY)/zoom-60;
      spawnTable(Math.max(20,cx), Math.max(20,cy), "square", "booth");
      setActiveTool(null); return;
    }
    if (id==="bar") {
      const cx=(vSize.w/2-panX)/zoom-100, cy=(vSize.h/2-panY)/zoom-30;
      spawnTable(Math.max(20,cx), Math.max(20,cy), "rectangle", "bar");
      setActiveTool(null); return;
    }
    setActiveTool(prev => prev===id ? null : id);
  }

  /* ── Palette DnD ── */
  function handleCanvasDragOver(e:React.DragEvent) { e.preventDefault(); e.dataTransfer.dropEffect="copy"; }
  function handleCanvasDrop(e:React.DragEvent) {
    e.preventDefault();
    const pd = paletteDragShape.current;
    paletteDragShape.current = null;
    if (!pd) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const {w,h} = DEFAULT_SIZES[pd.shape];
    const cx = (e.clientX-rect.left-panX)/zoom - w/2;
    const cy = (e.clientY-rect.top -panY)/zoom - h/2;
    spawnTable(Math.max(0,cx), Math.max(0,cy), pd.shape, pd.kind ?? "table");
  }

  /* ── Resize ── */
  function handleResizeMD(e:React.MouseEvent, handle:string, table:FreeTable) {
    e.stopPropagation(); e.preventDefault();
    resizing.current = { handle, tableId:table.id, startMX:e.clientX, startMY:e.clientY, startX:table.x, startY:table.y, startW:table.width, startH:table.height, rotation:table.rotation };
  }

  /* ── Canvas mouse events ── */
  function handleWheel(e:React.WheelEvent) {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect(); if (!rect) return;
    const mx=e.clientX-rect.left, my=e.clientY-rect.top;
    const newZoom=Math.max(0.15,Math.min(4,zoom*(e.deltaY>0?0.88:1.12)));
    const ratio=newZoom/zoom;
    setPanX(mx-ratio*(mx-panX)); setPanY(my-ratio*(my-panY)); setZoom(newZoom);
  }

  function handleCanvasMD(e:React.MouseEvent) {
    if (e.button===1||(e.button===0&&spaceDown.current)) {
      e.preventDefault(); isPanning.current=true;
      panStart.current={mx:e.clientX,my:e.clientY,px:panX,py:panY};
    }
    if (e.button===0&&(e.target as HTMLElement).dataset.canvas==="bg") {
      setSelId(null); setCtxMenu(null); setActiveTool(null);
    }
  }

  function handleCanvasMM(e:React.MouseEvent) {
    if (isPanning.current) {
      setPanX(panStart.current.px+e.clientX-panStart.current.mx);
      setPanY(panStart.current.py+e.clientY-panStart.current.my);
    } else if (resizing.current) {
      const rv=resizing.current;
      const dx=(e.clientX-rv.startMX)/zoom, dy=(e.clientY-rv.startMY)/zoom;
      const rad=rv.rotation*Math.PI/180;
      const ldx= dx*Math.cos(rad)+dy*Math.sin(rad);
      const ldy=-dx*Math.sin(rad)+dy*Math.cos(rad);
      let nX=rv.startX,nY=rv.startY,nW=rv.startW,nH=rv.startH;
      if (rv.handle.includes("e")) nW=Math.max(40,rv.startW+ldx);
      if (rv.handle.includes("w")) { nW=Math.max(40,rv.startW-ldx); nX=rv.startX+(rv.startW-nW); }
      if (rv.handle.includes("s")) nH=Math.max(40,rv.startH+ldy);
      if (rv.handle.includes("n")) { nH=Math.max(40,rv.startH-ldy); nY=rv.startY+(rv.startH-nH); }
      updRoom(r => ({ ...r, tables: r.tables.map(t => t.id!==rv.tableId ? t : {...t,x:nX,y:nY,width:nW,height:nH}) }));
    } else if (draggingId.current) {
      didDrag.current=true;
      const dx=(e.clientX-dragStart.current.mx)/zoom, dy=(e.clientY-dragStart.current.my)/zoom;
      updRoom(r => ({ ...r, tables: r.tables.map(t => t.id!==draggingId.current ? t : {...t,x:dragStart.current.tx+dx,y:dragStart.current.ty+dy}) }));
    }
  }

  function handleCanvasMU() { isPanning.current=false; draggingId.current=null; resizing.current=null; }

  function handleTableMD(e:React.MouseEvent, table:FreeTable) {
    if (e.button!==0||spaceDown.current) return;
    e.stopPropagation();
    didDrag.current=false;
    draggingId.current=table.id;
    dragStart.current={mx:e.clientX,my:e.clientY,tx:table.x,ty:table.y};
    setSelId(table.id); setCtxMenu(null);
  }

  function handleTableClick(e:React.MouseEvent, id:string) { e.stopPropagation(); if(!didDrag.current) setSelId(id); }
  function handleTableDbl(e:React.MouseEvent, t:FreeTable) { e.stopPropagation(); openEdit(t); }
  function handleTableCtx(e:React.MouseEvent, id:string) { e.preventDefault(); e.stopPropagation(); setCtxMenu({x:e.clientX,y:e.clientY,id}); setSelId(id); }

  /* ── Keyboard ── */
  useEffect(() => {
    const dn=(e:KeyboardEvent)=>{
      if (e.code==="Space"&&!e.repeat) { spaceDown.current=true; if(containerRef.current) containerRef.current.style.cursor="grab"; }
      if (e.code==="Escape") { setCtxMenu(null); setSelId(null); setEditId(null); setActiveTool(null); }
    };
    const up=(e:KeyboardEvent)=>{
      if (e.code==="Space") { spaceDown.current=false; if(containerRef.current) containerRef.current.style.cursor="default"; }
    };
    window.addEventListener("keydown",dn); window.addEventListener("keyup",up);
    return () => { window.removeEventListener("keydown",dn); window.removeEventListener("keyup",up); };
  }, []);

  useEffect(() => {
    const fn=(e:KeyboardEvent)=>{
      if ((e.code==="Delete"||e.code==="Backspace")&&selId&&!editId) {
        const tag=(document.activeElement as HTMLElement)?.tagName;
        if (tag!=="INPUT"&&tag!=="TEXTAREA"&&tag!=="SELECT") delTable(selId);
      }
    };
    window.addEventListener("keydown",fn);
    return () => window.removeEventListener("keydown",fn);
  }, [selId,editId]); // eslint-disable-line

  /* ── Rooms ── */
  function addRoom() {
    if (!newRoomName.trim()) return;
    const r=mkRoom(newRoomName.trim());
    setLayout(prev=>({...prev,rooms:[...prev.rooms,r]}));
    setRoomIdx(layout.rooms.length);
    setShowNewRoom(false); setNewRoomName("");
  }
  function delRoom(idx:number) {
    if (layout.rooms.length<=1) return;
    if (!confirm(`למחוק את "${layout.rooms[idx].name}"?`)) return;
    setLayout(prev=>({...prev,rooms:prev.rooms.filter((_,i)=>i!==idx)}));
    setRoomIdx(prev=>Math.min(prev,layout.rooms.length-2));
  }

  const rs = activeRoom ? {
    total:activeRoom.tables.length,
    seats:activeRoom.tables.reduce((s,t)=>s+t.seats,0),
    available:activeRoom.tables.filter(t=>t.status==="available").length,
    occupied:activeRoom.tables.filter(t=>t.status==="occupied").length,
    reserved:activeRoom.tables.filter(t=>t.status==="reserved").length,
    unavailable:activeRoom.tables.filter(t=>t.status==="unavailable").length,
  } : {total:0,seats:0,available:0,occupied:0,reserved:0,unavailable:0};

  function bgStyle(bg:Room["background"]): React.CSSProperties {
    if (bg==="grid") return { backgroundColor:C.cnvBg, backgroundImage:["linear-gradient(rgba(255,255,255,0.035) 1px,transparent 1px)","linear-gradient(90deg,rgba(255,255,255,0.035) 1px,transparent 1px)"].join(","), backgroundSize:"50px 50px" };
    if (bg==="dots") return { backgroundColor:C.cnvBg, backgroundImage:"radial-gradient(circle,rgba(255,255,255,0.11) 1px,transparent 1px)", backgroundSize:"30px 30px" };
    return { backgroundColor:C.cnvBg };
  }

  /* ════════════════════════════ Render ══ */
  return (
    <div style={{ height:"calc(100vh - 64px)", display:"flex", flexDirection:"column", background:C.pageBg, color:C.text, overflow:"hidden" }}>

      {/* ── Top bar ── */}
      <div style={{ padding:"8px 16px", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", gap:10, flexShrink:0, background:C.cardBg }}>
        <h1 style={{ margin:0, fontSize:16, fontWeight:800, whiteSpace:"nowrap" }}>🗺 פריסת שולחנות חדש</h1>
        {restaurants.length>1 && (
          <select value={restaurantId} onChange={e=>{setRestaurantId(e.target.value);loadLayout(e.target.value);}}
            style={{...DK_INPUT,width:"auto",padding:"5px 10px",fontSize:13}}>
            {restaurants.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        )}
        <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:8}}>
          {Object.entries(STATUS).map(([s,cfg])=>{
            const cnt=activeRoom?.tables.filter(t=>t.status===s).length??0;
            return cnt>0 ? <span key={s} style={{fontSize:11,fontWeight:700,color:cfg.color,background:cfg.bg,padding:"2px 8px",borderRadius:20,border:`1px solid ${cfg.color}30`}}>{cfg.label} {cnt}</span> : null;
          })}
        </div>
      </div>

      {/* ── Room tabs ── */}
      <div style={{display:"flex",alignItems:"flex-end",padding:"0 16px",borderBottom:`1px solid ${C.border}`,background:C.cardBg,flexShrink:0,overflowX:"auto"}}>
        {layout.rooms.map((room,idx)=>(
          <div key={room.id} style={{display:"flex",alignItems:"center"}}>
            <button onClick={()=>setRoomIdx(idx)} style={{padding:"7px 14px",fontSize:13,fontWeight:idx===roomIdx?700:500,cursor:"pointer",background:"none",border:"none",borderBottom:idx===roomIdx?`2px solid ${C.amber}`:"2px solid transparent",color:idx===roomIdx?C.amber:C.sub,marginBottom:-1,whiteSpace:"nowrap"}}>
              {room.name}
            </button>
            {layout.rooms.length>1&&<button onClick={()=>delRoom(idx)} style={{fontSize:13,color:C.muted,background:"none",border:"none",cursor:"pointer",padding:"0 4px",lineHeight:1}}>×</button>}
          </div>
        ))}
        <button onClick={()=>setShowNewRoom(true)} style={{padding:"7px 10px",fontSize:12,color:C.muted,background:"none",border:"none",cursor:"pointer",whiteSpace:"nowrap"}}>+ חדר</button>
        <div style={{marginLeft:"auto",display:"flex",gap:4,paddingBottom:4,alignItems:"center",fontSize:11,color:C.muted}}>
          גלגלת=זום · רווח+גרירה=הזזה · Delete=מחיקה
        </div>
      </div>

      {/* ── Canvas area (full flex) ── */}
      <div style={{flex:1,position:"relative",overflow:"hidden"}}
        ref={containerRef}
        onMouseDown={handleCanvasMD}
        onMouseMove={handleCanvasMM}
        onMouseUp={handleCanvasMU}
        onMouseLeave={handleCanvasMU}
        onWheel={handleWheel}
        onDragOver={handleCanvasDragOver}
        onDrop={handleCanvasDrop}
      >
        {loading ? (
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100%",color:C.muted,fontSize:15}}>טוען פריסה...</div>
        ) : (
          <>
            {/* Transform wrapper */}
            <div style={{position:"absolute",top:0,left:0,transformOrigin:"0 0",transform:`translate(${panX}px,${panY}px) scale(${zoom})`}}>
              <div data-canvas="bg" style={{width:CANVAS_W,height:CANVAS_H,position:"relative",...bgStyle(activeRoom?.background??"grid")}}>
                {activeRoom?.tables.map(table=>(
                  <TableVisual key={table.id} table={table} selected={selId===table.id}
                    onMD={e=>handleTableMD(e,table)}
                    onClick={e=>handleTableClick(e,table.id)}
                    onDbl={e=>handleTableDbl(e,table)}
                    onCtx={e=>handleTableCtx(e,table.id)}
                    onRMD={(e,h)=>handleResizeMD(e,h,table)}
                  />
                ))}
              </div>
            </div>

            {/* ── Floating luxury toolbar ── */}
            <div style={{
              position:"absolute", bottom:20, left:"50%", transform:"translateX(-50%)",
              display:"flex", alignItems:"center", gap:4,
              background:"linear-gradient(135deg,#3d0c12,#2a0809)",
              border:`1.5px solid ${C.gold}60`,
              borderRadius:50, padding:"8px 16px",
              boxShadow:"0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(201,168,76,0.15), inset 0 1px 0 rgba(255,255,255,0.05)",
              zIndex:200,
            }}>
              {TOOLBAR_ITEMS.map(({ id, Icon, label }) => {
                const isActive = activeTool===id;
                const isSave = id==="save";
                return (
                  <div key={id} style={{position:"relative"}}>
                    <button onClick={()=>handleToolClick(id)} title={label} style={{
                      width:46, height:46, borderRadius:40,
                      display:"flex",alignItems:"center",justifyContent:"center",
                      cursor:"pointer", border:"none",
                      background:isSave&&saved ? `${C.green}30` : isActive ? `${C.amber}22` : "transparent",
                      outline:isActive ? `1.5px solid ${C.amber}` : isSave&&saved ? `1.5px solid ${C.green}` : "none",
                      outlineOffset:1,
                      transition:"all 0.15s",
                      opacity: isSave&&saving ? 0.5 : 1,
                    }}
                    onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=`${C.amber}18`;}}
                    onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background=isSave&&saved?`${C.green}30`:isActive?`${C.amber}22`:"transparent";}}>
                      <Icon />
                    </button>
                    {/* Tooltip */}
                    <div style={{
                      position:"absolute", bottom:"calc(100% + 8px)", left:"50%", transform:"translateX(-50%)",
                      background:"rgba(0,0,0,0.85)", color:C.text, fontSize:10, fontWeight:700,
                      padding:"3px 7px", borderRadius:6, whiteSpace:"nowrap",
                      pointerEvents:"none", opacity:0, transition:"opacity 0.15s",
                    }}
                    className="toolbar-tooltip">
                      {label}
                    </div>
                  </div>
                );
              })}

              <div style={{width:1,height:28,background:`${C.gold}40`,margin:"0 4px"}}/>

              {/* Zoom reset */}
              <button onClick={fitView} title="התאם למסך" style={{ width:46, height:46, borderRadius:40, display:"flex",alignItems:"center",justifyContent:"center", cursor:"pointer", border:"none", background:"transparent", transition:"background 0.15s" }}
                onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=`${C.amber}18`;}}
                onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="transparent";}}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M2 2h6v2H4v4H2V2zM12 2h6v6h-2V4h-4V2zM2 12h2v4h4v2H2v-6zM18 12v6h-6v-2h4v-4h2z" fill={C.sub}/>
                </svg>
              </button>
            </div>

            {/* ── Table shape palette popup (active when tool="table") ── */}
            {activeTool==="table" && (
              <div style={{
                position:"absolute", bottom:80, left:"50%", transform:"translateX(-50%)",
                background:"linear-gradient(135deg,#2a0809,#3d0c12)",
                border:`1px solid ${C.gold}50`, borderRadius:14,
                padding:"12px 16px", zIndex:199,
                boxShadow:"0 8px 32px rgba(0,0,0,0.5)",
                display:"flex", gap:10, alignItems:"flex-start",
              }}>
                <div style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:".06em",paddingTop:6,paddingLeft:4,whiteSpace:"nowrap"}}>גרור לקנבס →</div>
                {SHAPES.map(({shape,label})=>(
                  <div key={shape} draggable
                    onDragStart={e=>{e.dataTransfer.effectAllowed="copy";e.dataTransfer.setData("text/plain",shape);paletteDragShape.current={shape,kind:"table"};}}
                    onDragEnd={()=>{paletteDragShape.current=null;}}
                    style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6,padding:"8px 10px",borderRadius:10,cursor:"grab",userSelect:"none",border:`1px solid ${C.border}`,background:C.inBg,transition:"border-color 0.15s",minWidth:56}}
                    onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.borderColor=C.gold;(e.currentTarget as HTMLElement).style.background=`${C.amber}12`;}}
                    onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor=C.border;(e.currentTarget as HTMLElement).style.background=C.inBg;}}>
                    <ShapeChip shape={shape}/>
                    <span style={{fontSize:10,fontWeight:700,color:C.sub}}>{label}</span>
                  </div>
                ))}
              </div>
            )}

            {/* ── Background picker popup ── */}
            {activeTool==="bg" && (
              <div style={{
                position:"absolute", bottom:80, left:"50%", transform:"translateX(-50%)",
                background:"linear-gradient(135deg,#2a0809,#3d0c12)",
                border:`1px solid ${C.gold}50`, borderRadius:14,
                padding:"14px 18px", zIndex:199,
                boxShadow:"0 8px 32px rgba(0,0,0,0.5)",
                display:"flex", flexDirection:"column", gap:10, minWidth:220,
              }}>
                <div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:".06em"}}>בחר רקע קנבס</div>
                {([
                  { id:"grid",  label:"גריד",     desc:"קווי עזר",    preview:"linear-gradient(rgba(255,255,255,0.08) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.08) 1px,transparent 1px)" },
                  { id:"dots",  label:"נקודות",   desc:"נקודות עזר",  preview:"radial-gradient(circle,rgba(255,255,255,0.2) 1px,transparent 1px)" },
                  { id:"plain", label:"נקי",      desc:"ללא סימנים",  preview:"" },
                ] as { id:Room["background"]; label:string; desc:string; preview:string }[]).map(opt=>(
                  <div key={opt.id} onClick={()=>{ updRoom(r=>({...r,background:opt.id})); setActiveTool(null); }}
                    style={{
                      display:"flex", alignItems:"center", gap:12, padding:"8px 10px",
                      borderRadius:10, cursor:"pointer", border:`1.5px solid ${activeRoom?.background===opt.id ? C.amber : C.border}`,
                      background: activeRoom?.background===opt.id ? `${C.amber}18` : C.inBg,
                      transition:"all 0.15s",
                    }}
                    onMouseEnter={e=>{ (e.currentTarget as HTMLElement).style.borderColor=C.amber; }}
                    onMouseLeave={e=>{ (e.currentTarget as HTMLElement).style.borderColor=activeRoom?.background===opt.id ? C.amber : C.border; }}>
                    {/* Mini preview swatch */}
                    <div style={{
                      width:40, height:28, borderRadius:6, flexShrink:0,
                      backgroundColor:C.cnvBg,
                      backgroundImage:opt.preview, backgroundSize:"12px 12px",
                      border:`1px solid ${C.border}`,
                    }}/>
                    <div>
                      <div style={{fontSize:13,fontWeight:700,color:activeRoom?.background===opt.id ? C.amber : C.text}}>{opt.label}</div>
                      <div style={{fontSize:11,color:C.muted}}>{opt.desc}</div>
                    </div>
                    {activeRoom?.background===opt.id && <div style={{marginLeft:"auto",fontSize:16,color:C.amber}}>✓</div>}
                  </div>
                ))}
              </div>
            )}

            {/* Minimap */}
            <Minimap room={activeRoom} panX={panX} panY={panY} zoom={zoom} vw={vSize.w} vh={vSize.h}/>

            {/* Stats chip */}
            <div style={{position:"absolute",top:10,left:12,fontSize:12,color:C.muted,background:"rgba(24,27,32,0.85)",padding:"4px 10px",borderRadius:20,border:`1px solid ${C.border}`}}>
              {rs.total} שולחנות · {rs.seats} מקומות
            </div>

            {/* Zoom % */}
            <div style={{position:"absolute",top:10,right:12,fontSize:11,color:C.muted,background:"rgba(24,27,32,0.85)",padding:"3px 8px",borderRadius:16,border:`1px solid ${C.border}`,userSelect:"none"}}>
              {Math.round(zoom*100)}%
            </div>
          </>
        )}
      </div>

      {/* ── Context menu ── */}
      {ctxMenu && (
        <div style={{position:"fixed",left:ctxMenu.x,top:ctxMenu.y,zIndex:1000,background:C.cardBg,border:`1px solid ${C.border}`,borderRadius:10,boxShadow:"0 8px 32px rgba(0,0,0,0.5)",overflow:"hidden",minWidth:160}}
          onMouseLeave={()=>setCtxMenu(null)}>
          {([
            {icon:"✏️",label:"ערוך",action:()=>{const t=activeRoom?.tables.find(t=>t.id===ctxMenu.id);if(t)openEdit(t);setCtxMenu(null);}},
            {icon:"📋",label:"שכפל",action:()=>dupTable(ctxMenu.id)},
            null,
            ...Object.entries(STATUS).map(([s,cfg])=>({icon:"●",label:cfg.label,color:cfg.color,action:()=>setStatus(ctxMenu.id,s as TableStatus)})),
            null,
            {icon:"🗑",label:"מחק",color:C.red,action:()=>delTable(ctxMenu.id)},
          ] as (null|{icon:string;label:string;color?:string;action:()=>void})[]).map((item,i)=>{
            if (!item) return <div key={i} style={{height:1,background:C.border}}/>;
            return (
              <button key={i} onClick={item.action} style={{display:"flex",alignItems:"center",gap:8,width:"100%",padding:"9px 14px",fontSize:13,color:item.color??C.text,background:"none",border:"none",cursor:"pointer",textAlign:"right" as const}}
                onMouseEnter={e=>(e.currentTarget.style.background=C.inBg)}
                onMouseLeave={e=>(e.currentTarget.style.background="none")}>
                <span style={{minWidth:16}}>{item.icon}</span>{item.label}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Edit modal ── */}
      {editId && (()=>{
        const tableUrl = editForm.tableNumber&&restaurantId&&origin
          ? `${origin}/menu/${restaurantId}?table=${encodeURIComponent(editForm.tableNumber)}` : null;
        return (
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.65)",backdropFilter:"blur(4px)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}
            onClick={()=>setEditId(null)}>
            <div style={{background:C.cardBg,borderRadius:18,border:`1px solid ${C.border}`,boxShadow:"0 24px 60px rgba(0,0,0,0.5)",width:"100%",maxWidth:400,padding:24,overflowY:"auto",maxHeight:"90vh"}}
              onClick={e=>e.stopPropagation()}>
              <div style={{fontSize:17,fontWeight:800,color:C.text,marginBottom:20}}>✏️ הגדרת שולחן</div>
              <div style={{display:"flex",flexDirection:"column",gap:16}}>
                <div><Lbl t="מספר / שם שולחן"/>
                  <input type="text" value={editForm.tableNumber} autoFocus style={DK_INPUT}
                    onChange={e=>setEditForm(f=>({...f,tableNumber:e.target.value}))} placeholder="1, A3, בר..."/>
                </div>
                <div><Lbl t="צורת שולחן"/>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    {SHAPES.map(({shape,label})=>(
                      <button key={shape} type="button"
                        onClick={()=>{const d=DEFAULT_SIZES[shape];setEditForm(f=>({...f,shape,width:String(d.w),height:String(d.h)}));}}
                        style={{flex:1,padding:"8px 0",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer",background:editForm.shape===shape?`linear-gradient(135deg,#8B6914,${C.gold})`:C.inBg,color:editForm.shape===shape?"#fff":C.sub,border:`1px solid ${editForm.shape===shape?C.amber:C.inBrd}`}}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div><Lbl t="מספר מקומות"/>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    {[2,4,6,8,10,12].map(n=>(
                      <button key={n} type="button" onClick={()=>setEditForm(f=>({...f,seats:String(n)}))}
                        style={{flex:1,padding:"8px 0",borderRadius:8,fontSize:13,fontWeight:700,cursor:"pointer",background:editForm.seats===String(n)?`linear-gradient(135deg,#8B6914,${C.gold})`:C.inBg,color:editForm.seats===String(n)?"#fff":C.sub,border:`1px solid ${editForm.seats===String(n)?C.amber:C.inBrd}`}}>
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                <div><Lbl t="סטטוס"/>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    {Object.entries(STATUS).map(([s,cfg])=>(
                      <button key={s} type="button" onClick={()=>setEditForm(f=>({...f,status:s as TableStatus}))}
                        style={{flex:1,padding:"8px 0",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer",background:editForm.status===s?cfg.bg:C.inBg,color:editForm.status===s?cfg.color:C.sub,border:`1px solid ${editForm.status===s?cfg.color:C.inBrd}`}}>
                        {cfg.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div><Lbl t="גודל וסיבוב"/>
                  <div style={{display:"flex",gap:10}}>
                    {[["רוחב","width"],["גובה","height"],["סיבוב°","rotation"]].map(([lbl,key])=>(
                      <div key={key} style={{flex:1}}>
                        <div style={{fontSize:11,color:C.muted,marginBottom:4}}>{lbl}</div>
                        <input type="number" value={editForm[key as keyof typeof editForm]}
                          min={key==="rotation"?"-180":"40"} max={key==="rotation"?"180":"600"} step={key==="rotation"?"15":"1"}
                          style={{...DK_INPUT,padding:"7px 10px"}}
                          onChange={e=>setEditForm(f=>({...f,[key]:e.target.value}))}/>
                      </div>
                    ))}
                  </div>
                </div>
                {tableUrl && (
                  <div style={{border:`1px solid ${C.border}`,borderRadius:12,padding:14,background:C.inBg}}>
                    <Lbl t="QR לשולחן"/>
                    <div style={{display:"flex",justifyContent:"center",marginBottom:10}}>
                      <div style={{padding:10,background:"#fff",borderRadius:12,display:"inline-block"}}>
                        <QRCodeSVG value={tableUrl} size={140}/>
                      </div>
                    </div>
                    <input readOnly value={tableUrl} style={{...DK_INPUT,fontSize:11,color:C.muted}}
                      onClick={e=>(e.target as HTMLInputElement).select()}/>
                  </div>
                )}
              </div>
              <div style={{display:"flex",gap:8,marginTop:20}}>
                <button onClick={saveEdit} style={{flex:1,padding:"10px 0",borderRadius:10,color:"#fff",fontWeight:700,fontSize:14,border:"none",cursor:"pointer",background:`linear-gradient(135deg,#8B6914,${C.gold})`}}>שמור</button>
                <button onClick={()=>delTable(editId)} style={{padding:"10px 16px",borderRadius:10,fontSize:14,fontWeight:600,cursor:"pointer",color:C.red,background:"rgba(255,107,107,0.1)",border:`1px solid rgba(255,107,107,0.25)`}}>🗑</button>
                <button onClick={()=>setEditId(null)} style={{padding:"10px 14px",borderRadius:10,fontSize:14,fontWeight:600,cursor:"pointer",color:C.sub,background:C.inBg,border:`1px solid ${C.inBrd}`}}>ביטול</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Stats modal ── */}
      {showStats && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.65)",backdropFilter:"blur(4px)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center"}}
          onClick={()=>setShowStats(false)}>
          <div style={{background:C.cardBg,borderRadius:18,border:`1px solid ${C.border}`,boxShadow:"0 24px 60px rgba(0,0,0,0.5)",width:340,padding:24}}
            onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:17,fontWeight:800,color:C.text,marginBottom:20}}>📊 סטטיסטיקות — {activeRoom?.name}</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              {[
                {label:"שולחנות",val:rs.total,color:C.amber},
                {label:"מקומות",val:rs.seats,color:C.gold},
                ...Object.entries(STATUS).map(([s,cfg])=>({label:cfg.label,val:(rs as Record<string,number>)[s]??0,color:cfg.color})),
              ].map(s=>(
                <div key={s.label} style={{background:C.inBg,borderRadius:12,padding:"14px 16px",border:`1px solid ${C.border}`}}>
                  <div style={{fontSize:28,fontWeight:900,color:s.color}}>{s.val}</div>
                  <div style={{fontSize:12,color:C.muted,marginTop:2}}>{s.label}</div>
                </div>
              ))}
            </div>
            <button onClick={()=>setShowStats(false)} style={{marginTop:16,width:"100%",padding:"10px 0",borderRadius:10,background:C.inBg,border:`1px solid ${C.inBrd}`,color:C.sub,cursor:"pointer",fontSize:14}}>סגור</button>
          </div>
        </div>
      )}

      {/* ── New room modal ── */}
      {showNewRoom && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.65)",backdropFilter:"blur(4px)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center"}}
          onClick={()=>setShowNewRoom(false)}>
          <div style={{background:C.cardBg,borderRadius:18,border:`1px solid ${C.border}`,boxShadow:"0 24px 60px rgba(0,0,0,0.5)",width:300,padding:24}}
            onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:17,fontWeight:800,color:C.text,marginBottom:16}}>+ חדר חדש</div>
            <input type="text" value={newRoomName} autoFocus style={DK_INPUT} placeholder="שם החדר..."
              onChange={e=>setNewRoomName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addRoom()}/>
            <div style={{display:"flex",gap:8,marginTop:14}}>
              <button onClick={addRoom} style={{flex:1,padding:"10px 0",borderRadius:10,color:"#fff",fontWeight:700,border:"none",cursor:"pointer",background:`linear-gradient(135deg,#8B6914,${C.gold})`}}>הוסף</button>
              <button onClick={()=>{setShowNewRoom(false);setNewRoomName("");}} style={{padding:"10px 14px",borderRadius:10,color:C.sub,background:C.inBg,border:`1px solid ${C.inBrd}`,cursor:"pointer"}}>ביטול</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
