"use client";

import { useMemo, useState } from "react";
import { T } from "@/lib/ui";
import PageShell from "@/components/admin/PageShell";

type Station = {
  id: string;
  restaurantId: string;
  code: string;
  label: string;
  isActive: boolean;
  skipKitchen: boolean;
  sortOrder: number;
  categoryCount: number;
};

type Restaurant = { id: string; name: string };

export default function KitchenManagementClient({
  restaurants,
  initialStations,
}: {
  restaurants: Restaurant[];
  initialStations: Station[];
}) {
  const [stations, setStations] = useState<Station[]>(initialStations);
  const [restaurantId, setRestaurantId] = useState<string>(restaurants[0]?.id ?? "");
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // new-station form
  const [newCode, setNewCode] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newSkip, setNewSkip] = useState(false);

  const list = useMemo(
    () => stations.filter(s => s.restaurantId === restaurantId).sort((a, b) => a.sortOrder - b.sortOrder),
    [stations, restaurantId],
  );

  function flash(ok: boolean, msg: string) {
    setToast({ ok, msg });
    setTimeout(() => setToast(null), 3000);
  }

  async function patch(id: string, body: Partial<Pick<Station, "isActive" | "label" | "skipKitchen">>) {
    setBusy(true);
    const prev = stations;
    setStations(s => s.map(x => (x.id === id ? { ...x, ...body } : x)));
    try {
      const r = await fetch(`/api/admin/kitchen-stations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error();
    } catch {
      setStations(prev);
      flash(false, "השמירה נכשלה");
    } finally {
      setBusy(false);
    }
  }

  async function addStation() {
    const code = newCode.trim().toUpperCase();
    const label = newLabel.trim();
    if (!code || !label) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/kitchen-stations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, code, label, skipKitchen: newSkip }),
      });
      const data = await r.json();
      if (!r.ok) { flash(false, data?.error ?? "ההוספה נכשלה"); return; }
      setStations(s => [...s, { ...data, categoryCount: 0 }]);
      setNewCode(""); setNewLabel(""); setNewSkip(false);
      flash(true, "תחנה נוספה");
    } catch {
      flash(false, "ההוספה נכשלה");
    } finally {
      setBusy(false);
    }
  }

  async function removeStation(s: Station) {
    if (s.categoryCount > 0) {
      flash(false, `יש להעביר ${s.categoryCount} קטגוריות לתחנה אחרת לפני מחיקה`);
      return;
    }
    if (!confirm(`למחוק את התחנה "${s.label}"?`)) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/kitchen-stations/${s.id}`, { method: "DELETE" });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) { flash(false, data?.message ?? "המחיקה נכשלה"); return; }
      setStations(st => st.filter(x => x.id !== s.id));
      flash(true, "תחנה נמחקה");
    } catch {
      flash(false, "המחיקה נכשלה");
    } finally {
      setBusy(false);
    }
  }

  const card: React.CSSProperties = {
    background: T.panel, border: `1px solid ${T.border}`, borderRadius: 14,
    padding: 16, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
  };

  return (
    <PageShell title="🍳 ניהול מטבח" subtitle="שיוך מנות — תחנות מטבח פר-מסעדה">
      {/* Restaurant selector */}
      {restaurants.length > 1 && (
        <div style={{ marginBottom: 18 }}>
          <select
            value={restaurantId}
            onChange={e => setRestaurantId(e.target.value)}
            style={{
              background: T.surface, color: T.text, border: `1px solid ${T.border}`,
              borderRadius: 10, padding: "9px 14px", fontSize: 14, fontFamily: "inherit", minWidth: 200,
            }}
          >
            {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
      )}

      {/* Stations list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
        {list.length === 0 && (
          <div style={{ color: T.muted, fontSize: 14, padding: 20 }}>אין תחנות למסעדה זו.</div>
        )}
        {list.map(s => (
          <div key={s.id} style={{ ...card, opacity: s.isActive ? 1 : 0.55 }}>
            <span style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 38, height: 38, borderRadius: 10, flexShrink: 0,
              background: T.goldSub, color: T.gold, fontWeight: 800, fontSize: 16,
            }}>{s.code}</span>

            <input
              value={s.label}
              onChange={e => setStations(st => st.map(x => x.id === s.id ? { ...x, label: e.target.value } : x))}
              onBlur={e => { const v = e.target.value.trim(); if (v && v !== initialLabel(initialStations, s.id)) patch(s.id, { label: v }); }}
              style={{ background: "transparent", color: T.text, border: "none", borderBottom: `1px solid ${T.border}`, fontSize: 15, fontWeight: 600, padding: "4px 2px", minWidth: 120, fontFamily: "inherit", outline: "none" }}
            />

            <span style={{ fontSize: 12, color: T.muted }}>{s.categoryCount} קטגוריות</span>

            {/* skipKitchen */}
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: T.sub, cursor: "pointer" }}>
              <input type="checkbox" checked={s.skipKitchen} disabled={busy} onChange={e => patch(s.id, { skipKitchen: e.target.checked })} />
              מדלג על המטבח
            </label>

            <div style={{ marginInlineStart: "auto", display: "flex", alignItems: "center", gap: 10 }}>
              {/* active toggle */}
              <button
                onClick={() => patch(s.id, { isActive: !s.isActive })}
                disabled={busy}
                style={{
                  position: "relative", width: 44, height: 24, borderRadius: 12, border: "none",
                  background: s.isActive ? T.gold : T.raised, cursor: "pointer", transition: "background .2s",
                }}
                title={s.isActive ? "פעיל" : "כבוי"}
              >
                <span style={{ position: "absolute", top: 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "all .2s", insetInlineStart: s.isActive ? 23 : 3 }} />
              </button>
              <button
                onClick={() => removeStation(s)}
                disabled={busy}
                style={{ background: "transparent", border: `1px solid ${T.border}`, color: T.red, borderRadius: 8, padding: "5px 12px", fontSize: 12, cursor: "pointer" }}
              >
                מחק
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add new station */}
      <div style={{ ...card, alignItems: "flex-end" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 11, color: T.muted }}>קוד</label>
          <input value={newCode} onChange={e => setNewCode(e.target.value)} maxLength={3} placeholder="X"
            style={{ background: T.surface, color: T.text, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 10px", width: 64, fontSize: 14, fontFamily: "inherit", textAlign: "center" }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 160 }}>
          <label style={{ fontSize: 11, color: T.muted }}>שם תחנה</label>
          <input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="לדוגמה: GRILL"
            style={{ background: T.surface, color: T.text, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 14, fontFamily: "inherit" }} />
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: T.sub, cursor: "pointer", paddingBottom: 8 }}>
          <input type="checkbox" checked={newSkip} onChange={e => setNewSkip(e.target.checked)} />
          מדלג על המטבח
        </label>
        <button onClick={addStation} disabled={busy || !newCode.trim() || !newLabel.trim()}
          style={{ background: T.gold, color: "#1a1208", border: "none", borderRadius: 10, padding: "9px 18px", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
          + הוסף תחנה
        </button>
      </div>

      {toast && (
        <div style={{
          position: "fixed", bottom: 24, insetInlineStart: "50%", transform: "translateX(-50%)", zIndex: 2000,
          background: toast.ok ? T.green : T.red, color: "#fff", borderRadius: 12,
          padding: "10px 20px", fontSize: 14, fontWeight: 600, boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        }}>{toast.msg}</div>
      )}
    </PageShell>
  );
}

function initialLabel(initial: Station[], id: string): string {
  return initial.find(s => s.id === id)?.label ?? "";
}
