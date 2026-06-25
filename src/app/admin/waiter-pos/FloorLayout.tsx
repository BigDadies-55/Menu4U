"use client";

import React, { useRef, useState, useEffect } from "react";
import { T } from "@/lib/ui";
import {
  type TableData, type Insight,
  STATUS_BORDER, STATUS_LABEL, ORDER_STATUS_HE,
  fmtTimer,
} from "./useWaiterPos";

// ── Geometry / shapes — mirrored 1:1 from the layout-builder so the waiter floor
//    renders tables, chairs and the bar exactly like the planner. ──
type TableShape = "round" | "rect" | "square" | "oval" | "long" | "banquet";

const SHAPE_BR: Record<TableShape, string> = {
  round: "50%", rect: "10px", square: "8px", oval: "50%/40%", long: "12px", banquet: "6px",
};

type LTable = {
  num: number | string; name?: string; shape?: TableShape;
  x: number; y: number; w: number; h: number; seats?: number; rot?: number; barId?: string;
};
type BarUnit = { id: string; x: number; y: number; w: number; h: number; rot: number; label: string };
type Room = { tables?: LTable[]; bars?: BarUnit[] };

// Live status → the colour that paints the border + chairs (white body, as in the builder).
const STATUS_COLOR: Record<string, string> = {
  occupied: "#EF4444", reserved: "#3B82F6", free: "#10B981",
  inactive: "#9ca3af", bill_requested: "#F97316", paid: "#34d399",
};

const SEAT_MARGIN = 36; // room for chairs that project outside the table bounds

/* ── Seat indicators — identical geometry to the builder's SeatIndicators ── */
function SeatIndicators({ w, h, shape, seats, seatedCount, color, barOut }: {
  w: number; h: number; shape: TableShape; seats: number; seatedCount: number; color: string; barOut?: number;
}) {
  const mx = Math.min(seats, 24);
  const D = 27, R = D / 2;
  const IN = 0.1 * D;
  const pts: { left: number; top: number }[] = [];
  if (barOut != null) {
    const rad = barOut * Math.PI / 180;
    const rx = w / 2 + R - IN, ry = h / 2 + R - IN;
    const spread = 0.5;
    for (let i = 0; i < mx; i++) {
      const a = rad + (i - (mx - 1) / 2) * spread;
      pts.push({ left: w / 2 + rx * Math.cos(a) - R, top: h / 2 + ry * Math.sin(a) - R });
    }
  } else if (shape === "round" || shape === "oval") {
    const rx = w / 2 + R - IN, ry = h / 2 + R - IN;
    for (let i = 0; i < mx; i++) {
      const a = (2 * Math.PI * i / mx) - Math.PI / 2;
      pts.push({ left: w / 2 + rx * Math.cos(a) - R, top: h / 2 + ry * Math.sin(a) - R });
    }
  } else {
    const topN = Math.ceil(mx / 2), botN = mx - topN;
    for (let i = 0; i < topN; i++) pts.push({ left: w * (i + 1) / (topN + 1) - R, top: -(D - IN) });
    for (let i = 0; i < botN; i++) pts.push({ left: w * (i + 1) / (botN + 1) - R, top: h - IN });
  }
  return (
    <>
      {pts.map((p, i) => (
        <div key={i} style={{
          position: "absolute", width: D, height: D, borderRadius: "50%",
          background: i < seatedCount ? color : "#ffffff",
          border: `2px solid ${color}`, left: p.left, top: p.top,
          pointerEvents: "none", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        }} />
      ))}
    </>
  );
}

export default function FloorLayout({ room, liveTables, insights, myTableNums, rotation, onTableClick, onTableContext }: {
  room: Room | undefined;
  liveTables: TableData[];
  insights: Insight[];
  myTableNums: Set<string> | null;
  rotation: 0 | 90;
  onTableClick: (tableNum: string) => void;
  onTableContext?: (tableNum: string, x: number, y: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 600, h: 400 });

  useEffect(() => {
    if (!ref.current) return;
    const obs = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setSize({ w: width, h: height });
    });
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  const tables = room?.tables ?? [];
  const bars = room?.bars ?? [];

  // Content bounds (+margin for outward-projecting chairs).
  let maxX = 0, maxY = 0;
  for (const t of tables) { maxX = Math.max(maxX, t.x + t.w); maxY = Math.max(maxY, t.y + t.h); }
  for (const b of bars) { maxX = Math.max(maxX, b.x + b.w); maxY = Math.max(maxY, b.y + b.h); }
  const contentW = maxX + SEAT_MARGIN, contentH = maxY + SEAT_MARGIN;

  const boxW = rotation === 90 ? contentH : contentW;
  const boxH = rotation === 90 ? contentW : contentH;
  const scale = (maxX && maxY) ? Math.min(size.w / boxW, size.h / boxH) : 1;
  const offX = Math.max(0, (size.w - boxW * scale) / 2);
  const offY = Math.max(0, (size.h - boxH * scale) / 2);

  const barById = new Map(bars.map(b => [b.id, b]));

  return (
    <div ref={ref} style={{ flex: 1, position: "relative", overflow: "hidden", background: "rgba(0,0,0,0.3)", borderRadius: 16 }}>
      {tables.length === 0 && bars.length === 0 ? (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.6)", fontSize: 14 }}>
          אין פריסת שולחנות — הגדר פריסה בבונה הפריסה
        </div>
      ) : (
        <div style={{ position: "absolute", left: offX, top: offY }}>
          <div style={{ transformOrigin: "0 0", transform: `scale(${scale})`, width: boxW, height: boxH, position: "relative" }}>
            <div style={{ position: "absolute", left: (boxW - contentW) / 2, top: (boxH - contentH) / 2, width: contentW, height: contentH, transform: `rotate(${rotation}deg)`, transformOrigin: "center center" }}>

              {/* Bar counters (behind stools) */}
              {bars.map(bar => (
                <div key={bar.id} style={{ position: "absolute", left: bar.x, top: bar.y, width: bar.w, height: bar.h, transform: `rotate(${bar.rot}deg)`, transformOrigin: "center" }}>
                  <div style={{ position: "absolute", inset: 0, borderRadius: 10, background: "#ffffff", border: `2px solid ${T.gold}`, boxShadow: "0 3px 14px rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: T.gold, letterSpacing: 1 }}>🍸 {bar.label}</span>
                  </div>
                </div>
              ))}

              {/* Tables + chairs */}
              {tables.map(lt => {
                const tNum    = String(lt.num);
                const tData   = liveTables.find(t => t.tableNum === tNum);
                const status  = tData?.availStatus ?? "free";
                const isMine  = myTableNums === null || myTableNums.has(tNum);
                const color   = isMine ? (STATUS_COLOR[status] ?? STATUS_BORDER[status] ?? "#9ca3af") : "#555";
                const shape   = (lt.shape ?? "square") as TableShape;
                const seats   = lt.seats ?? tData?.seats ?? 0;
                const isOcc   = status === "occupied" || status === "bill_requested";
                const seated  = isOcc ? Math.min(tData?.guests ?? 0, seats) : 0;
                const tIns    = isMine ? insights.filter(i => i.tableNum === tNum) : [];
                const barOut  = lt.barId ? ((barById.get(lt.barId)?.rot ?? 0) + 90) : undefined;
                const fSz     = Math.max(11, Math.min(lt.w, lt.h) * 0.22);
                const showLine = lt.w > 50 && lt.h > 46;
                const statusText = isMine
                  ? (status === "occupied" ? (ORDER_STATUS_HE[tData?.orderStatus ?? ""] ?? STATUS_LABEL[status]) : STATUS_LABEL[status])
                  : STATUS_LABEL[status];

                return (
                  <div key={`${tNum}`}
                    onClick={() => isMine && onTableClick(tNum)}
                    onContextMenu={e => { if (isMine && onTableContext) { e.preventDefault(); onTableContext(tNum, e.clientX, e.clientY); } }}
                    style={{
                      position: "absolute", left: lt.x, top: lt.y, width: lt.w, height: lt.h,
                      transform: `rotate(${lt.rot ?? 0}deg)`, transformOrigin: "center",
                      cursor: isMine ? "pointer" : "not-allowed", opacity: isMine ? 1 : 0.4,
                      animation: tIns.length > 0 ? "insightPulse 2.5s ease-in-out infinite" : undefined,
                    }}
                  >
                    <SeatIndicators w={lt.w} h={lt.h} shape={shape} seats={seats} seatedCount={seated} color={color} barOut={barOut} />

                    {/* Table body — white, status-coloured border, exact shape radius */}
                    <div style={{ position: "absolute", inset: 0, borderRadius: SHAPE_BR[shape], background: "#ffffff", border: `2px solid ${color}`, boxShadow: "0 3px 14px rgba(0,0,0,0.4)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "45%", background: "linear-gradient(180deg,rgba(255,255,255,0.07) 0%,transparent 100%)", pointerEvents: "none" }} />

                      {/* Insight marker */}
                      {tIns.length > 0 && (
                        <span style={{ position: "absolute", top: 3, left: 4, fontSize: 13, lineHeight: 1 }}>
                          {tIns[0].type === "alert" ? "⚠️" : tIns[0].type === "tip" ? "💡" : "ℹ️"}
                        </span>
                      )}

                      <div style={{ display: "flex", alignItems: "baseline", gap: 4, zIndex: 1 }}>
                        <span style={{ fontSize: fSz, fontWeight: 900, color, lineHeight: 1 }}>{tNum}</span>
                        {seats > 0 && <span style={{ fontSize: Math.max(9, fSz * 0.6), fontWeight: 700, color: "#64748b", lineHeight: 1 }}>({seats})</span>}
                      </div>

                      {showLine && isOcc && tData && (
                        <span style={{ fontSize: Math.max(8, fSz * 0.5), fontWeight: 700, color: "#475569", marginTop: 2, fontVariantNumeric: "tabular-nums", zIndex: 1 }}>{fmtTimer(tData.sittingStart)}</span>
                      )}
                      {showLine && (
                        <span style={{ fontSize: Math.max(7, fSz * 0.46), color: "#94a3b8", marginTop: 1, zIndex: 1, maxWidth: lt.w - 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{statusText}</span>
                      )}
                    </div>
                  </div>
                );
              })}

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
