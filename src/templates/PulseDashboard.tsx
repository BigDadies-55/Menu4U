"use client";
/**
 * TEMPLATE: Dashboard — "Pulse"
 * Radial revenue gauge · live order feed · glowing team cards
 * No traditional "card grid" — information floats in space
 */
import React, { useState, useEffect } from "react";

const V = {
  bg:        "#060610",
  glass:     "rgba(255,255,255,0.05)",
  border:    "rgba(255,255,255,0.09)",
  purple:    "#a855f7",
  purpleDim: "rgba(168,85,247,0.15)",
  purpleGlow:"rgba(168,85,247,0.4)",
  cyan:      "#22d3ee",
  cyanDim:   "rgba(34,211,238,0.12)",
  cyanGlow:  "rgba(34,211,238,0.35)",
  rose:      "#fb7185",
  amber:     "#fbbf24",
  emerald:   "#34d399",
  text:      "#f1f5f9",
  sub:       "rgba(241,245,249,0.55)",
  muted:     "rgba(241,245,249,0.3)",
};

const GLOW = (c:string,s=16)=>`0 0 ${s}px ${c}`;

// ── SVG Gauge ─────────────────────────────────────────────
function RevenueGauge({ value, max, label }: { value:number; max:number; label:string }) {
  const R = 90; const CX = 110; const CY = 110;
  const startAngle = -210; const sweep = 240;
  const pct = Math.min(value/max,1);
  const toRad = (d:number) => (d * Math.PI) / 180;
  const arc = (cx:number,cy:number,r:number,startDeg:number,endDeg:number,large:boolean) => {
    const s = { x: cx+r*Math.cos(toRad(startDeg)), y: cy+r*Math.sin(toRad(startDeg)) };
    const e = { x: cx+r*Math.cos(toRad(endDeg)),   y: cy+r*Math.sin(toRad(endDeg))   };
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large?1:0} 1 ${e.x} ${e.y}`;
  };
  const trackPath = arc(CX,CY,R,startAngle,startAngle+sweep,true);
  const fillEnd   = startAngle + sweep * pct;
  const fillPath  = arc(CX,CY,R,startAngle,fillEnd, sweep*pct>180);

  return (
    <svg width={220} height={220} style={{overflow:"visible"}}>
      <defs>
        <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor={V.purple}/>
          <stop offset="100%" stopColor={V.cyan}/>
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="4" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      {/* Track */}
      <path d={trackPath} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={14} strokeLinecap="round"/>
      {/* Fill */}
      {pct>0.01 && (
        <path d={fillPath} fill="none" stroke="url(#gaugeGrad)" strokeWidth={14} strokeLinecap="round" filter="url(#glow)"/>
      )}
      {/* Center value */}
      <text x={CX} y={CY-14} textAnchor="middle" fontSize={36} fontWeight={900} fill={V.text} style={{fontFamily:"system-ui"}}>
        ₪{(value/1000).toFixed(1)}K
      </text>
      <text x={CX} y={CY+12} textAnchor="middle" fontSize={13} fill={V.sub} style={{fontFamily:"system-ui"}}>
        {label}
      </text>
      <text x={CX} y={CY+32} textAnchor="middle" fontSize={11} fill={V.emerald} fontWeight={700} style={{fontFamily:"system-ui"}}>
        ↑ 12% vs אתמול
      </text>
    </svg>
  );
}

// ── Stat pill ──────────────────────────────────────────────
function StatPill({ icon, label, value, color }: { icon:string; label:string; value:string|number; color:string }) {
  return (
    <div style={{
      display:"flex",alignItems:"center",gap:10,
      padding:"12px 18px",borderRadius:20,
      background:`${color}12`,border:`1px solid ${color}30`,
      flex:"1 1 120px",minWidth:120,
    }}>
      <span style={{fontSize:22}}>{icon}</span>
      <div>
        <div style={{fontSize:22,fontWeight:900,color,lineHeight:1}}>{value}</div>
        <div style={{fontSize:11,color:V.muted,marginTop:2}}>{label}</div>
      </div>
    </div>
  );
}

// ── Team card ──────────────────────────────────────────────
function TeamCard({ name, role, orders, active, color }: { name:string; role:string; orders:number; active:boolean; color:string }) {
  return (
    <div style={{
      display:"flex",alignItems:"center",gap:12,
      padding:"10px 14px",borderRadius:16,
      background: active ? `${color}0d` : V.glass,
      border:`1px solid ${active ? color+"30" : V.border}`,
    }}>
      {/* Avatar */}
      <div style={{
        width:38,height:38,borderRadius:"50%",flexShrink:0,
        background:`linear-gradient(135deg,${color}40,${color}20)`,
        border:`2px solid ${active ? color : "rgba(255,255,255,0.1)"}`,
        display:"flex",alignItems:"center",justifyContent:"center",
        fontSize:16,fontWeight:900,color,
        boxShadow: active ? GLOW(`${color}55`,10) : "none",
      }}>{name[0]}</div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:13,fontWeight:700,color:active?V.text:V.muted,
          overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{name}</div>
        <div style={{fontSize:11,color:V.muted}}>{role}</div>
      </div>
      {orders>0&&<div style={{
        padding:"2px 8px",borderRadius:20,
        background:`${color}20`,border:`1px solid ${color}40`,
        fontSize:11,fontWeight:700,color,
      }}>{orders}</div>}
      {!active&&<div style={{width:7,height:7,borderRadius:"50%",background:V.muted}}/>}
      {active &&<div style={{width:7,height:7,borderRadius:"50%",background:V.emerald,
        boxShadow:GLOW("rgba(52,211,153,0.6)",6)}}/>}
    </div>
  );
}

// ── Live feed item ─────────────────────────────────────────
function FeedItem({ time, text, color, fresh }: { time:string; text:string; color:string; fresh?:boolean }) {
  return (
    <div style={{
      display:"flex",alignItems:"center",gap:10,
      padding:"9px 0",borderBottom:`1px solid rgba(255,255,255,0.05)`,
      opacity: fresh ? 1 : 0.7,
    }}>
      <div style={{
        width:6,height:6,borderRadius:"50%",flexShrink:0,
        background:color,
        boxShadow: fresh ? GLOW(`${color.replace("1)","0.6)")}`,8) : "none",
      }}/>
      <span style={{fontSize:11,color:V.muted,flexShrink:0}}>{time}</span>
      <span style={{fontSize:12,color:V.sub,flex:1}}>{text}</span>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────
const FEED = [
  {time:"20:12",text:"שולחן 4 — ביקש חשבון · ₪580",color:"#fb7185",fresh:true},
  {time:"20:09",text:"שולחן 11 — קורס עיקרי הוצת",  color:"#fbbf24",fresh:true},
  {time:"20:07",text:"שולחן 7 — הזמנה חדשה · ₪320",  color:"#34d399",fresh:false},
  {time:"20:01",text:"שולחן 9 — נסגר · ₪740",         color:"#a855f7",fresh:false},
  {time:"19:55",text:"שולחן 2 — Comp מאושר (₪45)",    color:"#fbbf24",fresh:false},
  {time:"19:48",text:"86: נתחי עוף — כבוי",           color:"#fb7185",fresh:false},
  {time:"19:40",text:"שולחן 6 — הזמנה חדשה · ₪210",  color:"#34d399",fresh:false},
];
const TEAM = [
  {name:"דניאל",role:"מלצר",  orders:11,active:true, color:"#a855f7"},
  {name:"מיכל", role:"מלצרית",orders:14,active:true, color:"#22d3ee"},
  {name:"אריאל",role:"מלצר",  orders:8, active:true, color:"#fb7185"},
  {name:"ליהי", role:"מטבח",  orders:0, active:true, color:"#fbbf24"},
  {name:"רון",  role:"מנהל",  orders:0, active:false,color:"#94a3b8"},
];
const INSIGHTS = [
  {icon:"🔥",text:"שיא שבועי צפוי — עוד ₪1,200 לשיא",color:"#fbbf24"},
  {icon:"⚠️",text:"שולחן 4 ממתין 54 דק' — SLA חריגה",color:"#fb7185"},
  {icon:"📈",text:"הפריט הנמכר: פילה סלמון (×18)",     color:"#34d399"},
];

export default function PulseDashboard() {
  const [now, setNow] = useState(new Date());
  const [insightIdx, setInsightIdx] = useState(0);
  const [pulse,      setPulse]      = useState(false);

  useEffect(()=>{const id=setInterval(()=>setNow(new Date()),1000);return()=>clearInterval(id);},[]);
  useEffect(()=>{const id=setInterval(()=>setInsightIdx(i=>(i+1)%INSIGHTS.length),4500);return()=>clearInterval(id);},[]);
  useEffect(()=>{const id=setInterval(()=>setPulse(p=>!p),1800);return()=>clearInterval(id);},[]);

  const hour=now.getHours();
  const greeting=hour<12?"בוקר טוב ☀️":hour<17?"צהריים טובים 🌤":hour<21?"ערב טוב 🌆":"לילה טוב 🌙";
  const ins=INSIGHTS[insightIdx];

  return (
    <div style={{
      height:"calc(100vh - 64px)",background:V.bg,
      color:V.text,fontFamily:"system-ui,sans-serif",direction:"rtl",
      display:"flex",flexDirection:"column",overflow:"hidden",
      position:"relative",
    }}>
      {/* Ambient blobs */}
      <div style={{position:"absolute",top:-120,right:"5%",width:500,height:500,borderRadius:"50%",
        background:`radial-gradient(circle,rgba(168,85,247,0.06) 0%,transparent 70%)`,pointerEvents:"none"}}/>
      <div style={{position:"absolute",bottom:-150,left:"0%",width:600,height:600,borderRadius:"50%",
        background:`radial-gradient(circle,rgba(34,211,238,0.05) 0%,transparent 70%)`,pointerEvents:"none"}}/>

      {/* ── Top bar ── */}
      <div style={{
        padding:"12px 28px",display:"flex",alignItems:"center",gap:14,
        background:"rgba(6,6,16,0.8)",backdropFilter:"blur(20px)",
        borderBottom:`1px solid ${V.border}`,flexShrink:0,zIndex:10,
      }}>
        <div>
          <span style={{fontSize:18,fontWeight:900,color:V.text}}>{greeting}</span>
          <span style={{fontSize:13,color:V.muted,marginRight:10}}>
            {now.toLocaleDateString("he-IL",{weekday:"long",day:"numeric",month:"long"})}
          </span>
        </div>
        <div style={{marginRight:"auto",display:"flex",alignItems:"center",gap:10}}>
          {/* Live dot */}
          <div style={{display:"flex",alignItems:"center",gap:6,
            padding:"4px 14px",borderRadius:40,
            background:"rgba(52,211,153,0.1)",border:"1px solid rgba(52,211,153,0.25)"}}>
            <div style={{width:7,height:7,borderRadius:"50%",background:V.emerald,
              opacity:pulse?1:0.3,transition:"opacity 0.4s",
              boxShadow:GLOW("rgba(52,211,153,0.7)",8)}}/>
            <span style={{fontSize:12,fontWeight:700,color:V.emerald}}>LIVE</span>
          </div>
          <div style={{
            fontSize:28,fontWeight:900,fontVariantNumeric:"tabular-nums",
            background:`linear-gradient(90deg,${V.purple},${V.cyan})`,
            WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",
          }}>{now.toLocaleTimeString("he-IL",{hour:"2-digit",minute:"2-digit"})}</div>
        </div>
      </div>

      {/* ── Main layout ── */}
      <div style={{
        flex:1,overflow:"hidden",
        display:"grid",
        gridTemplateColumns:"1fr 260px",
        gridTemplateRows:"1fr",
        gap:0,
      }}>
        {/* LEFT: main content */}
        <div style={{display:"flex",flexDirection:"column",overflow:"hidden",borderLeft:`1px solid ${V.border}`}}>

          {/* Gauge + stats row */}
          <div style={{
            display:"flex",alignItems:"center",gap:0,
            padding:"20px 24px",borderBottom:`1px solid ${V.border}`,flexShrink:0,
          }}>
            <RevenueGauge value={6840} max={10000} label="הכנסה היום"/>
            <div style={{flex:1,display:"flex",flexWrap:"wrap",gap:10,padding:"0 0 0 24px"}}>
              <StatPill icon="🍽"  label="הזמנות פעילות" value={12}      color={V.cyan}/>
              <StatPill icon="🟢"  label="שולחנות פנויים" value="5/18"   color={V.emerald}/>
              <StatPill icon="⏱"  label="ממוצע המתנה"    value="8 דק'"  color={V.purple}/>
              <StatPill icon="🚨"  label="SLA חריגות"     value={2}      color={V.rose}/>
              <StatPill icon="⏳"  label="ממתינים"         value={3}      color={V.amber}/>
              <StatPill icon="💰"  label="ממוצע לשולחן"   value="₪380"  color={V.cyan}/>
            </div>
          </div>

          {/* Insight banner */}
          <div style={{
            margin:"16px 24px",padding:"14px 18px",borderRadius:16,flexShrink:0,
            background:`${ins.color}12`,border:`1px solid ${ins.color}30`,
            display:"flex",alignItems:"center",gap:12,
            transition:"all 0.5s",
          }}>
            <span style={{fontSize:24}}>{ins.icon}</span>
            <span style={{fontSize:13,color:V.text,fontWeight:600}}>{ins.text}</span>
            <div style={{marginRight:"auto",display:"flex",gap:4}}>
              {INSIGHTS.map((_,i)=>(
                <div key={i} style={{
                  width: i===insightIdx?20:6,height:6,borderRadius:3,
                  background: i===insightIdx ? ins.color : V.border,
                  transition:"all 0.4s",
                }}/>
              ))}
            </div>
          </div>

          {/* Live feed */}
          <div style={{flex:1,overflow:"hidden",display:"flex",flexDirection:"column",padding:"0 24px 16px"}}>
            <div style={{fontSize:12,fontWeight:700,color:V.muted,
              letterSpacing:"0.08em",marginBottom:8}}>פעילות אחרונה</div>
            <div style={{flex:1,overflowY:"auto"}}>
              {FEED.map((ev,i)=><FeedItem key={i} {...ev}/>)}
            </div>
          </div>
        </div>

        {/* RIGHT: team */}
        <div style={{
          display:"flex",flexDirection:"column",
          padding:"20px 16px",overflow:"hidden",
          background:"rgba(255,255,255,0.015)",
        }}>
          <div style={{fontSize:12,fontWeight:700,color:V.muted,
            letterSpacing:"0.08em",marginBottom:14}}>צוות במשמרת</div>
          <div style={{display:"flex",flexDirection:"column",gap:8,overflowY:"auto"}}>
            {TEAM.map(m=><TeamCard key={m.name} {...m}/>)}
          </div>

          {/* Floor dots mini */}
          <div style={{marginTop:24}}>
            <div style={{fontSize:12,fontWeight:700,color:V.muted,
              letterSpacing:"0.08em",marginBottom:12}}>מצב רצפה</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:7}}>
              {[2,2,1,2,0,1,1,2,3,0,2,1,0,2,3,1,2,1,0,1].map((s,i)=>{
                const color=s===0?"rgba(255,255,255,0.05)":s===1?V.emerald:s===2?V.amber:V.rose;
                return (
                  <div key={i} style={{
                    width:"100%",paddingBottom:"100%",borderRadius:8,position:"relative",
                    background:`${color}${s===0?"":"22"}`,
                    border:`1px solid ${color}${s===0?"22":"55"}`,
                  }}>
                    {s>0&&<div style={{
                      position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",
                    }}>
                      <div style={{width:6,height:6,borderRadius:"50%",background:color,
                        boxShadow:s===3?GLOW(`${color}88`,8):"none"}}/>
                    </div>}
                  </div>
                );
              })}
            </div>
            <div style={{display:"flex",gap:12,marginTop:10}}>
              {[[V.emerald,"פנוי"],[V.amber,"תפוס"],[V.rose,"חשבון"]].map(([c,l])=>(
                <div key={l} style={{display:"flex",alignItems:"center",gap:4,fontSize:10,color:V.muted}}>
                  <div style={{width:7,height:7,borderRadius:"50%",background:c}}/>
                  {l}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
