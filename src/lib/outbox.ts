// Durable, ordered outbox for offline-tolerant mutations.
// Every mutating action (create order, add items, status change, fire course, …)
// is recorded here with an idempotency key, then replayed FIFO once the network
// returns. Stored in IndexedDB so it survives reloads and app restarts.

export type OutboxEntry = {
  key: string;          // idempotency key — sent as X-Idempotency-Key, dedupes server-side
  seq: number;          // monotonic ordering (FIFO replay)
  kind: string;         // e.g. "order.create" | "order.addItems" | "order.status" | "order.fire"
  method: string;       // HTTP method
  url: string;          // endpoint
  body: unknown;        // JSON payload
  label: string;        // human-readable, for the offline banner
  tempId?: string;      // on "order.create": the local temp id this resolves to a real id
  createdAt: number;
  attempts: number;
};

const DB_NAME = "menu4u-outbox";
const DB_VERSION = 1;
const STORE = "queue";
const SEQ_KEY = "m4u_outbox_seq";

function nextSeq(): number {
  try {
    const n = Number(localStorage.getItem(SEQ_KEY) ?? "0") + 1;
    localStorage.setItem(SEQ_KEY, String(n));
    return n;
  } catch {
    return Date.now();
  }
}

export function newKey(): string {
  const rnd = Math.random().toString(36).slice(2, 10);
  return `idem_${Date.now()}_${rnd}`;
}

// A local placeholder id for an order created while offline. Once the create
// syncs, every queued action referencing it is rewritten to the real server id.
export function newTempId(): string {
  return `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "key" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Rewrite every queued entry that references a temp id, replacing it with the
// real server id (in both the URL and the JSON body). Called after an offline
// order-create syncs and we learn its real id.
export async function outboxRemapTempId(tempId: string, realId: string): Promise<void> {
  const entries = await outboxList();
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    for (const e of entries) {
      const urlHas = e.url.includes(tempId);
      const bodyStr = e.body == null ? "" : JSON.stringify(e.body);
      const bodyHas = bodyStr.includes(tempId);
      if (!urlHas && !bodyHas) continue;
      const next: OutboxEntry = {
        ...e,
        url: urlHas ? e.url.split(tempId).join(realId) : e.url,
        body: bodyHas ? JSON.parse(bodyStr.split(tempId).join(realId)) : e.body,
      };
      store.put(next);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Ask the Service Worker to replay the outbox in the background — fires even if
// the app is later closed (where supported; otherwise the in-app hook handles it).
export function registerOutboxSync(): void {
  try {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    if (typeof window === "undefined" || !("SyncManager" in window)) return;
    navigator.serviceWorker.ready
      .then(reg => (reg as unknown as { sync: { register: (t: string) => Promise<void> } }).sync.register("outbox-flush"))
      .catch(() => { /* best-effort */ });
  } catch { /* ignore */ }
}

export async function outboxAdd(e: Omit<OutboxEntry, "seq" | "createdAt" | "attempts">): Promise<OutboxEntry> {
  const entry: OutboxEntry = { ...e, seq: nextSeq(), createdAt: Date.now(), attempts: 0 };
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  registerOutboxSync();
  return entry;
}

export async function outboxList(): Promise<OutboxEntry[]> {
  const db = await openDb();
  const rows = await new Promise<OutboxEntry[]>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve((req.result as OutboxEntry[]) ?? []);
    req.onerror = () => reject(req.error);
  });
  return rows.sort((a, b) => a.seq - b.seq);
}

export async function outboxRemove(key: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function outboxBumpAttempts(key: string, e: OutboxEntry): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put({ ...e, attempts: e.attempts + 1 });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function outboxCount(): Promise<number> {
  const db = await openDb();
  return new Promise<number>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).count();
    req.onsuccess = () => resolve(req.result ?? 0);
    req.onerror = () => reject(req.error);
  });
}
