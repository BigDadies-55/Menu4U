/**
 * Simple in-process pub/sub for SSE.
 * Works for single-server deployments. For multi-instance, swap with Redis pub/sub.
 */
type Listener = () => void;

// restaurantId → set of listener callbacks
const listeners = new Map<string, Set<Listener>>();

export function sseSubscribe(restaurantId: string, cb: Listener): () => void {
  if (!listeners.has(restaurantId)) listeners.set(restaurantId, new Set());
  listeners.get(restaurantId)!.add(cb);
  // Return unsubscribe function
  return () => {
    listeners.get(restaurantId)?.delete(cb);
    if (listeners.get(restaurantId)?.size === 0) listeners.delete(restaurantId);
  };
}

export function sseNotify(restaurantId: string): void {
  // Notify specific restaurant listeners
  listeners.get(restaurantId)?.forEach(cb => { try { cb(); } catch {} });
  // Also notify SUPER_ADMIN listeners (subscribed as "ALL")
  listeners.get("ALL")?.forEach(cb => { try { cb(); } catch {} });
}
