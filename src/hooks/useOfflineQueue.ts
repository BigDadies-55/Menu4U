"use client";
import { useState, useEffect, useCallback, useRef } from "react";

const QUEUE_KEY = "menu4u_offline_orders";

type PendingOrder = {
  localId: string;
  payload: object;
  queuedAt: number;
};

type SyncResult = { localId: string; ok: boolean; orderId?: string; orderNumber?: number };

function loadQueue(): PendingOrder[] {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]"); } catch { return []; }
}
function saveQueue(q: PendingOrder[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}

export function useOfflineQueue(onSynced?: (results: SyncResult[]) => void) {
  const [isOnline,    setIsOnline]    = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing,   setIsSyncing]   = useState(false);
  const onSyncedRef = useRef(onSynced);
  onSyncedRef.current = onSynced;

  const syncQueue = useCallback(async () => {
    const q = loadQueue();
    if (q.length === 0) return;
    setIsSyncing(true);
    const remaining: PendingOrder[] = [];
    const results:   SyncResult[]   = [];
    for (const item of q) {
      try {
        const res = await fetch("/api/admin/orders/waiter", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify(item.payload),
        });
        if (res.ok) {
          const d = await res.json();
          results.push({ localId: item.localId, ok: true, orderId: d.id, orderNumber: d.orderNumber });
        } else {
          remaining.push(item);
          results.push({ localId: item.localId, ok: false });
        }
      } catch {
        remaining.push(item);
        break; // offline again — stop trying
      }
    }
    saveQueue(remaining);
    setPendingCount(remaining.length);
    setIsSyncing(false);
    if (results.some(r => r.ok)) onSyncedRef.current?.(results);
  }, []);

  useEffect(() => {
    setPendingCount(loadQueue().length);

    function handleOnline()  { setIsOnline(true);  syncQueue(); }
    function handleOffline() { setIsOnline(false); }

    window.addEventListener("online",  handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online",  handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [syncQueue]);

  function enqueue(payload: object): string {
    const localId = `offline_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const q = loadQueue();
    q.push({ localId, payload, queuedAt: Date.now() });
    saveQueue(q);
    setPendingCount(q.length);
    return localId;
  }

  return { isOnline, pendingCount, isSyncing, enqueue, syncQueue };
}
