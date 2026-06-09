"use client";

import { useState, useRef, useEffect } from "react";
import { T, ADMIN_PALETTES, ADMIN_PALETTE_LABELS } from "@/lib/ui";

const DARK_INPUT: React.CSSProperties = {
  background:   T.overlay,
  border:       `1px solid ${T.border}`,
  color:        T.text,
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
      <div style={{ border: `1px dashed ${T.border}`, borderRadius: 12, padding: 16,
        background: T.overlay, color: T.muted, fontSize: 13 }}>
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
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: T.green, flexShrink: 0,
            boxShadow: "0 0 0 3px rgba(81,207,102,0.2)" }} />
          <div style={{ flex: 1 }}>
            <div style={{ color: T.green, fontWeight: 700, fontSize: 13 }}>גיבוי אוטומטי פעיל</div>
            <div style={{ color: T.sub, fontSize: 12, marginTop: 2 }}>
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
            color: triggerMsg.ok ? T.green : T.red,
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
          <span style={{ fontSize: 11, color: T.muted }}>
            לשינוי תזמון: עדכן{" "}
            <code style={{ background: T.overlay, padding: "1px 5px", borderRadius: 4 }}>BACKUP_SCHEDULE</code>
            {" "}ב-Vercel + Redeploy
          </span>
        </div>
      </div>
    );
  }

  /* Not active */
  const [showDebug, setShowDebug] = useState(false);
  return (
    <div style={{ border: `1px dashed ${T.border}`, borderRadius: 12, overflow: "hidden",
      background: T.overlay }}>
      <div style={{ padding: 16 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>⏰</span>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <div style={{ color: T.text, fontWeight: 700, fontSize: 13 }}>גיבוי אוטומטי</div>
              <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700,
                background: "rgba(108,117,125,0.2)", color: T.muted }}>לא פעיל</span>
            </div>
            <div style={{ fontSize: 12, color: T.sub, display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                { key: "CRON_SECRET",                        ok: status.hasCronSecret, desc: "מחרוזת סודית כלשהי" },
                { key: "BACKUP_SCHEDULE",                    ok: !!status.schedule && status.schedule !== "off", desc: '"daily" או "weekly"' },
                { key: "GMAIL_USER / GMAIL_APP_PASSWORD",    ok: status.hasGmail,      desc: "נדרש לשליחת המייל" },
              ].map(row => (
                <div key={row.key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: row.ok ? T.green : T.red, fontSize: 13 }}>{row.ok ? "✓" : "✗"}</span>
                  <code style={{ padding: "1px 6px", borderRadius: 5, fontSize: 11,
                    background: row.ok ? "rgba(81,207,102,0.12)" : "rgba(255,107,107,0.12)",
                    color: row.ok ? T.green : T.red }}>{row.key}</code>
                  <span style={{ color: T.muted }}>{row.desc}</span>
                </div>
              ))}
              <div style={{ color: T.sub, fontWeight: 600, marginTop: 4 }}>
                לאחר עדכון — בצע <strong>Redeploy</strong> ב-Vercel.
              </div>
            </div>
          </div>
        </div>
      </div>

      {status.debug && (
        <div style={{ borderTop: `1px solid ${T.border}` }}>
          <button onClick={() => setShowDebug(v => !v)} style={{
            width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 16px",
            fontSize: 12, color: T.muted, background: "transparent", border: "none", cursor: "pointer", textAlign: "right",
          }}>
            ℹ️ {showDebug ? "הסתר אבחון" : "הצג אבחון"}
          </button>
          {showDebug && (
            <div style={{ padding: "0 16px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
              {Object.entries(status.debug).map(([k, v]) => (
                <div key={k} style={{ display: "flex", gap: 8, fontSize: 11, fontFamily: "monospace" }}>
                  <span style={{ color: T.muted, flexShrink: 0 }}>{k}:</span>
                  <span style={{ color: String(v).startsWith("✓") ? T.green : String(v).startsWith("✗") ? T.red : T.text }}>
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
          <div style={{ fontSize: 12, color: T.sub, lineHeight: 1.6 }}>
            מסעדות, משתמשים, תפריטים, קטגוריות, פריטים, תוספות, הזמנות, לוגים ונתוני צפיות.<br/>
            <span style={{ color: T.blue }}>🔒 סיסמאות לא נכללות בגיבוי</span>
          </div>
        </div>
      </div>

      {/* Auto-backup */}
      <AutoBackupStatus />

      {/* Google Drive hint */}
      <div style={{ background: "rgba(252,196,25,0.06)", border: "1px solid rgba(252,196,25,0.2)",
        borderRadius: 10, padding: "12px 16px", color: T.gold, fontSize: 13,
        display: "flex", alignItems: "flex-start", gap: 8 }}>
        <span>☁️</span>
        <span>
          <b>Google Drive:</b> הגדר{" "}
          <code style={{ background: T.overlay, padding: "1px 5px", borderRadius: 4 }}>GOOGLE_SERVICE_ACCOUNT_JSON</code>
          {" "}ב-Vercel לגיבוי אוטומטי לדרייב.
        </span>
      </div>

      {/* Scope selector */}
      {restaurants.length > 1 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase",
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
        <div style={{ background: "rgba(255,107,107,0.1)", border: "1px solid rgba(255,107,107,0.3)",
          borderRadius: 8, padding: "10px 14px", color: T.red, fontSize: 13 }}>
          ⚠️ {error}
        </div>
      )}

      {/* Success */}
      {lastBackup && (
        <div style={{ background: "rgba(81,207,102,0.1)", border: "1px solid rgba(81,207,102,0.3)",
          borderRadius: 8, padding: "10px 14px", color: T.green, fontSize: 13 }}>
          ✓ גיבוי הורד בהצלחה — {lastBackup}
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase",
            letterSpacing: "0.08em", marginBottom: 8 }}>גיבויים אחרונים</div>
          <div style={{ border: `1px solid ${T.border}`, borderRadius: 10, overflow: "hidden" }}>
            {history.slice(0, 5).map((entry, i) => {
              const trigger  = (entry.meta as { trigger?: string } | null)?.trigger;
              const label    = trigger === "cron" ? "אוטומטי" : "ידני";
              const dateStr  = new Date(entry.createdAt).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" });
              const who      = trigger === "cron" ? "auto" : (entry.userEmail ?? "—");
              return (
                <div key={entry.id} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 14px",
                  borderBottom: i < history.slice(0,5).length - 1 ? `1px solid ${T.border}` : "none",
                  background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)",
                  fontSize: 13,
                }}>
                  <span style={{
                    padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                    background: trigger === "cron" ? "rgba(190,75,219,0.15)" : "rgba(51,154,240,0.15)",
                    color: trigger === "cron" ? "#be4bdb" : T.blue,
                  }}>{label}</span>
                  <span style={{ color: T.sub, fontFamily: "monospace", fontSize: 12 }}>{dateStr}</span>
                  <span style={{ color: T.muted, fontSize: 12, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{who}</span>
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
        body: JSON.stringify({ backup: backupData, scope: "menus", mode: "preview" }),
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
        body: JSON.stringify({ backup: backupData, scope: "menus", mode: "restore" }),
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
          background: backupData ? "rgba(81,207,102,0.06)" : T.overlay,
          border: `2px dashed ${backupData ? "rgba(81,207,102,0.5)" : T.border}`,
          borderRadius: 12, padding: 32, textAlign: "center", cursor: "pointer",
          transition: "border-color 0.15s",
        }}
      >
        <div style={{ fontSize: 34, marginBottom: 8 }}>{backupData ? "✅" : "📂"}</div>
        <p style={{ color: T.sub, fontSize: 13 }}>
          {file ? file.name : "גרור קובץ גיבוי (JSON) לכאן, או לחץ לבחירה"}
        </p>
        <p style={{ color: T.muted, fontSize: 12, marginTop: 4 }}>menu4u-backup-*.json</p>
        {backupData && (
          <button style={{ color: T.muted, fontSize: 12, textDecoration: "underline",
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
          borderRadius: 8, padding: "10px 14px", color: T.red, fontSize: 13 }}>
          ⚠️ {error}
        </div>
      )}

      {/* Backup metadata */}
      {backupData && meta && (
        <div style={{ background: T.overlay, border: `1px solid ${T.border}`, borderRadius: 12, padding: 16 }}>
          <div style={{ color: T.text, fontWeight: 700, fontSize: 14, marginBottom: 10 }}>פרטי הגיבוי</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 16px", fontSize: 12, marginBottom: 12 }}>
            {meta.exportedAt && (
              <><span style={{ color: T.muted }}>יוצא ב:</span>
              <span style={{ color: T.sub }}>{new Date(meta.exportedAt).toLocaleString("he-IL", { dateStyle: "medium", timeStyle: "short" })}</span></>
            )}
            {meta.exportedBy && (
              <><span style={{ color: T.muted }}>יוצא ע״י:</span>
              <span style={{ color: T.sub, fontFamily: "monospace" }}>{meta.exportedBy}</span></>
            )}
            {meta.restaurantIds && (
              <><span style={{ color: T.muted }}>מסעדות:</span>
              <span style={{ color: T.sub }}>{meta.restaurantIds.length}</span></>
            )}
            <span style={{ color: T.muted }}>גרסה:</span>
            <span style={{ color: T.sub }}>{meta.version}</span>
          </div>
          {counts && Object.keys(counts).length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 12 }}>
              {Object.entries(counts).map(([key, val]) => (
                <div key={key} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8,
                  padding: "8px 10px", textAlign: "center" }}>
                  <div style={{ color: T.text, fontWeight: 700, fontSize: 16 }}>{val}</div>
                  <div style={{ color: T.muted, fontSize: 10 }}>{key}</div>
                </div>
              ))}
            </div>
          )}
          {!diff && (
            <button onClick={previewDiff} disabled={previewing} style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: "linear-gradient(135deg,#6366f1,#818cf8)",
              color: "#fff", fontSize: 13, fontWeight: 700,
              padding: "8px 18px", borderRadius: 8, border: "none", cursor: "pointer",
              opacity: previewing ? 0.6 : 1,
            }}>
              {previewing ? "בודק..." : "🔍 בדוק שינויים לפני שחזור"}
            </button>
          )}
        </div>
      )}

      {/* Diff panel */}
      {diff && (
        <div style={{ border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
          {/* Summary */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px",
            background: T.overlay, borderBottom: `1px solid ${T.border}`, flexWrap: "wrap" }}>
            <span style={{ color: T.text, fontWeight: 700, fontSize: 13 }}>תוצאת הבדיקה</span>
            {diff.toCreate > 0 && (
              <span style={{ padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                background: "rgba(81,207,102,0.15)", color: T.green }}>✚ {diff.toCreate} חדשות</span>
            )}
            {diff.toUpdate > 0 && (
              <span style={{ padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                background: "rgba(252,196,25,0.15)", color: T.gold }}>✎ {diff.toUpdate} יידרסו</span>
            )}
            {diff.noChange > 0 && (
              <span style={{ padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                background: `rgba(108,117,125,0.2)`, color: T.muted }}>✓ {diff.noChange} ללא שינוי</span>
            )}
            {diff.toCreate === 0 && diff.toUpdate === 0 && (
              <span style={{ padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                background: "rgba(81,207,102,0.15)", color: T.green }}>✓ אין שינויים — הנתונים זהים</span>
            )}
            <button onClick={() => { setDiff(null); setShowAllDiff(false); }}
              style={{ marginRight: "auto", fontSize: 12, color: T.muted, background: "transparent",
                border: "none", cursor: "pointer" }}>× סגור</button>
          </div>

          {diffEntries.length > 0 && (
            <div style={{ maxHeight: 280, overflowY: "auto" }}>
              {visibleEntries.map((entry, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 14px",
                  borderBottom: `1px solid ${T.border}` }}>
                  <span style={{
                    flexShrink: 0, padding: "2px 7px", borderRadius: 6, fontSize: 10, fontWeight: 700,
                    marginTop: 1,
                    background: entry.action === "create" ? "rgba(81,207,102,0.15)" : "rgba(252,196,25,0.15)",
                    color: entry.action === "create" ? T.green : T.gold,
                  }}>
                    {entry.action === "create" ? "חדש" : "עדכון"}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {entry.name}
                      <span style={{ fontWeight: 400, color: T.muted, marginRight: 6 }}>— {TYPE_LABELS[entry.type] ?? entry.type}</span>
                    </div>
                    {entry.changes && entry.changes.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 12px", marginTop: 3 }}>
                        {entry.changes.map((fc, j) => (
                          <span key={j} style={{ fontSize: 11, color: T.sub }}>
                            <span style={{ fontWeight: 600, color: T.text }}>{fc.field}:</span>{" "}
                            <span style={{ textDecoration: "line-through", color: T.red }}>{fc.from}</span>
                            {" → "}
                            <span style={{ color: T.green, fontWeight: 600 }}>{fc.to}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {diffEntries.length > SHOW_N && (
                <div style={{ padding: "10px", textAlign: "center", background: T.overlay }}>
                  <button onClick={() => setShowAllDiff(v => !v)} style={{
                    fontSize: 12, color: T.blue, background: "transparent", border: "none", cursor: "pointer", fontWeight: 600,
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
              background: "rgba(252,196,25,0.06)", borderTop: `1px solid ${T.border}` }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.gold }}>{diff.toUpdate} רשומות קיימות יידרסו</div>
                <div style={{ fontSize: 12, color: T.sub, marginTop: 2 }}>שינויים שביצעת מאז הגיבוי יאבדו לנצח.</div>
              </div>
            </div>
          )}

          <div style={{ padding: "12px 14px", borderTop: `1px solid ${T.border}`,
            background: T.overlay, display: "flex", gap: 8 }}>
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
                  background: "transparent", color: T.sub, fontSize: 13, fontWeight: 600,
                  padding: "8px 14px", borderRadius: 8, border: `1px solid ${T.border}`, cursor: "pointer",
                }}>ביטול</button>
              </>
            ) : (
              <>
                <div style={{ width: "100%", marginBottom: 8, fontSize: 12, fontWeight: 700, color: T.red }}>
                  ⚠️ האם לדרוס {diff.toUpdate} רשומות קיימות?
                </div>
                <button onClick={doRestore} disabled={restoring} style={{
                  background: T.red, color: "#fff", fontSize: 13, fontWeight: 700,
                  padding: "8px 18px", borderRadius: 8, border: "none", cursor: "pointer",
                  opacity: restoring ? 0.6 : 1 }}>
                  {restoring ? "משחזר..." : "כן, דרוס והמשך"}
                </button>
                <button onClick={() => setConfirm(false)} style={{
                  background: "transparent", color: T.sub, fontSize: 13, fontWeight: 600,
                  padding: "8px 14px", borderRadius: 8, border: `1px solid ${T.border}`, cursor: "pointer",
                }}>חזור</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Success */}
      {restoreResult && (
        <div style={{ background: "rgba(81,207,102,0.1)", border: "1px solid rgba(81,207,102,0.3)",
          borderRadius: 8, padding: "10px 14px", color: T.green, fontSize: 13 }}>
          ✓ שחזור הושלם! נוצרו {restoreResult.created} רשומות חדשות, עודכנו {restoreResult.updated} רשומות קיימות.
        </div>
      )}

      <p style={{ fontSize: 12, color: T.muted }}>
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
      <div style={{ background: "rgba(81,207,102,0.1)", border: "1px solid rgba(81,207,102,0.3)",
        borderRadius: 10, padding: "12px 16px", color: T.green, fontSize: 13 }}>
        ✓ נמחקו {result.count} הזמנות בהצלחה — הנתונים מתחילים מאפס.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ background: "rgba(255,107,107,0.06)", border: "1px solid rgba(255,107,107,0.25)",
        borderRadius: 12, padding: "18px 20px" }}>
        <div style={{ color: T.red, fontWeight: 700, fontSize: 15, marginBottom: 6 }}>⚠️ ניקוי כל ההזמנות</div>
        <div style={{ color: T.sub, fontSize: 13, lineHeight: 1.6 }}>
          פעולה זו תמחק לצמיתות את כל ההזמנות, פריטי ההזמנות ולוגי הסטטוס מכל המסעדות.<br/>
          <span style={{ color: T.red, fontWeight: 600 }}>לא ניתן לבטל פעולה זו!</span>
        </div>
      </div>

      {!confirm ? (
        <button onClick={() => setConfirm(true)} style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: "rgba(255,107,107,0.15)", color: T.red,
          fontSize: 14, fontWeight: 700, padding: "10px 22px",
          borderRadius: 8, border: "1px solid rgba(255,107,107,0.3)", cursor: "pointer",
          width: "fit-content",
        }}>
          🗑️ מחק את כל ההזמנות
        </button>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ background: "rgba(255,107,107,0.1)", border: "1px solid rgba(255,107,107,0.3)",
            borderRadius: 10, padding: "12px 16px" }}>
            <div style={{ color: T.red, fontWeight: 700, fontSize: 13, marginBottom: 4 }}>פעולה בלתי הפיכה!</div>
            <div style={{ color: T.sub, fontSize: 12 }}>כל ההזמנות יימחקו לצמיתות. לא ניתן לשחזר.</div>
          </div>
          {error && (
            <div style={{ color: T.red, fontSize: 13, padding: "8px 12px",
              background: "rgba(255,107,107,0.08)", borderRadius: 8 }}>{error}</div>
          )}
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={handleClear} disabled={clearing} style={{
              background: T.red, color: "#fff", fontSize: 13, fontWeight: 700,
              padding: "10px 22px", borderRadius: 8, border: "none", cursor: "pointer",
              opacity: clearing ? 0.6 : 1,
            }}>
              {clearing ? "מוחק..." : "כן, מחק הכל"}
            </button>
            <button onClick={() => setConfirm(false)} style={{
              background: "transparent", color: T.sub, fontSize: 13, fontWeight: 600,
              padding: "10px 18px", borderRadius: 8, border: `1px solid ${T.border}`, cursor: "pointer",
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

  const inp: React.CSSProperties = { background: T.overlay, border: `1px solid ${T.border}`, color: T.text, borderRadius: 8, padding: "8px 12px", fontSize: 14, width: 100, outline: "none" };

  if (!policy) return <div style={{ padding: 40, color: T.muted, textAlign: "center" }}>טוען...</div>;

  const card: React.CSSProperties = { background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: "16px 20px" };
  const numInp: React.CSSProperties = { ...inp, width: 68, textAlign: "center", padding: "7px 10px" };
  const hint = (text: string) => <div style={{ fontSize: 11, color: T.gold, marginTop: 6 }}>{text}</div>;

  return (
    <div style={{ padding: "28px 0", maxWidth: 780, direction: "rtl" }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 2 }}>מדיניות סיסמאות</h2>
      <p style={{ fontSize: 12, color: T.muted, marginBottom: 20 }}>הגדרות אבטחה לכלל המשתמשים במערכת</p>

      {/* Row 1+2: all 4 number cards in a 4-column grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 12 }}>

        {/* Expiry */}
        <div style={card}>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 2 }}>⏳ תפוגת סיסמה</div>
          <div style={{ fontSize: 11, color: T.muted, marginBottom: 12 }}>ימים עד החלפה</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="number" min={0} max={365} value={policy.maxAgeDays}
              onChange={e => setPolicy({ ...policy, maxAgeDays: Number(e.target.value) })} style={numInp} />
            <span style={{ color: T.muted, fontSize: 12 }}>ימים</span>
          </div>
          {policy.maxAgeDays > 0 ? hint(`כל ${policy.maxAgeDays} ימים`) : <div style={{ fontSize: 11, color: T.muted, marginTop: 6 }}>0 = ללא הגבלה</div>}
        </div>

        {/* Idle timeout */}
        <div style={card}>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 2 }}>🔒 ניתוק אוטומטי</div>
          <div style={{ fontSize: 11, color: T.muted, marginBottom: 12 }}>חוסר פעילות</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="number" min={0} max={24} step={1} value={Math.round(policy.idleTimeoutMinutes / 60)}
              onChange={e => setPolicy({ ...policy, idleTimeoutMinutes: Number(e.target.value) * 60 })} style={numInp} />
            <span style={{ color: T.muted, fontSize: 12 }}>שעות</span>
          </div>
          {policy.idleTimeoutMinutes > 0 ? hint(`אחרי ${Math.round(policy.idleTimeoutMinutes / 60)} שעות`) : <div style={{ fontSize: 11, color: T.muted, marginTop: 6 }}>0 = ללא ניתוק</div>}
        </div>

        {/* Min length */}
        <div style={card}>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 2 }}>📏 אורך מינימלי</div>
          <div style={{ fontSize: 11, color: T.muted, marginBottom: 12 }}>תווים לסיסמה</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="number" min={6} max={32} value={policy.minLength}
              onChange={e => setPolicy({ ...policy, minLength: Number(e.target.value) })} style={numInp} />
            <span style={{ color: T.muted, fontSize: 12 }}>תווים</span>
          </div>
          <div style={{ fontSize: 11, color: T.muted, marginTop: 6 }}>מומלץ: 8+</div>
        </div>

        {/* History */}
        <div style={card}>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 2 }}>🔁 היסטוריה</div>
          <div style={{ fontSize: 11, color: T.muted, marginBottom: 12 }}>מניעת שימוש חוזר</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="number" min={0} max={10} value={policy.historyCount}
              onChange={e => setPolicy({ ...policy, historyCount: Number(e.target.value) })} style={numInp} />
            <span style={{ color: T.muted, fontSize: 12 }}>סיסמאות</span>
          </div>
          {policy.historyCount > 0 ? hint(`חסום ${policy.historyCount} אחרונות`) : <div style={{ fontSize: 11, color: T.muted, marginTop: 6 }}>0 = ללא הגבלה</div>}
        </div>
      </div>

      {/* Row 3: Complexity — compact toggle rows */}
      <div style={{ ...card, marginBottom: 24 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 14 }}>🔐 דרישות מורכבות</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {([
            { key: "requireUppercase", label: "אות גדולה", desc: "A–Z" },
            { key: "requireNumbers",   label: "ספרה",       desc: "0–9" },
            { key: "requireSymbols",   label: "תו מיוחד",   desc: "!@#$..." },
          ] as { key: keyof PolicyState; label: string; desc: string }[]).map(({ key, label: lbl, desc }, i, arr) => {
            const active = policy[key] as boolean;
            return (
              <label key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: i < arr.length - 1 ? `1px solid ${T.border}` : "none", cursor: "pointer" }}>
                <input type="checkbox" checked={active} onChange={e => setPolicy({ ...policy, [key]: e.target.checked })} style={{ display: "none" }} />
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 13, color: active ? T.text : T.muted, fontWeight: active ? 600 : 400 }}>{lbl}</span>
                  <span style={{ fontSize: 11, color: T.muted }}>{desc}</span>
                </div>
                {/* Toggle switch */}
                <div style={{ width: 38, height: 22, borderRadius: 11, background: active ? T.gold : T.border, position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
                  <div style={{ position: "absolute", top: 3, right: active ? 3 : undefined, left: active ? undefined : 3, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "all 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {err && <div style={{ color: T.red, fontSize: 13, marginBottom: 12 }}>{err}</div>}

      <button onClick={handleSave} disabled={saving}
        style={{ background: saving ? T.muted : T.gold, color: "#fff", border: "none", padding: "12px 32px", borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: saving ? "not-allowed" : "pointer", minWidth: 160 }}>
        {saving ? "שומר..." : saved ? "✓ נשמר" : "שמור מדיניות"}
      </button>
    </div>
  );
}

/* ─── Main ───────────────────────────────────────────────── */
export default function SettingsClient({ config: initial }: { config: Config }) {
  const [form,          setForm]          = useState<Config>({ ...initial });
  const [saving,        setSaving]        = useState(false);
  const [saved,         setSaved]         = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const [topTab, setTopTab] = useState<TopTab>("settings");
  const [advTab, setAdvTab] = useState<AdvTab>("backup");

  const fileRef = useRef<HTMLInputElement>(null);

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

  const tabBarStyle: React.CSSProperties = {
    display: "flex",
    background: T.surface,
    borderRadius: "14px 14px 0 0",
    borderBottom: `2px solid ${T.border}`,
    padding: "0 12px",
  };

  function topTabStyle(id: TopTab): React.CSSProperties {
    const active = topTab === id;
    return {
      display: "flex", alignItems: "center", gap: 8,
      padding: "14px 24px 12px",
      fontSize: 14, fontWeight: 700,
      color: active ? T.gold : T.muted,
      borderBottom: active ? `3px solid ${T.gold}` : "3px solid transparent",
      position: "relative", bottom: -2,
      cursor: "pointer", background: "transparent", border: "none",
      outline: "none", transition: "color 0.15s",
      whiteSpace: "nowrap",
    };
  }

  const subTabBarStyle: React.CSSProperties = {
    display: "flex",
    borderBottom: `1px solid ${T.border}`,
    padding: "0 20px",
    background: "rgba(0,0,0,0.2)",
  };

  function subTabStyle(id: AdvTab): React.CSSProperties {
    const active = advTab === id;
    return {
      display: "flex", alignItems: "center", gap: 7,
      padding: "10px 18px 9px",
      fontSize: 13, fontWeight: 600,
      color: active ? T.gold : T.muted,
      borderBottom: active ? `2px solid ${T.gold}` : "2px solid transparent",
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

      {/* ── Card ── */}
      <div style={{
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderTop: "none",
        borderRadius: "0 0 16px 16px",
        overflow: "hidden",
      }}>

        {/* ════ TAB: הגדרות ════ */}
        {topTab === "settings" && (
          <>
            {/* 4-col grid — full width */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 1,
              background: T.border,
            }}>
              {/* שם האתר */}
              <div style={{ background: T.surface, padding: "20px 22px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7,
                  fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 8 }}>
                  <span style={{ fontSize: 15 }}>✏️</span> שם האתר
                </div>
                <input style={DARK_INPUT} type="text" value={form.siteName}
                  onChange={e => update("siteName", e.target.value)} placeholder="Menu4U" />
                <p style={{ fontSize: 11, color: T.muted, marginTop: 5 }}>מוצג בסיידבר לצד הלוגו</p>
              </div>

              {/* דומיין ראשי */}
              <div style={{ background: T.surface, padding: "20px 22px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7,
                  fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 8 }}>
                  <span style={{ fontSize: 15 }}>🌐</span> דומיין ראשי
                </div>
                <input style={{ ...DARK_INPUT, direction: "ltr" }} type="text"
                  value={form.domain ?? ""} onChange={e => update("domain", e.target.value || null)}
                  placeholder="app.mysite.co.il" />
                <p style={{ fontSize: 11, color: T.muted, marginTop: 5 }}>הדומיין הראשי של הפלטפורמה</p>
              </div>

              {/* זכויות יוצרים */}
              <div style={{ background: T.surface, padding: "20px 22px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7,
                  fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 8 }}>
                  <span style={{ fontSize: 15 }}>©</span> זכויות יוצרים
                </div>
                <input style={DARK_INPUT} type="text"
                  value={form.copyright ?? ""} onChange={e => update("copyright", e.target.value || null)}
                  placeholder={`© ${new Date().getFullYear()} Menu4U · כל הזכויות שמורות`} />
                <p style={{ fontSize: 11, color: T.muted, marginTop: 5 }}>מוצג בתחתית הפאנל</p>
              </div>

              {/* לוגו */}
              <div style={{ background: T.surface, padding: "20px 22px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7,
                  fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 8 }}>
                  <span style={{ fontSize: 15 }}>🖼️</span> לוגו האתר
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div onClick={() => fileRef.current?.click()}
                    style={{ width: 58, height: 58, background: T.overlay,
                      border: `2px dashed ${T.border}`, borderRadius: 10,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 22, flexShrink: 0, cursor: "pointer", overflow: "hidden" }}>
                    {form.logo
                      ? <img src={form.logo} alt="לוגו" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                      : <span>🏪</span>}
                  </div>
                  <div>
                    <p style={{ color: T.sub, fontSize: 12, marginBottom: 8 }}>PNG/SVG שקוף, 200×200px+</p>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => fileRef.current?.click()} disabled={uploadingLogo} style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        background: "linear-gradient(135deg,#8B6914,#C9A84C)",
                        color: "#fff", fontSize: 12, fontWeight: 700,
                        padding: "7px 14px", borderRadius: 8, border: "none", cursor: "pointer",
                        opacity: uploadingLogo ? 0.6 : 1,
                      }}>
                        {uploadingLogo ? "מעלה..." : "📤 העלה"}
                      </button>
                      {form.logo && (
                        <button onClick={() => update("logo", null)} style={{
                          background: "transparent", color: T.red, fontSize: 12, fontWeight: 600,
                          padding: "7px 12px", borderRadius: 8,
                          border: "1px solid rgba(255,107,107,0.3)", cursor: "pointer",
                        }}>הסר</button>
                      )}
                    </div>
                  </div>
                </div>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = ""; }} />
              </div>
            </div>

            {/* Save bar */}
            <div style={{ display: "flex", alignItems: "center", gap: 12,
              borderTop: `1px solid ${T.border}`, padding: "14px 22px",
              background: "rgba(0,0,0,0.12)" }}>
              <button onClick={save} disabled={saving} style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: "linear-gradient(135deg,#8B6914,#C9A84C)",
                color: "#fff", fontSize: 14, fontWeight: 700,
                padding: "10px 24px", borderRadius: 8, border: "none", cursor: "pointer",
                opacity: saving ? 0.6 : 1,
              }}>
                {saving ? "שומר..." : "💾 שמור שינויים"}
              </button>
              {saved && (
                <span style={{ color: T.green, fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                  נשמר בהצלחה!
                </span>
              )}
            </div>
          </>
        )}

        {/* ════ TAB: מראה ════ */}
        {topTab === "appearance" && (
          <div style={{ padding: "28px 28px 32px", direction: "rtl" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: T.gold, marginBottom: 4 }}>פלטת צבעים — ממשק SUPER ADMIN</div>
            <div style={{ fontSize: 13, color: T.sub, marginBottom: 24 }}>הפלטה שנבחר תופיע עבורך בלבד (Super Admin). כל מסעדה בוחרת פלטה משלה.</div>

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
                      border: isActive ? `2px solid ${T.gold}` : `1px solid ${T.border}`,
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
                      <span style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{ADMIN_PALETTE_LABELS[p] ?? p}</span>
                      {isActive && <span style={{ fontSize: 10, fontWeight: 700, color: T.gold, background: accent + "15", padding: "2px 7px", borderRadius: 99 }}>פעיל ✓</span>}
                    </div>
                  </button>
                );
              })}
            </div>

            <div style={{ fontSize: 12, color: T.muted }}>השינוי ייכנס לתוקף בפעם הבאה שתיכנס לממשק — לחץ "שמור" בתחתית הדף כדי לשמור.</div>
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
    </div>
  );
}
