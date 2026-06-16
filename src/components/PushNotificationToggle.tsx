"use client";
import { useState, useEffect, useRef } from "react";

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

const EVENT_LABELS: Record<string, string> = {
  ORDER_CREATED: "הזמנה חדשה נפתחה",
  COURSE_DONE:   "קורס מוכן להגשה",
  TABLE_PAYMENT: "שולחן ממתין לתשלום",
  ITEM_VOID:     "פריט בוטל (VOID)",
};
const ALL_EVENTS = Object.keys(EVENT_LABELS);

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

export default function PushNotificationToggle() {
  const [open, setOpen]           = useState(false);
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [events, setEvents]       = useState<string[]>(ALL_EVENTS);
  const [loading, setLoading]     = useState(false);
  const [msg, setMsg]             = useState("");
  const subRef = useRef<PushSubscription | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && VAPID_PUBLIC) {
      setSupported(true);
      checkStatus();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  async function checkStatus() {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) { setSubscribed(false); return; }
      subRef.current = sub;
      const params = new URLSearchParams({ endpoint: sub.endpoint });
      const res = await fetch(`/api/push/subscribe?${params}`);
      const data = await res.json();
      setSubscribed(data.subscribed);
      if (data.subscribed) setEvents(data.events ?? ALL_EVENTS);
    } catch { /* ignore */ }
  }

  async function handleSubscribe() {
    if (!VAPID_PUBLIC) { setMsg("VAPID key לא מוגדר"); return; }
    setLoading(true); setMsg("");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setMsg("הרשאת התראות נדחתה"); setLoading(false); return; }

      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
        });
      }
      subRef.current = sub;

      const json = sub.toJSON();
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: sub.endpoint,
          p256dh: json.keys?.p256dh,
          auth: json.keys?.auth,
          events,
        }),
      });
      setSubscribed(true);
      setMsg("✓ הרשמת להתראות!");
      setTimeout(() => setMsg(""), 2500);
    } catch (e) {
      setMsg("שגיאה: " + (e instanceof Error ? e.message : String(e)));
    }
    setLoading(false);
  }

  async function handleUnsubscribe() {
    setLoading(true);
    try {
      const sub = subRef.current;
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
        subRef.current = null;
      }
      setSubscribed(false);
      setMsg("ביטלת הרשמה");
      setTimeout(() => setMsg(""), 2000);
    } catch { setMsg("שגיאה בביטול"); }
    setLoading(false);
  }

  async function handleSaveEvents() {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) { setMsg("לא רשום — הרשם קודם"); setLoading(false); return; }
      const json = sub.toJSON();
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: sub.endpoint,
          p256dh: json.keys?.p256dh,
          auth: json.keys?.auth,
          events,
        }),
      });
      setMsg("✓ הגדרות נשמרו");
      setTimeout(() => setMsg(""), 2000);
    } catch { setMsg("שגיאה בשמירה"); }
    setLoading(false);
  }

  function toggleEvent(ev: string) {
    setEvents(prev => prev.includes(ev) ? prev.filter(e => e !== ev) : [...prev, ev]);
  }

  if (!supported) return null;

  return (
    <div style={{ position: "relative" }} ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(o => !o)}
        title="התראות Push"
        style={{
          width: 36, height: 36, borderRadius: "50%",
          border: subscribed ? "1.5px solid #c89440" : "1.5px solid #d0c8bc",
          background: subscribed ? "#fdf7ed" : "#f4f0eb",
          color: subscribed ? "#92400e" : "#7a6a58",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", fontSize: 16, flexShrink: 0,
          position: "relative",
        }}
      >
        🔔
        {subscribed && (
          <span style={{
            position: "absolute", top: 4, left: 4,
            width: 8, height: 8, borderRadius: "50%",
            background: "#22c55e", border: "1.5px solid #fff",
          }} />
        )}
      </button>

      {/* Panel */}
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 8px)", left: 0,
          background: "#fff", border: "1.5px solid #e8e2da",
          borderRadius: 16, padding: "18px 18px 14px",
          width: 260, zIndex: 9999, boxShadow: "0 8px 32px #0002",
          direction: "rtl",
        }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#1a1208", marginBottom: 12 }}>🔔 התראות Push</div>

          {/* Event checkboxes */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#8a7a60", textTransform: "uppercase", marginBottom: 8, letterSpacing: ".05em" }}>
              אירועים לקבלת התראה
            </div>
            {ALL_EVENTS.map(ev => (
              <label key={ev} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={events.includes(ev)}
                  onChange={() => toggleEvent(ev)}
                  style={{ accentColor: "#c89440", width: 15, height: 15 }}
                />
                <span style={{ fontSize: 12, color: "#4a3820", fontWeight: 600 }}>{EVENT_LABELS[ev]}</span>
              </label>
            ))}
          </div>

          {msg && (
            <div style={{ fontSize: 11, color: msg.startsWith("✓") ? "#15803d" : "#c0392b", marginBottom: 10, fontWeight: 700 }}>
              {msg}
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {!subscribed ? (
              <button
                onClick={handleSubscribe}
                disabled={loading}
                style={{ padding: "9px 0", borderRadius: 10, border: "none", background: "#c89440", color: "#fff", fontSize: 12, fontWeight: 800, cursor: loading ? "default" : "pointer", fontFamily: "inherit" }}
              >
                {loading ? "מתחבר..." : "✓ הפעל התראות"}
              </button>
            ) : (
              <>
                <button
                  onClick={handleSaveEvents}
                  disabled={loading}
                  style={{ padding: "9px 0", borderRadius: 10, border: "none", background: "#c89440", color: "#fff", fontSize: 12, fontWeight: 800, cursor: loading ? "default" : "pointer", fontFamily: "inherit" }}
                >
                  {loading ? "שומר..." : "שמור הגדרות"}
                </button>
                <button
                  onClick={handleUnsubscribe}
                  disabled={loading}
                  style={{ padding: "9px 0", borderRadius: 10, border: "1.5px solid #e8e2da", background: "#f4f0eb", color: "#8a7a60", fontSize: 12, fontWeight: 700, cursor: loading ? "default" : "pointer", fontFamily: "inherit" }}
                >
                  בטל הרשמה
                </button>
              </>
            )}
          </div>

          <div style={{ fontSize: 10, color: "#b0a090", marginTop: 10, lineHeight: 1.4 }}>
            {subscribed ? "אתה מקבל התראות במכשיר זה" : "הפעל התראות לקבלת עדכונים בזמן אמת"}
          </div>
        </div>
      )}
    </div>
  );
}
