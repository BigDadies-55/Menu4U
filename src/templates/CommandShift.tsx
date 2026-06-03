"use client";
/**
 * TEMPLATE: Shift Manager — "Command"
 * Glowing circular tables · full-canvas floor · slide-up command bar
 * Tables sized by urgency · pulsing SLA breach · neon course dots
 */
import React, { useState, useEffect } from "react";

const V = {
  bg:        "#060610",
  glass:     "rgba(255,255,255,0.055)",
  border:    "rgba(255,255,255,0.09)",
  purple:    "#a855f7",
  purpleGlow:"rgba(168,85,247,0.5)",
  cyan:      "#22d3ee",
  cyanGlow:  "rgba(34,211,238,0.45)",
  rose:      "#fb7185",
  roseGlow:  "rgba(251,113,133,0.5)",
  amber:     "#fbbf24",
  amberGlow: "rgba(251,191,36,0.45)",
  emerald:   "#34d399",
  emeraldGlow:"rgba(52,211,153,0.45)",
  text:      "#f1f5f9",
  sub:       "rgba(241,245,249,0.55)",
  muted:     "rgba(241,245,249,0.3)",
};
const GLOW=(c:string,s=20)=>`0 0 ${s}px ${c}, 0 0 ${s*2.5}px ${c.replace("0.5","0.15").replace("0.45","0.12")}`;

type TStatus = "free"|"occupied"|"bill"|"seated";
type TTable  = {
  id:string; num:number; cx:number; cy:number; r:number;
  status:TStatus; guests:number; sinceMin:number; waiter:string;
  courses: ("done"|"fire"|"held"|"none")[];
};
type HeldItem = { tableNum:number; course:number; items:string[]; count:number };
type WaitItem = { id:string; name:string; guests:number; sinceMin:number };

const TABLES: TTable[] = [
  {id:"t1", num:1,  cx:90,  cy:90,  r:36, status:"free",     guests:0, sinceMin:0,  waiter:"דניאל", courses:["none","none","none"]},
  {id:"t2", num:2,  cx:210, cy:80,  r:42, status:"occupied", guests:4, sinceMin:38, waiter:"מיכל",  courses:["done","fire","held"]},
  {id:"t3", num:3,  cx:330, cy:90,  r:38, status:"occupied", guests:2, sinceMin:14, waiter:"דניאל", courses:["done","done","none"]},
  {id:"t4", num:4,  cx:440, cy:80,  r:44, status:"bill",     guests:6, sinceMin:58, waiter:"אריאל", courses:["done","done","done"]},
  {id:"t5", num:5,  cx:560, cy:90,  r:34, status:"free",     guests:0, sinceMin:0,  waiter:"מיכל",  courses:["none","none","none"]},
  {id:"t6", num:6,  cx:90,  cy:220, r:40, status:"occupied", guests:3, sinceMin:7,  waiter:"אריאל", courses:["fire","none","none"]},
  {id:"t7", num:7,  cx:200, cy:230, r:46, status:"occupied", guests:5, sinceMin:47, waiter:"דניאל", courses:["done","held","none"]},
  {id:"t8", num:8,  cx:320, cy:220, r:36, status:"seated",   guests:2, sinceMin:2,  waiter:"מיכל",  courses:["none","none","none"]},
  {id:"t9", num:9,  cx:440, cy:225, r:34, status:"free",     guests:0, sinceMin:0,  waiter:"אריאל", courses:["none","none","none"]},
  {id:"t10",num:10, cx:555, cy:220, r:44, status:"occupied", guests:4, sinceMin:55, waiter:"דניאל", courses:["done","done","held"]},
  {id:"t11",num:11, cx:110, cy:340, r:38, status:"occupied", guests:2, sinceMin:12, waiter:"מיכל",  courses:["done","none","none"]},
  {id:"t12",num:12, cx:230, cy:350, r:34, status:"free",     guests:0, sinceMin:0,  waiter:"אריאל", courses:["none","none","none"]},
  {id:"t13",num:13, cx:350, cy:345, r:42, status:"bill",     guests:3, sinceMin:44, waiter:"דניאל", courses:["done","done","done"]},
  {id:"t14",num:14, cx:470, cy:340, r:40, status:"occupied", guests:6, sinceMin:22, waiter:"מיכל",  courses:["done","fire","none"]},
  {id:"t15",num:15, cx:570, cy:345, r:34, status:"free",     guests:0, sinceMin:0,  waiter:"אריאל", courses:["none","none","none"]},
];
const HELD: HeldItem[] = [
  {tableNum:2,  course:3, items:["קרם ברולה","פונדן שוקולד"],        count:2},
  {tableNum:7,  course:2, items:["אנטריקוט","פרגית גריל","סלמון"],   count:3},
  {tableNum:10, course:3, items:["פנה קוטה"],                         count:1},
];
const COURSE_E=["","🥗","🍖","🍮"];
const COURSE_L=["","ראשון","עיקרי","קינוח"];
const DOT_COLOR:Record<string,string>={done:V.emerald,fire:V.amber,held:V.purple,none:"rgba(255,255,255,0.07)"};
const STATUS_COLOR:Record<TStatus,{fill:string;stroke:string;glow:string;label:string}>={
  free:    {fill:"rgba(52,211,153,0.08)",  stroke:V.emerald, glow:V.emeraldGlow,  label:"פנוי"},
  occupied:{fill:"rgba(251,191,36,0.08)",  stroke:V.amber,   glow:V.amberGlow,    label:"תפוס"},
  bill:    {fill:"rgba(251,113,133,0.10)", stroke:V.rose,    glow:V.roseGlow,     label:"חשבון"},
  seated:  {fill:"rgba(168,85,247,0.08)",  stroke:V.purple,  glow:V.purpleGlow,   label:"הושב"},
};

function fmtM(m:number){return m<60?`${m}′`:`${Math.floor(m/60)}ש'${m%60}′`;}

export default function CommandShift() {
  const [tick,       setTick]       = useState(0);
  const [selected,   setSelected]   = useState<TTable|null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab,  setDrawerTab]  = useState<"fire"|"wait"|"kpi">("fire");
  const [firingKey,  setFiringKey]  = useState("");
  const [waitlist,   setWaitlist]   = useState<WaitItem[]>([
    {id:"w1",name:"משפחת לוי",   guests:4,sinceMin:22},
    {id:"w2",name:"קבוצת רונן",  guests:8,sinceMin:11},
    {id:"w3",name:"יעל + 2",      guests:3,sinceMin:4},
  ]);
  const SLA=45;

  useEffect(()=>{const id=setInterval(()=>setTick(t=>t+1),1000);return()=>clearInterval(id);},[]);

  const phase=Math.sin(tick*0.15);  // for breathing animation
  const breachedCount=TABLES.filter(t=>t.status==="occupied"&&t.sinceMin>=SLA).length;

  async function fireHeld(h:HeldItem){
    const key=`${h.tableNum}:${h.course}`;
    setFiringKey(key);
    await new Promise(r=>setTimeout(r,1200));
    setFiringKey("");
  }

  return (
    <div style={{
      height:"calc(100vh - 64px)",background:V.bg,
      color:V.text,fontFamily:"system-ui,sans-serif",direction:"rtl",
      position:"relative",overflow:"hidden",
    }}>
      <style>{`
        @keyframes breach-pulse {
          0%,100%{box-shadow:0 0 0 0 rgba(251,113,133,0)}
          50%{box-shadow:0 0 0 8px rgba(251,113,133,0.3)}
        }
        @keyframes breathe {
          0%,100%{transform:scale(1)} 50%{transform:scale(1.02)}
        }
      `}</style>

      {/* Ambient */}
      <div style={{position:"absolute",top:-100,right:"20%",width:400,height:400,borderRadius:"50%",
        background:"radial-gradient(circle,rgba(168,85,247,0.07) 0%,transparent 70%)",pointerEvents:"none"}}/>
      <div style={{position:"absolute",bottom:-100,left:"10%",width:500,height:500,borderRadius:"50%",
        background:"radial-gradient(circle,rgba(34,211,238,0.05) 0%,transparent 70%)",pointerEvents:"none"}}/>

      {/* ── Glass top bar ── */}
      <div style={{
        position:"absolute",top:0,right:0,left:0,zIndex:50,
        padding:"8px 20px",
        background:"rgba(6,6,16,0.82)",backdropFilter:"blur(18px)",
        borderBottom:`1px solid ${V.border}`,
        display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",
      }}>
        <span style={{
          fontSize:16,fontWeight:900,
          background:`linear-gradient(90deg,${V.purple},${V.cyan})`,
          WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",
          marginLeft:4,
        }}>⚡ Command</span>
        <div style={{width:1,height:18,background:V.border}}/>
        {[
          {v:"₪6.8K", l:"הכנסה",  c:V.cyan},
          {v:12,      l:"הזמנות", c:V.purple},
          {v:"5/15",  l:"פנויים", c:V.emerald},
          {v:breachedCount, l:"SLA",c:breachedCount?V.rose:V.emerald},
          {v:waitlist.length,l:"המתנה",c:waitlist.length?V.amber:V.muted},
          {v:HELD.length, l:"להוצאה",c:HELD.length?V.amber:V.muted},
        ].map(k=>(
          <div key={k.l} style={{
            padding:"4px 14px",borderRadius:40,
            background:`${k.c}12`,border:`1px solid ${k.c}28`,
            display:"flex",gap:6,alignItems:"center",
          }}>
            <span style={{fontSize:16,fontWeight:900,color:k.c}}>{k.v}</span>
            <span style={{fontSize:11,color:V.muted}}>{k.l}</span>
          </div>
        ))}
        <div style={{marginRight:"auto"}}/>
        <button
          onClick={()=>{setDrawerOpen(o=>!o);setDrawerTab("fire");}}
          style={{
            padding:"6px 18px",borderRadius:40,border:"none",cursor:"pointer",
            background:drawerOpen
              ?`linear-gradient(135deg,${V.purple},${V.cyan})`
              :`${V.amber}20`,
            color:drawerOpen?"#fff":V.amber,
            fontWeight:700,fontSize:12,
            boxShadow:drawerOpen?GLOW(V.purpleGlow,8):`0 0 12px ${V.amberGlow}`,
          }}
        >{drawerOpen?"סגור ✕":`🔥 ${HELD.length} להוצאה`}</button>
      </div>

      {/* ── Floor canvas ── */}
      <div style={{
        position:"absolute",
        top:48,left:0,right:0,
        bottom: drawerOpen ? 340 : 0,
        overflow:"auto",
        transition:"bottom 0.3s ease",
      }}>
        <svg
          width={660} height={420}
          style={{display:"block",margin:"20px auto"}}
        >
          <defs>
            {TABLES.map(t=>{
              const cfg=STATUS_COLOR[t.status];
              return (
                <radialGradient key={t.id} id={`grad-${t.id}`} cx="50%" cy="50%" r="50%">
                  <stop offset="0%"   stopColor={cfg.stroke} stopOpacity={0.25}/>
                  <stop offset="100%" stopColor={cfg.stroke} stopOpacity={0.04}/>
                </radialGradient>
              );
            })}
          </defs>

          {TABLES.map(t=>{
            const cfg     = STATUS_COLOR[t.status];
            const breached= t.status==="occupied"&&t.sinceMin>=SLA;
            const isSel   = selected?.id===t.id;
            const breathe = t.status==="occupied" ? 1+(phase*0.015) : 1;
            const r       = t.r * breathe;
            const dotCount= t.courses.filter(c=>c!=="none").length;

            return (
              <g key={t.id} onClick={()=>setSelected(selected?.id===t.id?null:t)} style={{cursor:"pointer"}}>
                {/* Outer glow ring */}
                <circle cx={t.cx} cy={t.cy} r={r+10}
                  fill="none"
                  stroke={isSel?V.cyan:cfg.stroke}
                  strokeWidth={isSel?2:1}
                  opacity={isSel?0.7:0.2}
                />
                {/* Main circle */}
                <circle cx={t.cx} cy={t.cy} r={r}
                  fill={`url(#grad-${t.id})`}
                  stroke={breached?V.rose:isSel?V.cyan:cfg.stroke}
                  strokeWidth={isSel?2.5:1.5}
                  style={{
                    filter:`drop-shadow(0 0 ${isSel?14:8}px ${isSel?V.cyanGlow:cfg.glow})`,
                    animation: breached ? "breach-pulse 1.2s infinite" : undefined,
                  }}
                />
                {/* Table number */}
                <text x={t.cx} y={t.cy+(t.guests>0?-6:4)} textAnchor="middle"
                  fontSize={t.r>40?20:17} fontWeight={900}
                  fill={t.status==="free"?"rgba(255,255,255,0.35)":"#fff"}
                  style={{fontFamily:"system-ui"}}>
                  {t.num}
                </text>
                {/* Status label */}
                {t.status!=="free"&&(
                  <text x={t.cx} y={t.cy+14} textAnchor="middle"
                    fontSize={9} fontWeight={700} fill={cfg.stroke} opacity={0.9}
                    style={{fontFamily:"system-ui"}}>
                    {cfg.label}
                  </text>
                )}
                {/* Timer */}
                {t.status==="occupied"&&t.sinceMin>0&&(
                  <text x={t.cx} y={t.cy+26} textAnchor="middle"
                    fontSize={9} fill={breached?"#fca5a5":V.amber}
                    fontWeight={700} style={{fontFamily:"system-ui"}}>
                    {fmtM(t.sinceMin)}
                  </text>
                )}
                {/* Guest count */}
                {t.guests>0&&t.r>36&&(
                  <text x={t.cx} y={t.cy-r+16} textAnchor="middle"
                    fontSize={8} fill={V.muted} style={{fontFamily:"system-ui"}}>
                    👤{t.guests}
                  </text>
                )}
                {/* Course dots */}
                {dotCount>0&&(
                  <g transform={`translate(${t.cx-dotCount*7},${t.cy+r-14})`}>
                    {t.courses.map((c,i)=>c!=="none"&&(
                      <circle key={i} cx={i*14+7} cy={7} r={4.5}
                        fill={DOT_COLOR[c]}
                        style={{filter:`drop-shadow(0 0 4px ${DOT_COLOR[c]})`}}
                      />
                    ))}
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* ── Table detail card ── */}
      {selected&&(
        <div style={{
          position:"absolute",top:58,right:16,zIndex:80,width:220,
          background:"rgba(6,6,16,0.95)",backdropFilter:"blur(16px)",
          border:`1px solid ${V.cyan}44`,borderRadius:24,
          padding:18,boxShadow:`0 8px 40px rgba(0,0,0,0.8),${GLOW(V.cyanGlow,12)}`,
        }}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
            <span style={{
              fontSize:20,fontWeight:900,
              color:STATUS_COLOR[selected.status].stroke,
            }}>שולחן {selected.num}</span>
            <div style={{
              padding:"2px 8px",borderRadius:20,fontSize:10,fontWeight:700,
              background:`${STATUS_COLOR[selected.status].stroke}18`,
              color:STATUS_COLOR[selected.status].stroke,
              border:`1px solid ${STATUS_COLOR[selected.status].stroke}30`,
            }}>{STATUS_COLOR[selected.status].label}</div>
            <button onClick={()=>setSelected(null)} style={{
              marginRight:"auto",background:"none",border:"none",
              color:V.muted,cursor:"pointer",fontSize:18,lineHeight:1,
            }}>✕</button>
          </div>
          {selected.status!=="free"&&<>
            <div style={{display:"flex",gap:14,marginBottom:14}}>
              {[
                {v:selected.guests,l:"אורחים",c:V.cyan},
                {v:`${selected.sinceMin}′`,l:"זמן",c:selected.sinceMin>=SLA?V.rose:V.amber},
              ].map(s=>(
                <div key={s.l}>
                  <div style={{fontSize:22,fontWeight:900,color:s.c}}>{s.v}</div>
                  <div style={{fontSize:10,color:V.muted}}>{s.l}</div>
                </div>
              ))}
              <div>
                <div style={{fontSize:13,fontWeight:700,color:V.sub}}>{selected.waiter}</div>
                <div style={{fontSize:10,color:V.muted}}>מלצר</div>
              </div>
            </div>
            <div style={{display:"flex",gap:8,marginBottom:14}}>
              {selected.courses.map((c,i)=>(
                <div key={i} style={{flex:1,textAlign:"center"}}>
                  <div style={{fontSize:18}}>{COURSE_E[i+1]}</div>
                  <div style={{
                    width:12,height:12,borderRadius:"50%",
                    background:DOT_COLOR[c],margin:"4px auto 0",
                    boxShadow:c!=="none"?`0 0 6px ${DOT_COLOR[c]}`:undefined,
                  }}/>
                  <div style={{fontSize:9,color:V.muted,marginTop:2}}>{COURSE_L[i+1]}</div>
                </div>
              ))}
            </div>
          </>}
          <div style={{display:"flex",gap:8}}>
            <button style={{
              flex:1,padding:"8px 0",borderRadius:12,border:"none",cursor:"pointer",
              background:`linear-gradient(135deg,${V.purple},${V.cyan})`,
              color:"#fff",fontWeight:700,fontSize:12,
            }}>💰 חשבון</button>
            <button style={{
              flex:1,padding:"8px 0",borderRadius:12,border:`1px solid ${V.border}`,
              cursor:"pointer",background:V.glass,color:V.sub,fontWeight:700,fontSize:12,
            }}>📋 פרטים</button>
          </div>
        </div>
      )}

      {/* ── Bottom drawer ── */}
      <div style={{
        position:"absolute",bottom:0,right:0,left:0,zIndex:60,
        height: drawerOpen ? 340 : 0,
        transition:"height 0.3s ease",overflow:"hidden",
        background:"rgba(6,6,16,0.97)",backdropFilter:"blur(18px)",
        borderTop:`1px solid ${V.border}`,
        borderTopLeftRadius:24,borderTopRightRadius:24,
      }}>
        {/* Tabs */}
        <div style={{
          display:"flex",gap:8,padding:"14px 24px 0",flexShrink:0,
        }}>
          {([
            {id:"fire",label:`🔥 להוצאה (${HELD.length})`,color:V.amber},
            {id:"wait",label:`⏳ המתנה (${waitlist.length})`,color:V.cyan},
            {id:"kpi", label:"📊 סטטוס",color:V.purple},
          ] as const).map(tab=>(
            <button key={tab.id}
              onClick={()=>setDrawerTab(tab.id)}
              style={{
                padding:"7px 18px",borderRadius:40,border:"none",cursor:"pointer",
                background: drawerTab===tab.id ? `${tab.color}22` : "transparent",
                color: drawerTab===tab.id ? tab.color : V.muted,
                fontWeight:700,fontSize:13,
                borderBottom: drawerTab===tab.id ? `2px solid ${tab.color}` : "2px solid transparent",
              }}
            >{tab.label}</button>
          ))}
        </div>

        <div style={{padding:"14px 24px 20px",overflowY:"auto",height:"calc(100% - 52px)"}}>

          {/* Fire */}
          {drawerTab==="fire"&&(
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {HELD.map(h=>{
                const key=`${h.tableNum}:${h.course}`;
                const firing=firingKey===key;
                return (
                  <div key={key} style={{
                    display:"flex",alignItems:"center",gap:14,
                    padding:"14px 18px",borderRadius:18,
                    background:`${V.amber}0a`,border:`1px solid ${V.amber}25`,
                  }}>
                    <div style={{fontSize:36}}>{COURSE_E[h.course]}</div>
                    <div style={{flex:1}}>
                      <div style={{
                        fontSize:15,fontWeight:700,color:V.text,
                      }}>שולחן {h.tableNum} · {COURSE_L[h.course]}</div>
                      <div style={{fontSize:12,color:V.muted}}>
                        {h.count}× {h.items.join(", ")}
                      </div>
                    </div>
                    <button
                      onClick={()=>fireHeld(h)} disabled={!!firingKey}
                      style={{
                        padding:"10px 24px",borderRadius:40,border:"none",cursor:firing?"default":"pointer",
                        background: firing
                          ? V.glass
                          :`linear-gradient(135deg,${V.rose},${V.amber})`,
                        color: firing ? V.muted : "#fff",
                        fontWeight:900,fontSize:22,
                        boxShadow: firing ? "none" : GLOW(V.amberGlow,10),
                        transition:"all 0.2s",
                      }}
                    >{firing?"...":"🔥"}</button>
                  </div>
                );
              })}
              {HELD.length===0&&<div style={{textAlign:"center",color:V.muted,padding:32,fontSize:14}}>
                ✓ אין קורסים ממתינים
              </div>}
            </div>
          )}

          {/* Waitlist */}
          {drawerTab==="wait"&&(
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {waitlist.map((p,i)=>{
                const urgent=p.sinceMin>=20;
                return (
                  <div key={p.id} style={{
                    display:"flex",alignItems:"center",gap:12,
                    padding:"12px 16px",borderRadius:18,
                    background: urgent?`${V.rose}0a`:V.glass,
                    border:`1px solid ${urgent?V.rose+"30":V.border}`,
                  }}>
                    <div style={{
                      width:36,height:36,borderRadius:"50%",flexShrink:0,
                      background:`${V.cyan}18`,border:`1.5px solid ${V.cyan}40`,
                      display:"flex",alignItems:"center",justifyContent:"center",
                      fontSize:15,fontWeight:900,color:V.cyan,
                    }}>#{i+1}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:14,fontWeight:700}}>{p.name}</div>
                      <div style={{fontSize:11,color:urgent?V.rose:V.muted}}>
                        👤{p.guests} · {fmtM(p.sinceMin)} {urgent?"⚠️":""}
                      </div>
                    </div>
                    <button
                      onClick={()=>setWaitlist(w=>w.filter(x=>x.id!==p.id))}
                      style={{
                        padding:"8px 20px",borderRadius:40,border:"none",cursor:"pointer",
                        background:`linear-gradient(135deg,${V.emerald},${V.cyan})`,
                        color:"#000",fontWeight:700,fontSize:13,
                        boxShadow:GLOW(V.emeraldGlow,8),
                      }}>הושב</button>
                  </div>
                );
              })}
              {waitlist.length===0&&<div style={{textAlign:"center",color:V.muted,padding:32,fontSize:14}}>
                אין ממתינים
              </div>}
            </div>
          )}

          {/* KPI */}
          {drawerTab==="kpi"&&(
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
              {[
                {l:"הכנסה היום",v:"₪6,840",c:V.cyan},
                {l:"הזמנות",   v:"31",     c:V.purple},
                {l:"פנויים",   v:"5/15",   c:V.emerald},
                {l:"SLA חריגות",v:breachedCount,c:breachedCount?V.rose:V.emerald},
                {l:"ממוצע המתנה",v:"8′",   c:V.sub},
                {l:"ממתינים",  v:waitlist.length,c:waitlist.length?V.amber:V.muted},
              ].map(k=>(
                <div key={k.l} style={{
                  background:`${k.c}0d`,border:`1px solid ${k.c}25`,
                  borderRadius:18,padding:"16px",textAlign:"center",
                }}>
                  <div style={{fontSize:28,fontWeight:900,color:k.c}}>{k.v}</div>
                  <div style={{fontSize:11,color:V.muted,marginTop:4}}>{k.l}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div style={{
        position:"absolute",bottom: drawerOpen ? 348 : 12,left:16,
        display:"flex",gap:8,zIndex:40,
        transition:"bottom 0.3s",
      }}>
        {([
          [V.emerald,"פנוי"],[V.amber,"תפוס"],[V.rose,"חשבון"],[V.purple,"הושב"],
        ] as [string,string][]).map(([c,l])=>(
          <div key={l} style={{
            display:"flex",alignItems:"center",gap:5,
            padding:"4px 10px",borderRadius:20,
            background:"rgba(6,6,16,0.85)",backdropFilter:"blur(6px)",
            border:`1px solid ${c}30`,fontSize:10,
          }}>
            <div style={{width:7,height:7,borderRadius:"50%",background:c,
              boxShadow:GLOW(`${c}`,6)}}/>
            <span style={{color:V.sub}}>{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
