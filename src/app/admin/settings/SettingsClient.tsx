"use client";

import { useState, useRef, useEffect } from "react";
import { T, ADMIN_PALETTES, ADMIN_PALETTE_LABELS } from "@/lib/ui";
import { AssistantWidget } from "@/components/admin/AssistantWidget";

const DARK_INPUT: React.CSSProperties = {
  background:   "rgba(255,255,255,0.04)",
  border:       "1px solid rgba(255,255,255,0.14)",
  color:        "#ffffff",
  borderRadius: 10,
  padding:      "10px 14px",
  fontSize:     14,
  fontWeight:   500,
  width:        "100%",
  outline:      "none",
  fontFamily:   "inherit",
};

/* ─── Types ──────────────────────────────────────────────── */
type Config = {
  siteName: string; logo: string | null;
  domain: string | null; copyright: string | null;
  adminPalette: string; adminBg: string; adminBgImage: string | null;
  adminSidebarBg: string | null; adminSidebarAccent: string | null;
  adminSidebarTextColor: string; adminContentTextColor: string;
  adminTopBarBg: string | null; adminTopBarTextColor: string;
  // extended
  contactEmail: string | null; contactPhone: string | null; address: string | null;
  timezone: string; currency: string; interfaceLanguage: string;
  privacyUrl: string | null; termsUrl: string | null;
  showPrivacyPolicy: boolean; enableLoyaltyPoints: boolean;
  enableOnlineOrders: boolean; showPrices: boolean;
  loginImage: string | null;
};

type TopTab = "settings" | "security" | "advanced" | "appearance";
type AdvTab = "backup" | "restore" | "clear";

/* ─── BackupJSON type ────────────────────────────────────── */
interface BackupMeta {
  version: number;
  exportedAt?: string;
  exportedBy?: string;
  restaurantIds?: string[];
  counts?: Record<string, number>;
}
interface BackupJSON {
  _meta: BackupMeta;
  restaurants?: unknown[];
  menus?: unknown[];
  categories?: unknown[];
  items?: unknown[];
  modifierGroups?: unknown[];
  modifiers?: unknown[];
  [key: string]: unknown;
}

/* ─── Auto-backup status widget ─────────────────────────── */
type CronStatus = {
  isActive: boolean;
  schedule: string | null;
  hasCronSecret: boolean;
  hasGmail: boolean;
  nextRun: string | null;
  missing: string[];
  debug?: Record<string, string | boolean>;
};

function AutoBackupStatus() {
  const [status,     setStatus]     = useState<CronStatus | null>(null);
  const [triggering, setTriggering] = useState(false);
  const [triggerMsg, setTriggerMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/admin/backup/cron-status")
      .then(r => r.json())
      .then(d => setStatus(d))
      .catch(() => {});
  }, []);

  async function triggerNow() {
    setTriggering(true); setTriggerMsg(null);
    try {
      const res  = await fetch("/api/admin/backup/trigger", { method: "POST" });
      const data = await res.json() as { ok?: boolean; emailSent?: boolean; restaurantCount?: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? `שגיאה ${res.status}`);
      const sentTxt = data.emailSent ? "המייל נשלח לכל SUPER_ADMIN ✉️" : "הגיבוי בוצע (שליחת מייל נכשלה)";
      setTriggerMsg({ ok: true,  text: `גיבוי בוצע בהצלחה — ${data.restaurantCount} מסעדות. ${sentTxt}` });
    } catch (e) {
      setTriggerMsg({ ok: false, text: e instanceof Error ? e.message : "שגיאה בביצוע הגיבוי" });
    } finally {
      setTriggering(false);
    }
  }

  if (!status) {
    return (
      <div style={{ border: "1px dashed rgba(255,255,255,0.15)", borderRadius: 12, padding: 16,
        background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.5)", fontSize: 13 }}>
        טוען סטטוס גיבוי אוטומטי...
      </div>
    );
  }

  const SCHEDULE_LABEL: Record<string, string> = {
    daily:  "יומי (02:00 UTC)",
    weekly: "שבועי — ראשון (02:00 UTC)",
  };

  if (status.isActive) {
    const nextLabel = status.nextRun
      ? new Date(status.nextRun).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" })
      : null;
    return (
      <div style={{ border: "1px solid rgba(81,207,102,0.3)", borderRadius: 12, overflow: "hidden",
        background: "rgba(81,207,102,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px" }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#34d399", flexShrink: 0,
            boxShadow: "0 0 0 3px rgba(81,207,102,0.2)" }} />
          <div style={{ flex: 1 }}>
            <div style={{ color: "#34d399", fontWeight: 700, fontSize: 13 }}>גיבוי אוטומטי פעיל</div>
            <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 12, marginTop: 2 }}>
              תזמון: {SCHEDULE_LABEL[status.schedule ?? ""] ?? status.schedule}
              {nextLabel && ` · גיבוי הבא: ${nextLabel}`}
            </div>
          </div>
        </div>

        {triggerMsg && (
          <div style={{
            margin: "0 12px 10px",
            padding: "8px 12px",
            borderRadius: 8,
            fontSize: 12,
            background: triggerMsg.ok ? "rgba(81,207,102,0.12)" : "rgba(255,107,107,0.12)",
            color: triggerMsg.ok ? "#34d399" : "#f87171",
            border: `1px solid ${triggerMsg.ok ? "rgba(81,207,102,0.3)" : "rgba(255,107,107,0.3)"}`,
          }}>
            {triggerMsg.ok ? "✓ " : "⚠️ "}{triggerMsg.text}
          </div>
        )}

        <div style={{ borderTop: "1px solid rgba(81,207,102,0.2)", padding: "10px 16px",
          background: "rgba(81,207,102,0.04)", display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={triggerNow} disabled={triggering} style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "linear-gradient(135deg,#059669,#34d399)",
            color: "#fff", fontSize: 12, fontWeight: 700,
            padding: "6px 14px", borderRadius: 8, border: "none", cursor: "pointer",
            opacity: triggering ? 0.6 : 1,
          }}>
            {triggering ? "מבצע..." : "⬇️ גבה עכשיו"}
          </button>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>
            לשינוי תזמון: עדכן{" "}
            <code style={{ background: "rgba(255,255,255,0.08)", padding: "1px 5px", borderRadius: 4 }}>BACKUP_SCHEDULE</code>
            {" "}ב-Vercel + Redeploy
          </span>
        </div>
      </div>
    );
  }

  /* Not active */
  const [showDebug, setShowDebug] = useState(false);
  return (
    <div style={{ border: "1px dashed rgba(255,255,255,0.15)", borderRadius: 14, overflow: "hidden",
      background: "rgba(255,255,255,0.04)" }}>
      <div style={{ padding: 18 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>⏰</span>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <div style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>גיבוי אוטומטי</div>
              <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700,
                background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)" }}>לא פעיל</span>
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                { key: "CRON_SECRET",                        ok: status.hasCronSecret, desc: "מחרוזת סודית כלשהי" },
                { key: "BACKUP_SCHEDULE",                    ok: !!status.schedule && status.schedule !== "off", desc: '"daily" או "weekly"' },
                { key: "GMAIL_USER / GMAIL_APP_PASSWORD",    ok: status.hasGmail,      desc: "נדרש לשליחת המייל" },
              ].map(row => (
                <div key={row.key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: row.ok ? "#34d399" : "#f87171", fontSize: 13 }}>{row.ok ? "✓" : "✗"}</span>
                  <code style={{ padding: "1px 6px", borderRadius: 5, fontSize: 11,
                    background: row.ok ? "rgba(52,211,153,0.12)" : "rgba(248,113,113,0.12)",
                    color: row.ok ? "#34d399" : "#f87171" }}>{row.key}</code>
                  <span style={{ color: "rgba(255,255,255,0.45)" }}>{row.desc}</span>
                </div>
              ))}
              <div style={{ color: "rgba(255,255,255,0.65)", fontWeight: 600, marginTop: 4 }}>
                לאחר עדכון — בצע <strong>Redeploy</strong> ב-Vercel.
              </div>
            </div>
          </div>
        </div>
      </div>

      {status.debug && (
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}>
          <button onClick={() => setShowDebug(v => !v)} style={{
            width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 16px",
            fontSize: 12, color: "rgba(255,255,255,0.45)", background: "transparent", border: "none", cursor: "pointer", textAlign: "right",
          }}>
            ℹ️ {showDebug ? "הסתר אבחון" : "הצג אבחון"}
          </button>
          {showDebug && (
            <div style={{ padding: "0 16px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
              {Object.entries(status.debug).map(([k, v]) => (
                <div key={k} style={{ display: "flex", gap: 8, fontSize: 11, fontFamily: "monospace" }}>
                  <span style={{ color: "rgba(255,255,255,0.45)", flexShrink: 0 }}>{k}:</span>
                  <span style={{ color: String(v).startsWith("✓") ? "#34d399" : String(v).startsWith("✗") ? "#f87171" : "#fff" }}>
                    {String(v)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Backup section ─────────────────────────────────────── */
type HistoryEntry = {
  id: string;
  createdAt: string;
  userEmail?: string | null;
  entityName?: string | null;
  meta?: { trigger?: string; counts?: Record<string, number> } | null;
};

function BackupSection() {
  const [restaurants,  setRestaurants]  = useState<{ id: string; name: string }[]>([]);
  const [restaurantId, setRestaurantId] = useState("");
  const [downloading,  setDownloading]  = useState(false);
  const [lastBackup,   setLastBackup]   = useState<string | null>(null);
  const [error,        setError]        = useState("");
  const [history,      setHistory]      = useState<HistoryEntry[]>([]);

  useEffect(() => {
    fetch("/api/admin/restaurants").then(r => r.json()).then(d => {
      if (Array.isArray(d)) setRestaurants(d);
    }).catch(() => {});
    fetch("/api/admin/backup/history").then(r => r.json()).then(d => {
      if (Array.isArray(d)) setHistory(d);
    }).catch(() => {});
  }, []);

  async function downloadBackup() {
    setDownloading(true); setError("");
    try {
      const url = restaurantId ? `/api/admin/backup?restaurantId=${restaurantId}` : "/api/admin/backup";
      const res = await fetch(url);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? `שגיאה ${res.status}`);
      }
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `menu4u-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(a.href);
      setLastBackup(new Date().toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" }));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "שגיאה בהורדת הגיבוי");
    } finally {
      setDownloading(false);
    }
  }

  const selectStyle: React.CSSProperties = {
    ...DARK_INPUT,
    padding: "8px 12px",
    fontSize: 13,
    marginBottom: 12,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Info */}
      <div style={{ background: "rgba(51,154,240,0.1)", border: "1px solid rgba(51,154,240,0.25)",
        borderRadius: 10, padding: "12px 16px", color: "#74c0fc", fontSize: 13,
        display: "flex", alignItems: "flex-start", gap: 8 }}>
        <span>ℹ️</span>
        <div>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>מה כלול בגיבוי?</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", lineHeight: 1.6 }}>
            מסעדות, משתמשים, תפריטים, קטגוריות, פריטים, תוספות, הזמנות, לוגים ונתוני צפיות.<br/>
            <span style={{ color: "#60a5fa" }}>🔒 סיסמאות לא נכללות בגיבוי</span>
          </div>
        </div>
      </div>

      {/* Auto-backup */}
      <AutoBackupStatus />

      {/* Google Drive hint */}
      <div style={{ background: "rgba(252,196,25,0.06)", border: "1px solid rgba(252,196,25,0.2)",
        borderRadius: 10, padding: "12px 16px", color: "#fbbf24", fontSize: 13,
        display: "flex", alignItems: "flex-start", gap: 8 }}>
        <span>☁️</span>
        <span>
          <b>Google Drive:</b> הגדר{" "}
          <code style={{ background: "rgba(255,255,255,0.08)", padding: "1px 5px", borderRadius: 4 }}>GOOGLE_SERVICE_ACCOUNT_JSON</code>
          {" "}ב-Vercel לגיבוי אוטומטי לדרייב.
        </span>
      </div>

      {/* Scope selector */}
      {restaurants.length > 1 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase",
            letterSpacing: "0.08em", marginBottom: 6 }}>היקף הגיבוי</div>
          <select value={restaurantId} onChange={e => setRestaurantId(e.target.value)} style={selectStyle}>
            <option value="">כל המסעדות</option>
            {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
      )}

      {/* Download button */}
      <button onClick={downloadBackup} disabled={downloading} style={{
        display: "inline-flex", alignItems: "center", gap: 8,
        background: "linear-gradient(135deg,#8B6914,#C9A84C)",
        color: "#fff", fontSize: 14, fontWeight: 700,
        padding: "10px 22px", borderRadius: 8, border: "none", cursor: "pointer",
        opacity: downloading ? 0.6 : 1, width: "fit-content",
      }}>
        {downloading ? (
          <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: "spin 1s linear infinite" }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/></svg>מכין גיבוי...</>
        ) : (
          <>⬇️ הורד גיבוי (JSON)</>
        )}
      </button>

      {/* Error */}
      {error && (
        <div style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)",
          borderRadius: 10, padding: "10px 14px", color: "#f87171", fontSize: 13 }}>
          ⚠️ {error}
        </div>
      )}

      {/* Success */}
      {lastBackup && (
        <div style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)",
          borderRadius: 10, padding: "10px 14px", color: "#34d399", fontSize: 13 }}>
          ✓ גיבוי הורד בהצלחה — {lastBackup}
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase",
            letterSpacing: "0.08em", marginBottom: 8 }}>גיבויים אחרונים</div>
          <div style={{ border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, overflow: "hidden" }}>
            {history.slice(0, 5).map((entry, i) => {
              const trigger  = (entry.meta as { trigger?: string } | null)?.trigger;
              const label    = trigger === "cron" ? "אוטומטי" : "ידני";
              const dateStr  = new Date(entry.createdAt).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" });
              const who      = trigger === "cron" ? "auto" : (entry.userEmail ?? "—");
              return (
                <div key={entry.id} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 14px",
                  borderBottom: i < history.slice(0,5).length - 1 ? "1px solid rgba(255,255,255,0.07)" : "none",
                  background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)",
                  fontSize: 13,
                }}>
                  <span style={{
                    padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                    background: trigger === "cron" ? "rgba(190,75,219,0.15)" : "rgba(59,130,246,0.15)",
                    color: trigger === "cron" ? "#c084fc" : "#60a5fa",
                  }}>{label}</span>
                  <span style={{ color: "rgba(255,255,255,0.7)", fontFamily: "monospace", fontSize: 12 }}>{dateStr}</span>
                  <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{who}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Restore diff types ─────────────────────────────────── */
type FieldChange = { field: string; from: string; to: string };
type DiffEntry   = { type: string; name: string; action: "create" | "update"; changes?: FieldChange[] };
type DiffResult  = { toCreate: number; toUpdate: number; noChange: number; entries: DiffEntry[] };

const TYPE_LABELS: Record<string, string> = {
  restaurant: "מסעדה", menu: "תפריט", category: "קטגוריה",
  item: "פריט", modifierGroup: "קבוצת תוספות", modifier: "תוספת",
};

/* ─── Restore section ────────────────────────────────────── */
function RestoreSection() {
  const [file,          setFile]          = useState<File | null>(null);
  const [backupData,    setBackupData]    = useState<BackupJSON | null>(null);
  const [previewing,    setPreviewing]    = useState(false);
  const [diff,          setDiff]          = useState<DiffResult | null>(null);
  const [confirm,       setConfirm]       = useState(false);
  const [restoring,     setRestoring]     = useState(false);
  const [restoreResult, setRestoreResult] = useState<{ created: number; updated: number } | null>(null);
  const [error,         setError]         = useState("");
  const [showAllDiff,   setShowAllDiff]   = useState(false);
  const [restoreScope,  setRestoreScope]  = useState<"menus" | "full">("menus");
  const inputRef = useRef<HTMLInputElement>(null);

  function parseFile(f: File) {
    setFile(f); setError(""); setRestoreResult(null); setBackupData(null); setDiff(null); setConfirm(false);
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const json = JSON.parse(ev.target?.result as string) as BackupJSON;
        if (!json._meta?.version) throw new Error("קובץ לא תקין: חסר _meta.version");
        setBackupData(json);
      } catch (e) {
        setError(e instanceof Error ? e.message : "שגיאה בפענוח הקובץ");
        setFile(null);
      }
    };
    reader.readAsText(f);
  }

  async function previewDiff() {
    if (!backupData) return;
    setPreviewing(true); setError(""); setDiff(null); setConfirm(false);
    try {
      const res = await fetch("/api/admin/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ backup: backupData, scope: restoreScope, mode: "preview" }),
      });
      const data = await res.json() as DiffResult & { error?: string };
      if (!res.ok) throw new Error(data.error ?? `שגיאה ${res.status}`);
      setDiff(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה בבדיקת שינויים");
    } finally {
      setPreviewing(false);
    }
  }

  async function doRestore() {
    if (!backupData) return;
    setRestoring(true); setError(""); setRestoreResult(null); setConfirm(false);
    try {
      const res = await fetch("/api/admin/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ backup: backupData, scope: restoreScope, mode: "restore" }),
      });
      const data = await res.json() as { created?: number; updated?: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? `שגיאה ${res.status}`);
      setRestoreResult({ created: data.created ?? 0, updated: data.updated ?? 0 });
      setDiff(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה בשחזור");
    } finally {
      setRestoring(false);
    }
  }

  const meta         = backupData?._meta;
  const counts       = meta?.counts;
  const SHOW_N       = 8;
  const diffEntries  = diff?.entries ?? [];
  const visibleEntries = showAllDiff ? diffEntries : diffEntries.slice(0, SHOW_N);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Info */}
      <div style={{ background: "rgba(51,154,240,0.1)", border: "1px solid rgba(51,154,240,0.25)",
        borderRadius: 10, padding: "12px 16px", color: "#74c0fc", fontSize: 13,
        display: "flex", alignItems: "center", gap: 8 }}>
        ℹ️ העלה קובץ גיבוי לשחזור נתונים. תוצג השוואה לפני ביצוע השחזור.
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) parseFile(f); }}
        onClick={() => inputRef.current?.click()}
        style={{
          background: backupData ? "rgba(52,211,153,0.06)" : "rgba(255,255,255,0.04)",
          border: `2px dashed ${backupData ? "rgba(52,211,153,0.5)" : "rgba(255,255,255,0.15)"}`,
          borderRadius: 12, padding: 32, textAlign: "center", cursor: "pointer",
          transition: "border-color 0.15s",
        }}
      >
        <div style={{ fontSize: 34, marginBottom: 8 }}>{backupData ? "✅" : "📂"}</div>
        <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 13 }}>
          {file ? file.name : "גרור קובץ גיבוי (JSON) לכאן, או לחץ לבחירה"}
        </p>
        <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, marginTop: 4 }}>menu4u-backup-*.json</p>
        {backupData && (
          <button style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, textDecoration: "underline",
            background: "transparent", border: "none", cursor: "pointer", marginTop: 8 }}
            onClick={e => { e.stopPropagation(); setFile(null); setBackupData(null); setDiff(null); setRestoreResult(null); setError(""); }}>
            החלף קובץ
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept=".json,application/json" style={{ display: "none" }}
        onChange={e => { const f = e.target.files?.[0]; if (f) parseFile(f); e.target.value = ""; }} />

      {/* Error */}
      {error && (
        <div style={{ background: "rgba(255,107,107,0.1)", border: "1px solid rgba(255,107,107,0.3)",
          borderRadius: 8, padding: "10px 14px", color: "#f87171", fontSize: 13 }}>
          ⚠️ {error}
        </div>
      )}

      {/* Backup metadata */}
      {backupData && meta && (
        <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 12, padding: 16 }}>
          <div style={{ color: "#ffffff", fontWeight: 700, fontSize: 14, marginBottom: 10 }}>פרטי הגיבוי</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 16px", fontSize: 12, marginBottom: 12 }}>
            {meta.exportedAt && (
              <><span style={{ color: "rgba(255,255,255,0.45)" }}>יוצא ב:</span>
              <span style={{ color: "rgba(255,255,255,0.7)" }}>{new Date(meta.exportedAt).toLocaleString("he-IL", { dateStyle: "medium", timeStyle: "short" })}</span></>
            )}
            {meta.exportedBy && (
              <><span style={{ color: "rgba(255,255,255,0.45)" }}>יוצא ע״י:</span>
              <span style={{ color: "rgba(255,255,255,0.7)", fontFamily: "monospace" }}>{meta.exportedBy}</span></>
            )}
            {meta.restaurantIds && (
              <><span style={{ color: "rgba(255,255,255,0.45)" }}>מסעדות:</span>
              <span style={{ color: "rgba(255,255,255,0.7)" }}>{meta.restaurantIds.length}</span></>
            )}
            <span style={{ color: "rgba(255,255,255,0.45)" }}>גרסה:</span>
            <span style={{ color: "rgba(255,255,255,0.7)" }}>{meta.version}</span>
          </div>
          {counts && Object.keys(counts).length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 12 }}>
              {Object.entries(counts).map(([key, val]) => (
                <div key={key} style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 8,
                  padding: "8px 10px", textAlign: "center" }}>
                  <div style={{ color: "#ffffff", fontWeight: 700, fontSize: 16 }}>{val}</div>
                  <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 10 }}>{key}</div>
                </div>
              ))}
            </div>
          )}
          {!diff && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {/* Scope selector */}
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", fontWeight: 600 }}>היקף שחזור:</span>
                {(["menus", "full"] as const).map(s => (
                  <button key={s} onClick={() => setRestoreScope(s)} style={{
                    padding: "4px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", border: "none",
                    background: restoreScope === s ? (s === "full" ? "rgba(239,68,68,0.25)" : "rgba(99,102,241,0.25)") : "rgba(255,255,255,0.07)",
                    color: restoreScope === s ? (s === "full" ? "#f87171" : "#818cf8") : "rgba(255,255,255,0.45)",
                    outline: restoreScope === s ? `1px solid ${s === "full" ? "rgba(239,68,68,0.5)" : "rgba(99,102,241,0.5)"}` : "none",
                  }}>
                    {s === "menus" ? "🍽️ תפריטים בלבד" : "⚠️ שחזור מלא (כולל הזמנות, משמרות, לקוחות)"}
                  </button>
                ))}
              </div>
              {restoreScope === "full" && (
                <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#fca5a5" }}>
                  ⚠️ שחזור מלא יכתוב על הזמנות, לקוחות, נאמנות ומשמרות קיימים. לא ניתן לבטל.
                </div>
              )}
              <button onClick={previewDiff} disabled={previewing} style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                background: restoreScope === "full" ? "linear-gradient(135deg,#dc2626,#ef4444)" : "linear-gradient(135deg,#6366f1,#818cf8)",
                color: "#fff", fontSize: 13, fontWeight: 700,
                padding: "8px 18px", borderRadius: 8, border: "none", cursor: "pointer",
                opacity: previewing ? 0.6 : 1,
              }}>
                {previewing ? "בודק..." : "🔍 בדוק שינויים לפני שחזור"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Diff panel */}
      {diff && (
        <div style={{ border: "1px solid rgba(255,255,255,0.14)", borderRadius: 12, overflow: "hidden" }}>
          {/* Summary */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px",
            background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.1)", flexWrap: "wrap" }}>
            <span style={{ color: "#ffffff", fontWeight: 700, fontSize: 13 }}>תוצאת הבדיקה</span>
            {diff.toCreate > 0 && (
              <span style={{ padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                background: "rgba(81,207,102,0.15)", color: "#34d399" }}>✚ {diff.toCreate} חדשות</span>
            )}
            {diff.toUpdate > 0 && (
              <span style={{ padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                background: "rgba(252,196,25,0.15)", color: "#fbbf24" }}>✎ {diff.toUpdate} יידרסו</span>
            )}
            {diff.noChange > 0 && (
              <span style={{ padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                background: `rgba(108,117,125,0.2)`, color: "rgba(255,255,255,0.45)" }}>✓ {diff.noChange} ללא שינוי</span>
            )}
            {diff.toCreate === 0 && diff.toUpdate === 0 && (
              <span style={{ padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                background: "rgba(81,207,102,0.15)", color: "#34d399" }}>✓ אין שינויים — הנתונים זהים</span>
            )}
            <button onClick={() => { setDiff(null); setShowAllDiff(false); }}
              style={{ marginRight: "auto", fontSize: 12, color: "rgba(255,255,255,0.45)", background: "transparent",
                border: "none", cursor: "pointer" }}>× סגור</button>
          </div>

          {diffEntries.length > 0 && (
            <div style={{ maxHeight: 280, overflowY: "auto" }}>
              {visibleEntries.map((entry, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 14px",
                  borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                  <span style={{
                    flexShrink: 0, padding: "2px 7px", borderRadius: 6, fontSize: 10, fontWeight: 700,
                    marginTop: 1,
                    background: entry.action === "create" ? "rgba(81,207,102,0.15)" : "rgba(252,196,25,0.15)",
                    color: entry.action === "create" ? "#34d399" : "#fbbf24",
                  }}>
                    {entry.action === "create" ? "חדש" : "עדכון"}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#ffffff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {entry.name}
                      <span style={{ fontWeight: 400, color: "rgba(255,255,255,0.45)", marginRight: 6 }}>— {TYPE_LABELS[entry.type] ?? entry.type}</span>
                    </div>
                    {entry.changes && entry.changes.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 12px", marginTop: 3 }}>
                        {entry.changes.map((fc, j) => (
                          <span key={j} style={{ fontSize: 11, color: "rgba(255,255,255,0.7)" }}>
                            <span style={{ fontWeight: 600, color: "#ffffff" }}>{fc.field}:</span>{" "}
                            <span style={{ textDecoration: "line-through", color: "#f87171" }}>{fc.from}</span>
                            {" → "}
                            <span style={{ color: "#34d399", fontWeight: 600 }}>{fc.to}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {diffEntries.length > SHOW_N && (
                <div style={{ padding: "10px", textAlign: "center", background: "rgba(255,255,255,0.04)" }}>
                  <button onClick={() => setShowAllDiff(v => !v)} style={{
                    fontSize: 12, color: "#60a5fa", background: "transparent", border: "none", cursor: "pointer", fontWeight: 600,
                  }}>
                    {showAllDiff ? "הצג פחות ▲" : `הצג עוד ${diffEntries.length - SHOW_N} שינויים ▼`}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Warning + actions */}
          {diff.toUpdate > 0 && !confirm && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 14px",
              background: "rgba(252,196,25,0.06)", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#fbbf24" }}>{diff.toUpdate} רשומות קיימות יידרסו</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 2 }}>שינויים שביצעת מאז הגיבוי יאבדו לנצח.</div>
              </div>
            </div>
          )}

          <div style={{ padding: "12px 14px", borderTop: "1px solid rgba(255,255,255,0.1)",
            background: "rgba(255,255,255,0.04)", display: "flex", gap: 8 }}>
            {!confirm ? (
              <>
                <button onClick={() => diff.toUpdate > 0 ? setConfirm(true) : doRestore()}
                  disabled={restoring || (diff.toCreate === 0 && diff.toUpdate === 0)}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6,
                    background: "linear-gradient(135deg,#059669,#34d399)",
                    color: "#fff", fontSize: 13, fontWeight: 700,
                    padding: "8px 18px", borderRadius: 8, border: "none", cursor: "pointer",
                    opacity: restoring || (diff.toCreate === 0 && diff.toUpdate === 0) ? 0.5 : 1 }}>
                  {restoring ? "משחזר..." : "🔄 שחזר תפריטים"}
                </button>
                <button onClick={() => { setDiff(null); setShowAllDiff(false); }} style={{
                  background: "transparent", color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: 600,
                  padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.14)", cursor: "pointer",
                }}>ביטול</button>
              </>
            ) : (
              <>
                <div style={{ width: "100%", marginBottom: 8, fontSize: 12, fontWeight: 700, color: "#f87171" }}>
                  ⚠️ האם לדרוס {diff.toUpdate} רשומות קיימות?
                </div>
                <button onClick={doRestore} disabled={restoring} style={{
                  background: "#dc2626", color: "#fff", fontSize: 13, fontWeight: 700,
                  padding: "8px 18px", borderRadius: 8, border: "none", cursor: "pointer",
                  opacity: restoring ? 0.6 : 1 }}>
                  {restoring ? "משחזר..." : "כן, דרוס והמשך"}
                </button>
                <button onClick={() => setConfirm(false)} style={{
                  background: "transparent", color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: 600,
                  padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.14)", cursor: "pointer",
                }}>חזור</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Success */}
      {restoreResult && (
        <div style={{ background: "rgba(81,207,102,0.1)", border: "1px solid rgba(81,207,102,0.3)",
          borderRadius: 8, padding: "10px 14px", color: "#34d399", fontSize: 13 }}>
          ✓ שחזור הושלם! נוצרו {restoreResult.created} רשומות חדשות, עודכנו {restoreResult.updated} רשומות קיימות.
        </div>
      )}

      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>
        לשחזור מלא של הזמנות, לקוחות ולוגים — השתמש בגיבוי Neon DB.
      </p>
    </div>
  );
}

/* ─── Clear orders section ───────────────────────────────── */
function ClearOrdersSection() {
  const [confirm,  setConfirm]  = useState(false);
  const [clearing, setClearing] = useState(false);
  const [result,   setResult]   = useState<{ count: number } | null>(null);
  const [error,    setError]    = useState("");

  async function handleClear() {
    setClearing(true); setError(""); setResult(null);
    const res = await fetch("/api/admin/orders/clear", { method: "DELETE" });
    const data = await res.json() as { deleted?: { orders?: number }; error?: string };
    setClearing(false);
    if (res.ok) { setResult({ count: data.deleted?.orders ?? 0 }); setConfirm(false); }
    else setError(data.error ?? "שגיאה");
  }

  if (result) {
    return (
      <div style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)",
        borderRadius: 14, padding: "14px 18px", color: "#34d399", fontSize: 14, fontWeight: 600 }}>
        ✓ נמחקו {result.count} הזמנות בהצלחה — הנתונים מתחילים מאפס.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.25)",
        borderRadius: 16, padding: "20px 22px" }}>
        <div style={{ color: "#f87171", fontWeight: 700, fontSize: 15, marginBottom: 6 }}>⚠️ ניקוי כל ההזמנות</div>
        <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 13, lineHeight: 1.7 }}>
          פעולה זו תמחק לצמיתות את כל ההזמנות, פריטי ההזמנות ולוגי הסטטוס מכל המסעדות.<br/>
          <span style={{ color: "#f87171", fontWeight: 600 }}>לא ניתן לבטל פעולה זו!</span>
        </div>
      </div>

      {!confirm ? (
        <button onClick={() => setConfirm(true)} style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          background: "rgba(248,113,113,0.12)", color: "#f87171",
          fontSize: 14, fontWeight: 700, padding: "12px 24px",
          borderRadius: 12, border: "1px solid rgba(248,113,113,0.3)", cursor: "pointer",
          width: "fit-content",
        }}>
          🗑️ מחק את כל ההזמנות
        </button>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)",
            borderRadius: 12, padding: "14px 18px" }}>
            <div style={{ color: "#f87171", fontWeight: 700, fontSize: 14, marginBottom: 4 }}>פעולה בלתי הפיכה!</div>
            <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 13 }}>כל ההזמנות יימחקו לצמיתות. לא ניתן לשחזר.</div>
          </div>
          {error && (
            <div style={{ color: "#f87171", fontSize: 13, padding: "10px 14px",
              background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 10 }}>{error}</div>
          )}
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={handleClear} disabled={clearing} style={{
              background: "linear-gradient(135deg,#dc2626,#ef4444)", color: "#fff", fontSize: 13, fontWeight: 700,
              padding: "11px 24px", borderRadius: 12, border: "none", cursor: "pointer",
              opacity: clearing ? 0.6 : 1, boxShadow: "0 4px 14px rgba(220,38,38,0.35)",
            }}>
              {clearing ? "מוחק..." : "כן, מחק הכל"}
            </button>
            <button onClick={() => setConfirm(false)} style={{
              background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: 600,
              padding: "11px 20px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.14)", cursor: "pointer",
            }}>ביטול</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Password Policy Tab ────────────────────────────────── */
type PolicyState = {
  maxAgeDays: number;
  minLength: number;
  historyCount: number;
  requireUppercase: boolean;
  requireNumbers: boolean;
  requireSymbols: boolean;
  idleTimeoutMinutes: number;
};

function PasswordPolicyTab() {
  const [policy, setPolicy] = useState<PolicyState | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/admin/settings/password-policy")
      .then(r => r.json())
      .then(d => setPolicy(d))
      .catch(() => setErr("שגיאה בטעינת המדיניות"));
  }, []);

  async function handleSave() {
    if (!policy) return;
    setSaving(true); setErr(""); setSaved(false);
    const res = await fetch("/api/admin/settings/password-policy", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(policy),
    });
    setSaving(false);
    if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 3000); }
    else setErr("שגיאה בשמירה");
  }

  const GA = "#D97706";
  const GB2 = "rgba(255,255,255,0.06)";
  const GBrd = "rgba(255,255,255,0.14)";

  const numInp: React.CSSProperties = {
    background: "rgba(255,255,255,0.04)", border: `1px solid ${GBrd}`,
    color: "#fff", borderRadius: 10, padding: "8px 12px",
    fontSize: 15, fontWeight: 700, width: 72, textAlign: "center", outline: "none",
  };
  const hint = (text: string) => <div style={{ fontSize: 11, color: GA, marginTop: 6 }}>{text}</div>;

  if (!policy) return <div style={{ padding: 40, color: "rgba(255,255,255,0.5)", textAlign: "center" }}>טוען...</div>;

  const card: React.CSSProperties = {
    background: GB2, border: `1px solid ${GBrd}`, borderRadius: 18, padding: "20px 22px",
  };

  return (
    <div style={{ padding: "32px 32px 40px", maxWidth: 900, direction: "rtl", display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(217,119,6,0.15)",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>🔐</div>
        <div>
          <div style={{ fontSize: 17, fontWeight: 800, color: "#fff" }}>מדיניות סיסמאות</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>הגדרות אבטחה לכלל המשתמשים במערכת</div>
        </div>
      </div>

      {/* 4 number cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 2 }}>⏳ תפוגת סיסמה</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginBottom: 14 }}>ימים עד החלפה</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="number" min={0} max={365} value={policy.maxAgeDays}
              onChange={e => setPolicy({ ...policy, maxAgeDays: Number(e.target.value) })} style={numInp} />
            <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>ימים</span>
          </div>
          {policy.maxAgeDays > 0 ? hint(`כל ${policy.maxAgeDays} ימים`) : <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 6 }}>0 = ללא הגבלה</div>}
        </div>

        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 2 }}>🔒 ניתוק אוטומטי</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginBottom: 14 }}>חוסר פעילות</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="number" min={0} max={24} step={1} value={Math.round(policy.idleTimeoutMinutes / 60)}
              onChange={e => setPolicy({ ...policy, idleTimeoutMinutes: Number(e.target.value) * 60 })} style={numInp} />
            <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>שעות</span>
          </div>
          {policy.idleTimeoutMinutes > 0 ? hint(`אחרי ${Math.round(policy.idleTimeoutMinutes / 60)} שעות`) : <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 6 }}>0 = ללא ניתוק</div>}
        </div>

        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 2 }}>📏 אורך מינימלי</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginBottom: 14 }}>תווים לסיסמה</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="number" min={6} max={32} value={policy.minLength}
              onChange={e => setPolicy({ ...policy, minLength: Number(e.target.value) })} style={numInp} />
            <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>תווים</span>
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 6 }}>מומלץ: 8+</div>
        </div>

        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 2 }}>🔁 היסטוריה</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginBottom: 14 }}>מניעת שימוש חוזר</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="number" min={0} max={10} value={policy.historyCount}
              onChange={e => setPolicy({ ...policy, historyCount: Number(e.target.value) })} style={numInp} />
            <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>סיסמאות</span>
          </div>
          {policy.historyCount > 0 ? hint(`חסום ${policy.historyCount} אחרונות`) : <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 6 }}>0 = ללא הגבלה</div>}
        </div>
      </div>

      {/* Complexity toggles */}
      <div style={{ ...card }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 16 }}>🔐 דרישות מורכבות</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {([
            { key: "requireUppercase", label: "אות גדולה", desc: "A–Z" },
            { key: "requireNumbers",   label: "ספרה",       desc: "0–9" },
            { key: "requireSymbols",   label: "תו מיוחד",   desc: "!@#$..." },
          ] as { key: keyof PolicyState; label: string; desc: string }[]).map(({ key, label: lbl, desc }, i, arr) => {
            const active = policy[key] as boolean;
            return (
              <label key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "13px 0", borderBottom: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.07)" : "none", cursor: "pointer" }}>
                <input type="checkbox" checked={active} onChange={e => setPolicy({ ...policy, [key]: e.target.checked })} style={{ display: "none" }} />
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 14, color: "#fff", fontWeight: active ? 600 : 400 }}>{lbl}</span>
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{desc}</span>
                </div>
                <div style={{ width: 46, height: 26, borderRadius: 13, flexShrink: 0,
                  background: active ? `linear-gradient(135deg, ${GA}, #F59E0B)` : "rgba(255,255,255,0.15)",
                  position: "relative", transition: "background 0.25s", cursor: "pointer",
                  boxShadow: active ? "0 0 12px rgba(217,119,6,0.4)" : "none" }}>
                  <div style={{ position: "absolute", top: 3,
                    right: active ? 3 : undefined, left: active ? undefined : 3,
                    width: 20, height: 20, borderRadius: "50%", background: "#fff",
                    transition: "all 0.25s", boxShadow: "0 1px 4px rgba(0,0,0,0.35)" }} />
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {err && <div style={{ color: "#f87171", fontSize: 13, padding: "10px 14px",
        background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 10 }}>{err}</div>}

      <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 20 }}>
        <button onClick={handleSave} disabled={saving} style={{
          background: `linear-gradient(135deg, ${GA}, #F59E0B)`, color: "#fff", border: "none",
          padding: "13px 36px", borderRadius: 14, fontWeight: 700, fontSize: 15,
          cursor: saving ? "not-allowed" : "pointer",
          boxShadow: "0 8px 24px rgba(217,119,6,0.4)", opacity: saving ? 0.6 : 1,
        }}>
        {saving ? "שומר..." : saved ? "✓ נשמר" : "שמור מדיניות"}
        </button>
      </div>
    </div>
  );
}

/* ─── Main ───────────────────────────────────────────────── */
export default function SettingsClient({ config: initial }: { config: Config }) {
  const [form,          setForm]          = useState<Config>({ ...initial });
  const [saving,        setSaving]        = useState(false);
  const [saved,         setSaved]         = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingLogin, setUploadingLogin] = useState(false);

  const [topTab, setTopTab] = useState<TopTab>("settings");
  const [advTab, setAdvTab] = useState<AdvTab>("backup");

  const fileRef = useRef<HTMLInputElement>(null);
  const loginFileRef = useRef<HTMLInputElement>(null);

  function update<K extends keyof Config>(field: K, value: Config[K]) {
    setForm(prev => ({ ...prev, [field]: value }));
    setSaved(false);
  }

  async function uploadFile(file: File) {
    setUploadingLogo(true);
    const fd = new FormData();
    fd.append("file", file);
    const res  = await fetch("/api/admin/upload", { method: "POST", body: fd });
    const data = await res.json() as { url?: string };
    if (data.url) update("logo", data.url);
    setUploadingLogo(false);
  }

  async function uploadLoginImage(file: File) {
    setUploadingLogin(true);
    const fd = new FormData();
    fd.append("file", file);
    const res  = await fetch("/api/admin/upload", { method: "POST", body: fd });
    const data = await res.json() as { url?: string };
    if (data.url) update("loginImage", data.url);
    setUploadingLogin(false);
  }

  async function save() {
    setSaving(true);
    const res = await fetch("/api/admin/site-config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2500); setTimeout(() => window.location.reload(), 400); }
  }

  /* ─ tab helpers ─ */
  const TOP_TABS: { id: TopTab; label: string }[] = [
    { id: "settings",   label: "⚙️ הגדרות" },
    { id: "appearance", label: "🎨 מראה" },
    { id: "security",   label: "🔐 אבטחה" },
    { id: "advanced",   label: "🔧 מתקדם" },
  ];
  const ADV_TABS: { id: AdvTab; label: string }[] = [
    { id: "backup",  label: "💾 גיבוי" },
    { id: "restore", label: "♻️ שיחזור" },
    { id: "clear",   label: "🗑️ ניקוי הזמנות" },
  ];

  const G_ACCENT = "#D97706";
  const G_BORDER = "rgba(255,255,255,0.15)";

  const tabBarStyle: React.CSSProperties = {
    display: "flex",
    background: "rgba(0,0,0,0.35)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    borderRadius: "22px 22px 0 0",
    borderBottom: `1px solid ${G_BORDER}`,
    padding: "0 16px",
  };

  function topTabStyle(id: TopTab): React.CSSProperties {
    const active = topTab === id;
    return {
      display: "flex", alignItems: "center", gap: 8,
      padding: "16px 24px 14px",
      fontSize: 15, fontWeight: 700,
      color: active ? "#fff" : "rgba(255,255,255,0.5)",
      borderBottom: active ? `3px solid ${G_ACCENT}` : "3px solid transparent",
      position: "relative", bottom: -1,
      cursor: "pointer", background: "transparent", border: "none",
      outline: "none", transition: "color 0.2s",
      whiteSpace: "nowrap",
    };
  }

  const subTabBarStyle: React.CSSProperties = {
    display: "flex",
    borderBottom: `1px solid ${G_BORDER}`,
    padding: "0 20px",
    background: "rgba(0,0,0,0.2)",
  };

  function subTabStyle(id: AdvTab): React.CSSProperties {
    const active = advTab === id;
    return {
      display: "flex", alignItems: "center", gap: 7,
      padding: "10px 18px 9px",
      fontSize: 13, fontWeight: 600,
      color: active ? G_ACCENT : "rgba(255,255,255,0.5)",
      borderBottom: active ? `2px solid ${G_ACCENT}` : "2px solid transparent",
      position: "relative", bottom: -1,
      cursor: "pointer", background: "transparent", border: "none",
      outline: "none", transition: "color 0.15s",
      whiteSpace: "nowrap",
    };
  }

  /* ─────────────────────── render ─────────────────────────── */
  return (
    <div style={{ padding: "24px 24px 32px" }}>

      {/* ── Top tab bar ── */}
      <div style={tabBarStyle}>
        {TOP_TABS.map(t => (
          <button key={t.id} onClick={() => setTopTab(t.id)} style={topTabStyle(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Glass card wrapper ── */}
      <div style={{
        background: "rgba(255,255,255,0.05)",
        backdropFilter: "blur(28px) saturate(180%)",
        WebkitBackdropFilter: "blur(28px) saturate(180%)",
        border: `1px solid ${G_BORDER}`,
        borderTop: "none",
        borderRadius: "0 0 22px 22px",
        overflow: "hidden",
        boxShadow: "0 20px 50px rgba(0,0,0,0.35)",
      }}>

        {/* ════ TAB: הגדרות ════ */}
        {topTab === "settings" && (() => {
          /* Glass design tokens */
          const GB = "rgba(255,255,255,0.06)";
          const GBorder = "rgba(255,255,255,0.14)";
          const GAccent = "#D97706";
          const GGlow = "rgba(217,119,6,0.4)";
          const GInput: React.CSSProperties = {
            width: "100%", boxSizing: "border-box",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.14)",
            borderRadius: 14, padding: "13px 16px",
            color: "#fff", fontSize: 14, outline: "none", fontFamily: "inherit",
          };
          const GLabel: React.CSSProperties = {
            fontSize: 13, fontWeight: 700, color: "#fff",
            display: "flex", alignItems: "center", gap: 8, marginBottom: 8,
          };
          const GSub: React.CSSProperties = { fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 4 };
          const GCard: React.CSSProperties = {
            background: GB, border: `1px solid ${GBorder}`, borderRadius: 22,
            padding: 22, display: "flex", flexDirection: "column", gap: 0,
          };
          const sectionTitle = (icon: string, title: string) => (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: `rgba(217,119,6,0.15)`,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
                {icon}
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>{title}</div>
            </div>
          );
          const Toggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
            <button onClick={() => onChange(!value)} style={{
              width: 46, height: 26, borderRadius: 13, flexShrink: 0,
              background: value ? `linear-gradient(135deg, ${GAccent}, #F59E0B)` : "rgba(255,255,255,0.15)",
              border: "none", cursor: "pointer", position: "relative", transition: "background 0.25s",
              boxShadow: value ? `0 0 12px ${GGlow}` : "none",
            }}>
              <div style={{
                position: "absolute", top: 3,
                right: value ? 3 : undefined, left: value ? undefined : 3,
                width: 20, height: 20, borderRadius: "50%", background: "#fff",
                transition: "all 0.25s", boxShadow: "0 1px 4px rgba(0,0,0,0.35)",
              }} />
            </button>
          );
          const ToggleRow = ({ label, desc, value, onChange }: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void }) => (
            <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "14px 0", borderBottom: "1px solid rgba(255,255,255,0.07)", cursor: "pointer" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{label}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>{desc}</div>
              </div>
              <Toggle value={value} onChange={onChange} />
            </label>
          );

          return (
            <div style={{ padding: "32px 32px 40px", display: "flex", flexDirection: "column", gap: 28 }}>

              {/* 1. כללי */}
              <div style={GCard}>
                {sectionTitle("⚙️", "כללי")}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20 }}>
                  {/* שם האתר */}
                  <div>
                    <div style={GLabel}>✏️ שם האתר</div>
                    <input style={GInput} type="text" value={form.siteName}
                      onChange={e => update("siteName", e.target.value)} placeholder="Menu4U" />
                    <p style={GSub}>מוצג בסיידבר לצד הלוגו</p>
                  </div>
                  {/* דומיין */}
                  <div>
                    <div style={GLabel}>🌐 דומיין ראשי</div>
                    <input style={{ ...GInput, direction: "ltr" }} type="text"
                      value={form.domain ?? ""} onChange={e => update("domain", e.target.value || null)}
                      placeholder="app.mysite.co.il" />
                    <p style={GSub}>הדומיין הראשי של הפלטפורמה</p>
                  </div>
                  {/* זכויות */}
                  <div>
                    <div style={GLabel}>© זכויות יוצרים</div>
                    <input style={GInput} type="text"
                      value={form.copyright ?? ""} onChange={e => update("copyright", e.target.value || null)}
                      placeholder={`© ${new Date().getFullYear()} Menu4U · כל הזכויות שמורות`} />
                    <p style={GSub}>מוצג בתחתית הפאנל</p>
                  </div>
                  {/* לוגו */}
                  <div>
                    <div style={GLabel}>🖼️ לוגו האתר</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <div onClick={() => fileRef.current?.click()}
                        style={{ width: 56, height: 56, background: "rgba(255,255,255,0.06)",
                          border: `2px dashed ${GBorder}`, borderRadius: 12,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 22, flexShrink: 0, cursor: "pointer", overflow: "hidden" }}>
                        {form.logo
                          ? <img src={form.logo} alt="לוגו" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                          : <span>🏪</span>}
                      </div>
                      <div>
                        <p style={{ ...GSub, marginBottom: 8 }}>PNG/SVG שקוף, 200×200px+</p>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={() => fileRef.current?.click()} disabled={uploadingLogo} style={{
                            background: `linear-gradient(135deg, ${GAccent}, #F59E0B)`,
                            color: "#fff", fontSize: 12, fontWeight: 700,
                            padding: "7px 14px", borderRadius: 10, border: "none", cursor: "pointer",
                            opacity: uploadingLogo ? 0.6 : 1,
                            boxShadow: `0 4px 14px ${GGlow}`,
                          }}>
                            {uploadingLogo ? "מעלה..." : "📤 העלה"}
                          </button>
                          {form.logo && (
                            <button onClick={() => update("logo", null)} style={{
                              background: "transparent", color: "#f87171", fontSize: 12, fontWeight: 600,
                              padding: "7px 12px", borderRadius: 10,
                              border: "1px solid rgba(248,113,113,0.35)", cursor: "pointer",
                            }}>הסר</button>
                          )}
                        </div>
                      </div>
                    </div>
                    <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
                      onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = ""; }} />
                  </div>
                  {/* תמונת מסך התחברות */}
                  <div>
                    <div style={GLabel}>🖼️ תמונת מסך התחברות</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <div onClick={() => loginFileRef.current?.click()}
                        style={{ width: 96, height: 56, background: "rgba(255,255,255,0.06)",
                          border: `2px dashed ${GBorder}`, borderRadius: 12,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 22, flexShrink: 0, cursor: "pointer", overflow: "hidden" }}>
                        {form.loginImage
                          ? <img src={form.loginImage} alt="תמונת התחברות" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : <span>🌄</span>}
                      </div>
                      <div>
                        <p style={{ ...GSub, marginBottom: 8 }}>מוצגת בחצי ממסך ההתחברות · רוחב 1200px+ מומלץ</p>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={() => loginFileRef.current?.click()} disabled={uploadingLogin} style={{
                            background: `linear-gradient(135deg, ${GAccent}, #F59E0B)`,
                            color: "#fff", fontSize: 12, fontWeight: 700,
                            padding: "7px 14px", borderRadius: 10, border: "none", cursor: "pointer",
                            opacity: uploadingLogin ? 0.6 : 1, boxShadow: `0 4px 14px ${GGlow}`,
                          }}>
                            {uploadingLogin ? "מעלה..." : "📤 העלה"}
                          </button>
                          {form.loginImage && (
                            <button onClick={() => update("loginImage", null)} style={{
                              background: "transparent", color: "#f87171", fontSize: 12, fontWeight: 600,
                              padding: "7px 12px", borderRadius: 10,
                              border: "1px solid rgba(248,113,113,0.35)", cursor: "pointer",
                            }}>הסר</button>
                          )}
                        </div>
                      </div>
                    </div>
                    <input ref={loginFileRef} type="file" accept="image/*" style={{ display: "none" }}
                      onChange={e => { const f = e.target.files?.[0]; if (f) uploadLoginImage(f); e.target.value = ""; }} />
                  </div>
                </div>
              </div>

              {/* 2. יצירת קשר */}
              <div style={GCard}>
                {sectionTitle("📞", "יצירת קשר")}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20 }}>
                  <div>
                    <div style={GLabel}>✉️ אימייל</div>
                    <input style={{ ...GInput, direction: "ltr" }} type="email"
                      value={form.contactEmail ?? ""} onChange={e => update("contactEmail", e.target.value || null)}
                      placeholder="contact@restaurant.co.il" />
                    <p style={GSub}>לתמיכה ולפניות לקוחות</p>
                  </div>
                  <div>
                    <div style={GLabel}>📱 טלפון</div>
                    <input style={{ ...GInput, direction: "ltr" }} type="tel"
                      value={form.contactPhone ?? ""} onChange={e => update("contactPhone", e.target.value || null)}
                      placeholder="+972-50-000-0000" />
                    <p style={GSub}>מספר ליצירת קשר</p>
                  </div>
                  <div style={{ gridColumn: "span 1" }}>
                    <div style={GLabel}>📍 כתובת</div>
                    <input style={GInput} type="text"
                      value={form.address ?? ""} onChange={e => update("address", e.target.value || null)}
                      placeholder="רחוב הראשי 1, תל אביב" />
                    <p style={GSub}>כתובת פיזית של העסק</p>
                  </div>
                </div>
              </div>

              {/* 3. אזור ומטבע */}
              <div style={GCard}>
                {sectionTitle("🌍", "אזור ומטבע")}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 20 }}>
                  <div>
                    <div style={GLabel}>🕐 אזור זמן</div>
                    <select style={{ ...GInput, cursor: "pointer" }}
                      value={form.timezone} onChange={e => update("timezone", e.target.value)}>
                      <option value="Asia/Jerusalem">ישראל (UTC+3)</option>
                      <option value="Europe/London">לונדון (UTC+0)</option>
                      <option value="America/New_York">ניו יורק (UTC-5)</option>
                      <option value="America/Los_Angeles">לוס אנג&apos;לס (UTC-8)</option>
                      <option value="Europe/Paris">פריז (UTC+1)</option>
                    </select>
                    <p style={GSub}>עבור חותמות זמן ותזמון</p>
                  </div>
                  <div>
                    <div style={GLabel}>💰 מטבע</div>
                    <select style={{ ...GInput, cursor: "pointer" }}
                      value={form.currency} onChange={e => update("currency", e.target.value)}>
                      <option value="ILS">₪ שקל ישראלי (ILS)</option>
                      <option value="USD">$ דולר אמריקאי (USD)</option>
                      <option value="EUR">€ אירו (EUR)</option>
                      <option value="GBP">£ פאונד בריטי (GBP)</option>
                    </select>
                    <p style={GSub}>מטבע להצגת מחירים</p>
                  </div>
                  <div>
                    <div style={GLabel}>🗣️ שפת ממשק</div>
                    <select style={{ ...GInput, cursor: "pointer" }}
                      value={form.interfaceLanguage} onChange={e => update("interfaceLanguage", e.target.value)}>
                      <option value="he">עברית</option>
                      <option value="en">English</option>
                      <option value="ar">العربية</option>
                    </select>
                    <p style={GSub}>שפת ברירת מחדל לממשק</p>
                  </div>
                </div>
              </div>

              {/* 4. פרטיות ותנאים */}
              <div style={GCard}>
                {sectionTitle("🔒", "פרטיות ותנאים")}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20 }}>
                  <div>
                    <div style={GLabel}>🔗 קישור מדיניות פרטיות</div>
                    <input style={{ ...GInput, direction: "ltr" }} type="url"
                      value={form.privacyUrl ?? ""} onChange={e => update("privacyUrl", e.target.value || null)}
                      placeholder="https://mysite.co.il/privacy" />
                    <p style={GSub}>יוצג בתחתית עמוד הלקוח</p>
                  </div>
                  <div>
                    <div style={GLabel}>📄 קישור תנאי שימוש</div>
                    <input style={{ ...GInput, direction: "ltr" }} type="url"
                      value={form.termsUrl ?? ""} onChange={e => update("termsUrl", e.target.value || null)}
                      placeholder="https://mysite.co.il/terms" />
                    <p style={GSub}>תנאי שימוש לצד מדיניות הפרטיות</p>
                  </div>
                </div>
              </div>

              {/* 5. פיצ'רים */}
              <div style={GCard}>
                {sectionTitle("✨", "פיצ׳רים")}
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <ToggleRow
                    label="הצג מדיניות פרטיות"
                    desc="הצג קישור למדיניות פרטיות בתחתית עמוד הלקוח"
                    value={form.showPrivacyPolicy}
                    onChange={v => update("showPrivacyPolicy", v)}
                  />
                  <ToggleRow
                    label="נקודות נאמנות"
                    desc="אפשר מערכת צבירת נקודות נאמנות ללקוחות"
                    value={form.enableLoyaltyPoints}
                    onChange={v => update("enableLoyaltyPoints", v)}
                  />
                  <ToggleRow
                    label="הזמנות אונליין"
                    desc="אפשר ללקוחות לבצע הזמנות דרך הממשק הדיגיטלי"
                    value={form.enableOnlineOrders}
                    onChange={v => update("enableOnlineOrders", v)}
                  />
                  <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "14px 0", cursor: "pointer" }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>הצג מחירים בתפריט</div>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>הצג מחירים לצד פריטי התפריט</div>
                    </div>
                    <Toggle value={form.showPrices} onChange={v => update("showPrices", v)} />
                  </label>
                </div>
              </div>

              {/* Save bar */}
              <div style={{ display: "flex", alignItems: "center", gap: 12,
                borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 24 }}>
                <button onClick={save} disabled={saving} style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  background: `linear-gradient(135deg, ${GAccent}, #F59E0B)`,
                  color: "#fff", fontSize: 15, fontWeight: 700,
                  padding: "13px 36px", borderRadius: 14, border: "none", cursor: "pointer",
                  opacity: saving ? 0.7 : 1,
                  boxShadow: `0 8px 24px ${GGlow}`,
                  transition: "all 0.3s",
                }}>
                  {saving ? "שומר..." : "💾 שמור שינויים"}
                </button>
                {saved && (
                  <span style={{ color: "#34d399", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                    נשמר בהצלחה!
                  </span>
                )}
              </div>

            </div>
          );
        })()}

        {/* ════ TAB: מראה ════ */}
        {topTab === "appearance" && (
          <div style={{ padding: "28px 28px 32px", direction: "rtl" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: G_ACCENT, marginBottom: 4 }}>פלטת צבעים — ממשק SUPER ADMIN</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", marginBottom: 24 }}>הפלטה שנבחר תופיע עבורך בלבד (Super Admin). כל מסעדה בוחרת פלטה משלה.</div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14, marginBottom: 28 }}>
              {Object.keys(ADMIN_PALETTES).map(p => {
                const vars = ADMIN_PALETTES[p];
                const isActive = (form.adminPalette || "dark") === p;
                const bg      = vars["--c-bg"];
                const surface = vars["--c-surface"];
                const accent  = vars["--c-gold"];
                const text    = vars["--c-text"];
                const muted   = vars["--c-muted"];
                const sidebarFrom = vars["--c-sidebar-from"];
                const sidebarTo   = vars["--c-sidebar-to"];
                const sidebarBg   = sidebarFrom === sidebarTo
                  ? sidebarFrom
                  : `linear-gradient(180deg,${sidebarFrom} 0%,${vars["--c-sidebar-mid"]} 55%,${sidebarTo} 100%)`;
                return (
                  <button
                    key={p}
                    onClick={() => update("adminPalette", p)}
                    style={{
                      padding: 0, cursor: "pointer", textAlign: "right",
                      border: isActive ? "2px solid #fbbf24" : "1px solid rgba(255,255,255,0.14)",
                      borderRadius: 12, overflow: "hidden",
                      background: "transparent",
                      boxShadow: isActive ? `0 0 0 3px ${accent}28` : "none",
                      transition: "border-color 0.15s, box-shadow 0.15s",
                    }}
                  >
                    {/* Mini preview */}
                    <div style={{ display: "flex", height: 90, overflow: "hidden" }}>
                      <div style={{ width: 30, background: sidebarBg, flexShrink: 0, paddingTop: 8, display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                        {[...Array(4)].map((_, i) => (
                          <div key={i} style={{ width: 16, height: i === 1 ? 6 : 4, borderRadius: 2, background: i === 1 ? accent : muted + "55" }} />
                        ))}
                      </div>
                      <div style={{ flex: 1, background: bg, padding: "7px 8px", display: "flex", flexDirection: "column", gap: 4 }}>
                        <div style={{ height: 13, background: surface, borderRadius: 3, display: "flex", alignItems: "center", paddingRight: 5 }}>
                          <div style={{ width: 22, height: 3, borderRadius: 2, background: accent }} />
                        </div>
                        <div style={{ display: "flex", gap: 4 }}>
                          {[...Array(3)].map((_, i) => (
                            <div key={i} style={{ flex: 1, height: 28, background: i === 0 ? accent + "22" : surface, border: `1px solid ${i === 0 ? accent + "55" : muted + "33"}`, borderRadius: 3 }} />
                          ))}
                        </div>
                        <div style={{ height: 4, borderRadius: 2, background: text, opacity: 0.35, width: "55%" }} />
                      </div>
                    </div>
                    <div style={{ padding: "8px 10px", background: isActive ? accent + "10" : "transparent", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>{ADMIN_PALETTE_LABELS[p] ?? p}</span>
                      {isActive && <span style={{ fontSize: 10, fontWeight: 700, color: G_ACCENT, background: accent + "15", padding: "2px 7px", borderRadius: 99 }}>פעיל ✓</span>}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* ── Background gradient picker ── */}
            <div style={{ marginBottom: 32 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: G_ACCENT, marginBottom: 4 }}>ערכת רקע</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", marginBottom: 18 }}>בחר את צבע הרקע הגלובלי של ממשק הניהול</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {[
                  // ── כהים קלאסיים ──
                  { label: "לילה",     bg: "linear-gradient(135deg,#0a0a12 0%,#0f0818 50%,#0a0a12 100%)" },
                  { label: "אוקיינוס", bg: "linear-gradient(135deg,#001a2c 0%,#030712 100%)" },
                  { label: "גחלים",    bg: "linear-gradient(135deg,#1c0a00 0%,#0c0c0c 100%)" },
                  { label: "יער",      bg: "linear-gradient(135deg,#0a1a00 0%,#001a0a 100%)" },
                  { label: "גלקסיה",  bg: "linear-gradient(135deg,#1a0533 0%,#0a0412 100%)" },
                  { label: "ויסקי",    bg: "linear-gradient(135deg,#12100e 0%,#2c1810 100%)" },
                  { label: "אבן",      bg: "linear-gradient(135deg,#0a0a0a 0%,#1a1a1a 100%)" },
                  { label: "קטיפה",    bg: "linear-gradient(135deg,#1a001a 0%,#0a000a 100%)" },
                  // ── נועזים ומודרניים ──
                  { label: "אורורה",   bg: "linear-gradient(135deg,#0d0221 0%,#0a1628 40%,#001a0a 100%)" },
                  { label: "Cyberpunk",bg: "linear-gradient(135deg,#0d0221 0%,#1a0030 50%,#002040 100%)" },
                  { label: "Neon City",bg: "linear-gradient(160deg,#0a0015 0%,#0d0030 35%,#001020 100%)" },
                  { label: "Lava",     bg: "linear-gradient(135deg,#1a0000 0%,#2d0a00 40%,#1a0010 100%)" },
                  { label: "Deep Sea", bg: "linear-gradient(180deg,#000d1a 0%,#001428 50%,#000a1a 100%)" },
                  { label: "Storm",    bg: "linear-gradient(135deg,#0a0a1e 0%,#1a1a2e 50%,#0d0d20 100%)" },
                  { label: "Volcanic", bg: "linear-gradient(135deg,#150500 0%,#2a0800 45%,#0d0500 100%)" },
                  { label: "Midnight", bg: "linear-gradient(160deg,#05051a 0%,#0a0a28 50%,#080818 100%)" },
                  { label: "Jade",     bg: "linear-gradient(135deg,#000f08 0%,#001a10 50%,#000d08 100%)" },
                  { label: "Noir",     bg: "linear-gradient(160deg,#080808 0%,#111111 50%,#0a0a0a 100%)" },
                  { label: "Arctic",   bg: "linear-gradient(135deg,#001428 0%,#002040 45%,#000d1a 100%)" },
                  { label: "Eclipse",  bg: "linear-gradient(135deg,#0a0010 0%,#100020 45%,#050010 100%)" },
                ].map(({ label, bg }) => {
                  const isActive = form.adminBg === bg && !form.adminBgImage;
                  return (
                    <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                      <button
                        type="button"
                        onClick={() => { update("adminBg", bg); update("adminBgImage", null); }}
                        title={label}
                        style={{
                          width: 52, height: 52, borderRadius: 14, background: bg, cursor: "pointer",
                          border: isActive ? "2px solid #fff" : "2px solid transparent",
                          boxShadow: isActive ? "0 0 0 3px rgba(245,158,11,0.5)" : "0 2px 8px rgba(0,0,0,0.4)",
                          transform: isActive ? "scale(1.12)" : "scale(1)",
                          transition: "all 0.15s", position: "relative",
                        }}
                      >
                        {isActive && (
                          <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "#fff" }}>✓</span>
                        )}
                      </button>
                      <span style={{ fontSize: 10, color: isActive ? "#F59E0B" : "rgba(255,255,255,0.4)", fontWeight: isActive ? 700 : 400 }}>{label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Template selector ── */}
            <div style={{ marginBottom: 32 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: G_ACCENT, marginBottom: 4 }}>תבנית ממשק</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", marginBottom: 20 }}>בחר את סגנון תצוגת דפי הניהול</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>

                {/* Classic template */}
                {(() => {
                  const isActive = (form.adminBg !== "var(--c-bg)" && form.adminBg !== "var(--c-panel)") &&
                    !form.adminBgImage;
                  return (
                    <button onClick={() => {}} style={{
                      padding: 0, cursor: "default", textAlign: "right",
                      border: "1px solid rgba(255,255,255,0.14)",
                      borderRadius: 14, overflow: "hidden", background: "transparent",
                      opacity: 0.55,
                    }}>
                      <div style={{ height: 120, background: "#1a1208", padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                        <div style={{ height: 18, background: "#2a1e0a", borderRadius: 4, display: "flex", alignItems: "center", paddingRight: 8, gap: 6 }}>
                          <div style={{ width: 16, height: 2, borderRadius: 1, background: "#C9A84C" }} />
                          <div style={{ width: 40, height: 8, borderRadius: 2, background: "#2e2008" }} />
                        </div>
                        <div style={{ display: "flex", gap: 6, flex: 1 }}>
                          {[...Array(3)].map((_, i) => (
                            <div key={i} style={{ flex: 1, background: "#221a08", border: "1px solid #3a2c10", borderRadius: 4 }} />
                          ))}
                        </div>
                        <div style={{ height: 12, background: "#2a1e0a", borderRadius: 3, width: "70%" }} />
                      </div>
                      <div style={{ padding: "9px 12px", background: "rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.6)" }}>קלאסי</span>
                        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", padding: "2px 8px", borderRadius: 99, background: "rgba(255,255,255,0.06)" }}>ברירת מחדל</span>
                      </div>
                    </button>
                  );
                })()}

                {/* Glass template */}
                <button onClick={() => {}} style={{
                  padding: 0, cursor: "default", textAlign: "right",
                  border: `2px solid ${G_ACCENT}`,
                  borderRadius: 14, overflow: "hidden", background: "transparent",
                  boxShadow: `0 0 0 3px rgba(217,119,6,0.2)`,
                }}>
                  <div style={{
                    height: 120,
                    background: "linear-gradient(rgba(0,0,0,0.65),rgba(0,0,0,0.65)), url('https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=400') center/cover",
                    padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6,
                  }}>
                    {/* Title bar */}
                    <div style={{ height: 18, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(8px)", borderRadius: 6, border: "1px solid rgba(255,255,255,0.14)", display: "flex", alignItems: "center", paddingRight: 8, gap: 5 }}>
                      <div style={{ width: 3, height: 10, borderRadius: 1, background: "#F59E0B" }} />
                      <div style={{ width: 30, height: 6, borderRadius: 2, background: "rgba(255,255,255,0.2)" }} />
                      <div style={{ flex: 1 }} />
                      <div style={{ width: 22, height: 8, borderRadius: 4, background: "linear-gradient(135deg,#D97706,#F59E0B)" }} />
                    </div>
                    {/* KPI cards */}
                    <div style={{ display: "flex", gap: 4 }}>
                      {["rgba(217,119,6,0.25)","rgba(16,185,129,0.2)","rgba(59,130,246,0.2)"].map((c, i) => (
                        <div key={i} style={{ flex: 1, height: 22, background: "rgba(0,0,0,0.35)", border: `1px solid ${c}`, borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <div style={{ width: 12, height: 3, borderRadius: 1, background: c.replace("0.2","0.8").replace("0.25","0.9") }} />
                        </div>
                      ))}
                    </div>
                    {/* Table */}
                    <div style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 5, overflow: "hidden" }}>
                      <div style={{ height: 8, background: "rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.08)" }} />
                      {[...Array(2)].map((_, i) => (
                        <div key={i} style={{ height: 10, borderBottom: "1px solid rgba(255,255,255,0.04)", display: "flex", alignItems: "center", gap: 4, padding: "0 5px" }}>
                          <div style={{ width: 16, height: 16, borderRadius: 3, background: "rgba(217,119,6,0.15)", flexShrink: 0 }} />
                          <div style={{ width: 30, height: 3, borderRadius: 1, background: "rgba(255,255,255,0.25)" }} />
                          <div style={{ flex: 1 }} />
                          <div style={{ width: 18, height: 5, borderRadius: 3, background: "rgba(16,185,129,0.3)", border: "1px solid rgba(16,185,129,0.4)" }} />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ padding: "9px 12px", background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>גלס מודרני</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: G_ACCENT, padding: "2px 8px", borderRadius: 99, background: "rgba(217,119,6,0.15)" }}>פעיל ✓</span>
                  </div>
                </button>

              </div>
            </div>

            {/* Save bar */}
            <div style={{ display: "flex", alignItems: "center", gap: 12,
              borderTop: `1px solid ${G_BORDER}`, padding: "14px 0 0",
            }}>
              <button onClick={save} disabled={saving} style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: `linear-gradient(135deg, ${G_ACCENT}, #F59E0B)`,
                color: "#fff", fontSize: 14, fontWeight: 700,
                padding: "12px 28px", borderRadius: 12, border: "none", cursor: "pointer",
                opacity: saving ? 0.6 : 1,
                boxShadow: "0 6px 20px rgba(217,119,6,0.4)",
              }}>
                {saving ? "שומר..." : "💾 שמור שינויים"}
              </button>
              {saved && (
                <span style={{ color: "#34d399", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                  נשמר בהצלחה!
                </span>
              )}
            </div>
          </div>
        )}

        {/* ════ TAB: אבטחה ════ */}
        {topTab === "security" && <PasswordPolicyTab />}

        {/* ════ TAB: מתקדם ════ */}
        {topTab === "advanced" && (
          <>
            {/* Sub-tab bar */}
            <div style={subTabBarStyle}>
              {ADV_TABS.map(t => (
                <button key={t.id} onClick={() => setAdvTab(t.id)} style={subTabStyle(t.id)}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Sub-tab content */}
            <div style={{ padding: "24px 24px 28px" }}>
              {advTab === "backup"  && <BackupSection />}
              {advTab === "restore" && <RestoreSection />}
              {advTab === "clear"   && <ClearOrdersSection />}
            </div>
          </>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <AssistantWidget page="settings" />
    </div>
  );
}
