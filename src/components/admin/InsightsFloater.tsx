"use client";
import { useState, useEffect, useCallback } from "react";
import { T } from "@/lib/ui";
import type { TableInput, Insight, InsightType } from "@/lib/waiter-insights";

const TYPE_BG: Record<InsightType, string>     = { alert: T.redSub,    tip: "#fff8ed", info: T.greenSub  };
const TYPE_BORDER: Record<InsightType, string> = { alert: T.red+"44",  tip: "#f97316", info: T.green+"44" };
const TYPE_COLOR: Record<InsightType, string>  = { alert: T.red,       tip: "#f97316", info: T.green     };
const TYPE_ICON: Record<InsightType, string>   = { alert: "⚠️",        tip: "💡",      info: "ℹ️"        };

interface Props {
  restaurantId: string;
  tables: TableInput[];
  refreshMs?: number;
}

export default function InsightsFloater({ restaurantId, tables, refreshMs = 30000 }: Props) {
  const [open, setOpen]         = useState(false);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading]   = useState(false);

  const fetch_ = useCallback(async () => {
    if (!restaurantId || tables.length === 0) return;
    setLoading(true);
    try {
      const r = await fetch("/api/admin/waiter-pos/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, tables }),
      });
      if (r.ok) setInsights((await r.json()).insights ?? []);
    } finally { setLoading(false); }
  }, [restaurantId, tables]);

  useEffect(() => {
    fetch_();
    const id = setInterval(fetch_, refreshMs);
    return () => clearInterval(id);
  }, [fetch_, refreshMs]);

  const alertCount = insights.filter(i => i.type === "alert").length;

  return (
    <div style={{ position: "relative" }}>
      {/* Badge button */}
      <button onClick={() => setOpen(o => !o)} style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "5px 12px", borderRadius: 8,
        background: open ? T.goldSub : T.panel,
        border: `1px solid ${open ? T.gold : T.border}`,
        color: open ? T.gold : T.sub,
        fontSize: 13, cursor: "pointer",
        transition: "all 0.15s",
        position: "relative",
      }}>
        <span>✨ תובנות</span>
        {insights.length > 0 && (
          <span style={{
            background: alertCount > 0 ? T.red : T.green,
            color: "#fff", borderRadius: 9, fontSize: 11, fontWeight: 800,
            padding: "1px 6px", minWidth: 18, textAlign: "center",
          }}>
            {insights.length}
          </span>
        )}
        {loading && <span style={{ fontSize: 10, color: T.muted }}>⟳</span>}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 8px)", left: 0,
          minWidth: 300, maxWidth: 380,
          background: T.surface, border: `1px solid ${T.border}`,
          borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          zIndex: 500, overflow: "hidden",
          direction: "rtl",
        }}>
          <div style={{ padding: "10px 14px", borderBottom: `1px solid ${T.border}`, fontSize: 12, fontWeight: 800, color: T.sub }}>
            ✨ תובנות פעילות
          </div>
          {insights.length === 0 ? (
            <div style={{ padding: "16px 14px", color: T.muted, fontSize: 13 }}>
              {loading ? "מחשב תובנות..." : "אין תובנות כרגע"}
            </div>
          ) : (
            insights.map((ins, i) => (
              <div key={i} style={{
                display: "flex", gap: 10, alignItems: "flex-start",
                padding: "10px 14px",
                background: TYPE_BG[ins.type],
                borderBottom: i < insights.length - 1 ? `1px solid ${T.borderSub}` : "none",
              }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>{TYPE_ICON[ins.type]}</span>
                <span style={{
                  fontSize: 13, color: TYPE_COLOR[ins.type], fontWeight: 600,
                  lineHeight: 1.4,
                }}>
                  {ins.text}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
