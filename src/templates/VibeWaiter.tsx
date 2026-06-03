"use client";
/**
 * TEMPLATE: Waiter — "Vibe"
 * Dark glass · neon purple/cyan · zero learning curve
 * Flow: pick table (tap circle) → menu (photo grid) → floating cart pill
 */
import React, { useState } from "react";
import { T } from "@/lib/ui";

// ── Design tokens (mapped from T — edit src/lib/ui.ts to change) ──
const V = {
  bg:          T.bgNeon,
  glass:       T.glass,
  glassHover:  T.glassHover,
  border:      T.glassBorder,
  borderBright:T.glassBorderBright,
  purple:      T.purple,
  purpleDim:   T.purpleSub,
  purpleGlow:  T.purpleGlow,
  cyan:        T.cyan,
  cyanDim:     T.cyanSub,
  cyanGlow:    T.cyanGlow,
  rose:        T.rose,
  roseDim:     T.roseSub,
  amber:       T.amber,
  emerald:     T.emerald,
  text:        T.text,
  sub:         "rgba(241,245,249,0.6)",
  muted:       "rgba(241,245,249,0.32)",
};

const GLOW = (color: string, size = 20) =>
  `0 0 ${size}px ${color}, 0 0 ${size * 3}px ${color.replace("0.4","0.12")}`;

// ── Mock menu ──────────────────────────────────────────────
const MENU = [
  { id:"sal", emoji:"🥗", name:"סלטים", items:[
    { id:"s1", emoji:"🥗", name:"ים תיכוני",  price:52, tag:"טבעוני" },
    { id:"s2", emoji:"🥬", name:"קיסר",       price:58, tag:"קלאסי"  },
    { id:"s3", emoji:"🥩", name:"קרפצ'יו",    price:72, tag:"חדש"    },
    { id:"s4", emoji:"🌽", name:"גריל עונתי", price:64, tag:""       },
  ]},
  { id:"main", emoji:"🍖", name:"עיקריות", items:[
    { id:"m1", emoji:"🐟", name:"פילה סלמון",   price:128, tag:"הכי נמכר" },
    { id:"m2", emoji:"🥩", name:"אנטריקוט",     price:168, tag:"פרימיום"  },
    { id:"m3", emoji:"🍝", name:"פסטה טרטופו",  price:88,  tag:"טבעוני"   },
    { id:"m4", emoji:"🍚", name:"ריזוטו פטריות",price:86,  tag:""         },
    { id:"m5", emoji:"🍗", name:"פרגית גריל",   price:94,  tag:"חריף"     },
    { id:"m6", emoji:"🍖", name:"שוק טלה",      price:142, tag:"שף"       },
  ]},
  { id:"des", emoji:"🍮", name:"קינוחים", items:[
    { id:"d1", emoji:"🍮", name:"קרם ברולה",      price:42, tag:"קלאסי" },
    { id:"d2", emoji:"🍫", name:"פונדן שוקולד",   price:48, tag:"חם"    },
    { id:"d3", emoji:"🍦", name:"פנה קוטה",       price:38, tag:""      },
  ]},
  { id:"drinks", emoji:"🍷", name:"שתייה", items:[
    { id:"dr1", emoji:"🍷", name:"יין אדום כוס",  price:44, tag:"" },
    { id:"dr2", emoji:"🍺", name:"בירה חבית",     price:32, tag:"" },
    { id:"dr3", emoji:"🍹", name:"קוקטייל הבית",  price:54, tag:"חדש" },
  ]},
];

type CartItem = { id:string; name:string; price:number; emoji:string; qty:number };

// ── Table picker ───────────────────────────────────────────
function TablePicker({ onPick }: { onPick:(t:string,g:number)=>void }) {
  const [sel, setSel] = useState("");
  const [guests, setGuests] = useState(2);

  return (
    <div style={{
      height:"100%", display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center", gap:32, padding:"24px 16px",
    }}>
      <div style={{ textAlign:"center" }}>
        <div style={{
          fontSize:36, fontWeight:900, letterSpacing:"-0.02em",
          background:`linear-gradient(135deg, ${V.purple}, ${V.cyan})`,
          WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
          lineHeight:1.1,
        }}>איזה שולחן?</div>
        <div style={{ fontSize:14, color:V.muted, marginTop:6 }}>בחר ולחץ</div>
      </div>

      {/* Table grid */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(6,56px)", gap:10 }}>
        {Array.from({length:24},(_,i)=>String(i+1)).map(t=>(
          <button key={t} onClick={()=>setSel(t)} style={{
            width:56, height:56, borderRadius:16,
            background: sel===t ? V.purpleDim : V.glass,
            border:`1.5px solid ${sel===t ? V.purple : V.border}`,
            color: sel===t ? V.purple : V.sub,
            fontWeight:800, fontSize:18, cursor:"pointer",
            boxShadow: sel===t ? GLOW(V.purpleGlow,8) : "none",
            transition:"all 0.18s",
          }}>{t}</button>
        ))}
      </div>

      {/* Guest count */}
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        <span style={{ fontSize:13, color:V.muted }}>👤 אורחים</span>
        <div style={{ display:"flex", gap:6 }}>
          {[1,2,3,4,5,6,7,8].map(g=>(
            <button key={g} onClick={()=>setGuests(g)} style={{
              width:38, height:38, borderRadius:"50%",
              background: guests===g
                ? `linear-gradient(135deg,${V.purple},${V.cyan})`
                : V.glass,
              border:`1px solid ${guests===g ? "transparent" : V.border}`,
              color: guests===g ? "#fff" : V.sub,
              fontWeight:700, fontSize:15, cursor:"pointer",
              boxShadow: guests===g ? GLOW(V.purpleGlow,6) : "none",
              transition:"all 0.18s",
            }}>{g}</button>
          ))}
        </div>
      </div>

      <button
        onClick={()=>sel && onPick(sel, guests)}
        disabled={!sel}
        style={{
          padding:"14px 48px", borderRadius:40,
          background: sel
            ? `linear-gradient(135deg,${V.purple},${V.cyan})`
            : V.glass,
          border:"none", color: sel ? "#fff" : V.muted,
          fontSize:17, fontWeight:900, cursor: sel ? "pointer" : "default",
          boxShadow: sel ? GLOW(V.purpleGlow,12) : "none",
          transition:"all 0.2s", letterSpacing:"0.01em",
        }}
      >{sel ? `יאללה — שולחן ${sel} 🚀` : "בחר שולחן"}</button>
    </div>
  );
}

// ── Menu screen ────────────────────────────────────────────
function MenuScreen({ tableNum, guests, onBack }: { tableNum:string; guests:number; onBack:()=>void }) {
  const [catId, setCatId]     = useState(MENU[0].id);
  const [cart,  setCart]      = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [sending,  setSending]  = useState(false);
  const [sent,     setSent]     = useState(false);

  const cat   = MENU.find(c=>c.id===catId)!;
  const total = cart.reduce((s,i)=>s+i.price*i.qty,0);
  const count = cart.reduce((s,i)=>s+i.qty,0);

  function add(item: typeof MENU[0]["items"][0]) {
    setCart(prev=>{
      const ex = prev.find(c=>c.id===item.id);
      if (ex) return prev.map(c=>c.id===item.id?{...c,qty:c.qty+1}:c);
      return [...prev,{id:item.id,name:item.name,price:item.price,emoji:item.emoji,qty:1}];
    });
  }
  function remove(id:string) {
    setCart(prev=>prev.map(c=>c.id===id?{...c,qty:c.qty-1}:c).filter(c=>c.qty>0));
  }

  async function send() {
    setSending(true);
    await new Promise(r=>setTimeout(r,1400));
    setSent(true);
    setTimeout(()=>{setSent(false);setSending(false);setCart([]);setCartOpen(false);onBack();},1800);
  }

  if (sent) return (
    <div style={{
      height:"100%", display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center", gap:16,
      background:V.bg,
    }}>
      <div style={{ fontSize:80 }}>✅</div>
      <div style={{
        fontSize:28, fontWeight:900,
        background:`linear-gradient(135deg,${V.emerald},${V.cyan})`,
        WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
      }}>הזמנה נשלחה!</div>
      <div style={{ fontSize:15, color:V.muted }}>שולחן {tableNum}</div>
    </div>
  );

  return (
    <div style={{
      height:"100%", display:"flex", flexDirection:"column",
      position:"relative", overflow:"hidden",
    }}>
      {/* Header */}
      <div style={{
        padding:"12px 20px", display:"flex", alignItems:"center", gap:12,
        background:"rgba(7,5,15,0.9)", backdropFilter:"blur(20px)",
        borderBottom:`1px solid ${V.border}`, flexShrink:0,
      }}>
        <button onClick={onBack} style={{
          width:36,height:36,borderRadius:12,
          background:V.glass,border:`1px solid ${V.border}`,
          color:V.sub,cursor:"pointer",fontSize:18,display:"flex",
          alignItems:"center",justifyContent:"center",
        }}>←</button>
        <div>
          <span style={{
            fontSize:20,fontWeight:900,
            background:`linear-gradient(90deg,${V.purple},${V.cyan})`,
            WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",
          }}>שולחן {tableNum}</span>
          <span style={{fontSize:13,color:V.muted,marginRight:8}}>· {guests} אורחים</span>
        </div>
      </div>

      {/* Category pills */}
      <div style={{
        display:"flex",gap:8,padding:"12px 20px",
        overflowX:"auto",flexShrink:0,
        background:"rgba(7,5,15,0.7)",backdropFilter:"blur(12px)",
        borderBottom:`1px solid ${V.border}`,
      }}>
        {MENU.map(c=>(
          <button key={c.id} onClick={()=>setCatId(c.id)} style={{
            padding:"8px 20px",borderRadius:40,whiteSpace:"nowrap",
            background: catId===c.id
              ? `linear-gradient(135deg,${V.purple},${V.cyan})`
              : V.glass,
            border:`1px solid ${catId===c.id ? "transparent" : V.border}`,
            color: catId===c.id ? "#fff" : V.sub,
            fontSize:14,fontWeight:700,cursor:"pointer",
            boxShadow: catId===c.id ? GLOW(V.purpleGlow,8) : "none",
            transition:"all 0.2s",
          }}>{c.emoji} {c.name}</button>
        ))}
      </div>

      {/* Items grid */}
      <div style={{
        flex:1,overflowY:"auto",padding:"16px 20px",
        paddingBottom: count>0 ? 90 : 20,
      }}>
        <div style={{
          display:"grid",
          gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:12,
        }}>
          {cat.items.map(item=>{
            const inCart = cart.find(c=>c.id===item.id);
            return (
              <button key={item.id} onClick={()=>add(item)} style={{
                background: inCart ? V.purpleDim : V.glass,
                border:`1.5px solid ${inCart ? V.purple : V.border}`,
                borderRadius:20,padding:"18px 14px",cursor:"pointer",
                textAlign:"right",display:"flex",flexDirection:"column",gap:8,
                boxShadow: inCart ? GLOW(V.purpleGlow,6) : "none",
                transition:"all 0.18s",
              }}>
                <div style={{fontSize:40,lineHeight:1}}>{item.emoji}</div>
                <div style={{fontSize:14,fontWeight:700,color:V.text,lineHeight:1.3}}>{item.name}</div>
                {item.tag && (
                  <div style={{
                    display:"inline-block",padding:"2px 8px",borderRadius:20,
                    background:`${V.amber}20`,border:`1px solid ${V.amber}44`,
                    fontSize:10,fontWeight:700,color:V.amber,alignSelf:"flex-start",
                  }}>{item.tag}</div>
                )}
                <div style={{
                  display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:2,
                }}>
                  <span style={{
                    fontSize:18,fontWeight:900,
                    color: inCart ? V.purple : V.text,
                  }}>₪{item.price}</span>
                  {inCart && (
                    <div style={{
                      width:24,height:24,borderRadius:"50%",
                      background:`linear-gradient(135deg,${V.purple},${V.cyan})`,
                      display:"flex",alignItems:"center",justifyContent:"center",
                      fontSize:13,fontWeight:900,color:"#fff",
                    }}>{inCart.qty}</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Floating cart pill */}
      {count>0 && !cartOpen && (
        <div style={{
          position:"absolute",bottom:20,right:20,left:20,zIndex:100,
        }}>
          <button onClick={()=>setCartOpen(true)} style={{
            width:"100%",padding:"16px 24px",borderRadius:40,border:"none",
            background:`linear-gradient(135deg,${V.purple},${V.cyan})`,
            cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between",
            boxShadow:`${GLOW(V.purpleGlow,16)}, 0 8px 32px rgba(0,0,0,0.5)`,
          }}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{
                width:28,height:28,borderRadius:"50%",
                background:"rgba(255,255,255,0.25)",
                display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:13,fontWeight:900,color:"#fff",
              }}>{count}</div>
              <span style={{fontSize:16,fontWeight:900,color:"#fff"}}>הצג הזמנה</span>
            </div>
            <span style={{fontSize:17,fontWeight:900,color:"#fff"}}>₪{total}</span>
          </button>
        </div>
      )}

      {/* Cart sheet */}
      {cartOpen && (
        <div style={{
          position:"absolute",inset:0,zIndex:200,
          background:"rgba(7,5,15,0.7)",backdropFilter:"blur(8px)",
          display:"flex",flexDirection:"column",justifyContent:"flex-end",
        }}>
          <div style={{
            background:`linear-gradient(180deg,rgba(15,10,28,0.98) 0%,rgba(7,5,15,1) 100%)`,
            border:`1px solid ${V.border}`,
            borderTopLeftRadius:28,borderTopRightRadius:28,
            maxHeight:"75vh",display:"flex",flexDirection:"column",
            boxShadow:`0 -12px 48px rgba(168,85,247,0.15)`,
          }}>
            <div style={{
              padding:"20px 24px 12px",display:"flex",
              alignItems:"center",justifyContent:"space-between",flexShrink:0,
            }}>
              <div style={{
                fontSize:22,fontWeight:900,
                background:`linear-gradient(90deg,${V.purple},${V.cyan})`,
                WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",
              }}>ההזמנה שלך 🛒</div>
              <button onClick={()=>setCartOpen(false)} style={{
                width:36,height:36,borderRadius:12,
                background:V.glass,border:`1px solid ${V.border}`,
                color:V.sub,cursor:"pointer",fontSize:20,
              }}>✕</button>
            </div>

            <div style={{overflowY:"auto",flex:1,padding:"0 24px"}}>
              {cart.map(item=>(
                <div key={item.id} style={{
                  display:"flex",alignItems:"center",gap:12,
                  padding:"12px 0",borderBottom:`1px solid ${V.border}`,
                }}>
                  <span style={{fontSize:28}}>{item.emoji}</span>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:700,color:V.text}}>{item.name}</div>
                    <div style={{fontSize:12,color:V.muted}}>₪{item.price} ליחידה</div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <button onClick={()=>remove(item.id)} style={{
                      width:30,height:30,borderRadius:10,
                      background:V.glass,border:`1px solid ${V.border}`,
                      color:V.sub,cursor:"pointer",fontSize:18,
                    }}>−</button>
                    <span style={{fontSize:16,fontWeight:700,color:V.text,minWidth:20,textAlign:"center"}}>{item.qty}</span>
                    <button onClick={()=>add({id:item.id,name:item.name,price:item.price,emoji:item.emoji,tag:""})} style={{
                      width:30,height:30,borderRadius:10,
                      background:`linear-gradient(135deg,${V.purple},${V.cyan})`,
                      border:"none",color:"#fff",cursor:"pointer",fontSize:18,fontWeight:900,
                    }}>+</button>
                  </div>
                  <span style={{
                    fontSize:15,fontWeight:900,color:V.purple,minWidth:52,textAlign:"left",
                  }}>₪{item.price*item.qty}</span>
                </div>
              ))}
            </div>

            <div style={{padding:"16px 24px 28px",flexShrink:0}}>
              <button onClick={send} disabled={sending} style={{
                width:"100%",padding:"18px 0",borderRadius:40,border:"none",
                background:`linear-gradient(135deg,${V.purple},${V.cyan})`,
                cursor:"pointer",fontSize:18,fontWeight:900,color:"#fff",
                boxShadow:`${GLOW(V.purpleGlow,16)}, 0 8px 32px rgba(0,0,0,0.5)`,
                opacity: sending ? 0.7 : 1,
              }}>
                {sending ? "שולח... 🔥" : `📤 שלח למטבח · ₪${total}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Root ───────────────────────────────────────────────────
export default function VibeWaiter() {
  const [step, setStep] = useState<"table"|"menu">("table");
  const [tableNum, setTableNum] = useState("");
  const [guests,   setGuests]   = useState(2);

  return (
    <div style={{
      height:"calc(100vh - 64px)",
      background:V.bg,
      color:V.text,
      fontFamily:"system-ui,sans-serif",
      direction:"rtl",
      position:"relative",
      overflow:"hidden",
    }}>
      {/* Ambient background glow */}
      <div style={{
        position:"absolute",top:-200,right:"20%",
        width:600,height:600,borderRadius:"50%",
        background:`radial-gradient(circle,${V.purpleGlow.replace("0.45","0.08")} 0%,transparent 70%)`,
        pointerEvents:"none",
      }}/>
      <div style={{
        position:"absolute",bottom:-200,left:"10%",
        width:500,height:500,borderRadius:"50%",
        background:`radial-gradient(circle,${V.cyanGlow.replace("0.4","0.07")} 0%,transparent 70%)`,
        pointerEvents:"none",
      }}/>

      <div style={{position:"relative",height:"100%",zIndex:1}}>
        {step==="table"
          ? <TablePicker onPick={(t,g)=>{setTableNum(t);setGuests(g);setStep("menu");}}/>
          : <MenuScreen  tableNum={tableNum} guests={guests} onBack={()=>setStep("table")}/>
        }
      </div>
    </div>
  );
}
