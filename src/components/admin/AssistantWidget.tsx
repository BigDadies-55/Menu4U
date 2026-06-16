"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { T } from "@/lib/ui";

type Entry = { id: string; question: string; answer: string; rel?: number };

export function AssistantWidget({ page }: { page: string }) {
  const [open, setOpen]           = useState(false);
  const [query, setQuery]         = useState("");
  const [results, setResults]     = useState<Entry[]>([]);
  const [defaults, setDefaults]   = useState<Entry[]>([]);
  const [selected, setSelected]   = useState<Entry | null>(null);
  const [loading, setLoading]     = useState(false);
  const [feedback, setFeedback]   = useState<"up" | "down" | null>(null);
  const [noResult, setNoResult]   = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load defaults when opened
  useEffect(() => {
    if (!open) return;
    fetch(`/api/admin/assistant?page=${page}`)
      .then(r => r.ok ? r.json() : { defaults: [] })
      .then(d => setDefaults(d.defaults ?? []));
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [open, page]);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setNoResult(false); return; }
    setLoading(true);
    setSelected(null);
    setFeedback(null);
    try {
      const r = await fetch(`/api/admin/assistant?page=${page}&q=${encodeURIComponent(q)}`);
      const d = await r.json();
      const res: Entry[] = d.results ?? [];
      setResults(res);
      setNoResult(res.length === 0);
    } finally { setLoading(false); }
  }, [page]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, search]);

  function selectEntry(e: Entry) {
    setSelected(e);
    setFeedback(null);
    setQuery(e.question);
    setResults([]);
  }

  async function sendFeedback(rating: 1 | -1) {
    if (!selected || feedback) return;
    setFeedback(rating === 1 ? "up" : "down");
    await fetch("/api/admin/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entryId: selected.id, page, question: selected.question, rating }),
    });
  }

  function reset() {
    setQuery(""); setResults([]); setSelected(null);
    setFeedback(null); setNoResult(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  const show = defaults.length > 0 || results.length > 0 || selected || noResult || loading;

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        title="עוזר אישי"
        style={{
          position: "fixed", bottom: 24, left: 24, zIndex: 1200,
          width: 52, height: 52, borderRadius: "50%",
          background: open ? T.gold : T.surface,
          border: `2px solid ${open ? T.gold : T.border}`,
          color: open ? "#1a1208" : T.text,
          fontSize: 22, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
          transition: "all 0.2s",
        }}
      >
        {open ? "✕" : "💬"}
      </button>

      {/* Chat panel */}
      {open && (
        <div style={{
          position: "fixed", bottom: 88, left: 24, zIndex: 1200,
          width: 360, maxWidth: "calc(100vw - 48px)",
          background: T.surface, border: `1px solid ${T.border}`,
          borderRadius: 16, boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
          direction: "rtl", display: "flex", flexDirection: "column",
          maxHeight: "70vh", overflow: "hidden",
        }}>
          {/* Header */}
          <div style={{ padding: "14px 16px 10px", borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: T.text }}>💬 עוזר אישי</div>
            <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>שאל כל שאלה על הדף הזה</div>
          </div>

          {/* Search input */}
          <div style={{ padding: "10px 12px", borderBottom: `1px solid ${T.border}`, flexShrink: 0, display: "flex", gap: 8 }}>
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === "Escape" && reset()}
              placeholder="למשל: איך מוסיפים משמרת?"
              style={{
                flex: 1, background: T.panel, border: `1px solid ${T.border}`,
                borderRadius: 10, padding: "8px 12px", fontSize: 14,
                color: T.text, fontFamily: "inherit", outline: "none",
                direction: "rtl",
              }}
            />
            {query && (
              <button onClick={reset} style={{ background: "transparent", border: "none", color: T.muted, cursor: "pointer", fontSize: 16, padding: "0 4px" }}>✕</button>
            )}
          </div>

          {/* Body */}
          <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>

            {/* Loading */}
            {loading && <div style={{ color: T.muted, fontSize: 13, textAlign: "center", padding: 12 }}>מחפש...</div>}

            {/* Selected answer */}
            {selected && !loading && (
              <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 14px" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.gold, marginBottom: 6 }}>✦ {selected.question}</div>
                <div style={{ fontSize: 13, color: T.text, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{selected.answer}</div>
                {/* Feedback */}
                <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8, borderTop: `1px solid ${T.border}`, paddingTop: 8 }}>
                  <span style={{ fontSize: 11, color: T.muted }}>האם עזר?</span>
                  <button onClick={() => sendFeedback(1)}
                    style={{ background: feedback === "up" ? T.green + "30" : "transparent", border: `1px solid ${feedback === "up" ? T.green : T.border}`, borderRadius: 8, padding: "3px 10px", cursor: "pointer", fontSize: 13, color: feedback === "up" ? T.green : T.muted }}>
                    👍
                  </button>
                  <button onClick={() => sendFeedback(-1)}
                    style={{ background: feedback === "down" ? T.red + "30" : "transparent", border: `1px solid ${feedback === "down" ? T.red : T.border}`, borderRadius: 8, padding: "3px 10px", cursor: "pointer", fontSize: 13, color: feedback === "down" ? T.red : T.muted }}>
                    👎
                  </button>
                  {feedback && <span style={{ fontSize: 11, color: T.muted }}>{feedback === "up" ? "תודה! 🙏" : "נרשם לשיפור 📝"}</span>}
                </div>
              </div>
            )}

            {/* Search results */}
            {!selected && !loading && results.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {results.map(r => (
                  <button key={r.id} onClick={() => selectEntry(r)}
                    style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 12px", cursor: "pointer", textAlign: "right", color: T.text, fontSize: 13, fontFamily: "inherit", transition: "border-color 0.15s" }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = T.gold)}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = T.border)}
                  >
                    {r.question}
                  </button>
                ))}
              </div>
            )}

            {/* No results */}
            {noResult && !loading && !selected && (
              <div style={{ color: T.muted, fontSize: 13, textAlign: "center", padding: "12px 8px", lineHeight: 1.6 }}>
                😕 לא נמצאה תשובה לשאלה זו<br />
                <span style={{ fontSize: 12 }}>השאלה נרשמה — מנהל יוסיף תשובה בקרוב</span>
              </div>
            )}

            {/* Default suggestions (no query) */}
            {!query && !loading && !selected && defaults.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ fontSize: 11, color: T.muted, fontWeight: 600, marginBottom: 2 }}>שאלות נפוצות:</div>
                {defaults.map(d => (
                  <button key={d.id} onClick={() => selectEntry(d)}
                    style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 10, padding: "9px 12px", cursor: "pointer", textAlign: "right", color: T.text, fontSize: 13, fontFamily: "inherit" }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = T.gold)}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = T.border)}
                  >
                    {d.question}
                  </button>
                ))}
              </div>
            )}

            {/* Empty state */}
            {!show && !loading && (
              <div style={{ color: T.muted, fontSize: 13, textAlign: "center", padding: "16px 8px" }}>
                הקלד שאלה למעלה או בחר מהצעות
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
