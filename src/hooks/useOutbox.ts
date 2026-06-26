"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  outboxAdd, outboxList, outboxRemove, outboxBumpAttempts, outboxCount, newKey,
  type OutboxEntry,
} from "@/lib/outbox";

export type SyncResult = { entry: OutboxEntry; ok: boolean; data?: unknown; status?: number };

type EnqueueArgs = { kind: string; method: string; url: string; body: unknown; label: string; key?: string };

// Unified offline-tolerant mutation queue. enqueue() records an action and tries
// to flush immediately; on failure it stays durably queued and is replayed FIFO
// whenever the connection returns. Each action carries an idempotency key so a
// retry never double-applies server-side.
export function useOutbox(onResults?: (results: SyncResult[]) => void) {
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const onResultsRef = useRef(onResults);
  onResultsRef.current = onResults;
  const flushingRef = useRef(false);

  const refreshCount = useCallback(async () => {
    try { setPendingCount(await outboxCount()); } catch { /* ignore */ }
  }, []);

  const flush = useCallback(async () => {
    if (flushingRef.current) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    flushingRef.current = true;
    setIsSyncing(true);
    const results: SyncResult[] = [];
    try {
      const entries = await outboxList();
      for (const entry of entries) {
        try {
          const res = await fetch(entry.url, {
            method: entry.method,
            headers: { "Content-Type": "application/json", "X-Idempotency-Key": entry.key },
            body: entry.body == null ? undefined : JSON.stringify(entry.body),
          });
          if (res.ok) {
            const data = await res.json().catch(() => ({}));
            await outboxRemove(entry.key);
            results.push({ entry, ok: true, data, status: res.status });
          } else if (res.status >= 400 && res.status < 500 && res.status !== 409) {
            // Permanent client error (bad payload, gone) — drop the poison item.
            const data = await res.json().catch(() => ({}));
            await outboxRemove(entry.key);
            results.push({ entry, ok: false, data, status: res.status });
          } else {
            // 5xx or 409 conflict — keep, stop to preserve order (409 handled in phase 2).
            await outboxBumpAttempts(entry.key, entry);
            results.push({ entry, ok: false, status: res.status });
            break;
          }
        } catch {
          break; // network dropped again — stop, preserve order
        }
      }
    } finally {
      flushingRef.current = false;
      setIsSyncing(false);
      await refreshCount();
      if (results.length) onResultsRef.current?.(results);
    }
  }, [refreshCount]);

  const enqueue = useCallback(async (args: EnqueueArgs): Promise<string> => {
    const key = args.key ?? newKey();
    await outboxAdd({ key, kind: args.kind, method: args.method, url: args.url, body: args.body, label: args.label });
    await refreshCount();
    flush(); // optimistic — try right away if we're actually online
    return key;
  }, [flush, refreshCount]);

  useEffect(() => {
    refreshCount();
    flush();
    function onOnline() { setIsOnline(true); flush(); }
    function onOffline() { setIsOnline(false); }
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    // Periodic retry as a safety net (covers flaky connections that never fire "online").
    const id = setInterval(() => { if (navigator.onLine) flush(); }, 20_000);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      clearInterval(id);
    };
  }, [flush, refreshCount]);

  return { isOnline, pendingCount, isSyncing, enqueue, flush };
}
