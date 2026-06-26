/* Menu4U Service Worker — offline cache + push notifications + outbox sync */
const CACHE_STATIC = "menu4u-static-v6";
const CACHE_API    = "menu4u-api-v6";

// ── Background Sync: replay the offline outbox even if the app is closed ──────
const OUTBOX_DB = "menu4u-outbox";
const OUTBOX_STORE = "queue";

function obOpen() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(OUTBOX_DB, 1);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
function obAll(db) {
  return new Promise((res, rej) => {
    const tx = db.transaction(OUTBOX_STORE, "readonly");
    const rq = tx.objectStore(OUTBOX_STORE).getAll();
    rq.onsuccess = () => res((rq.result || []).sort((a, b) => a.seq - b.seq));
    rq.onerror = () => rej(rq.error);
  });
}
function obDel(db, key) {
  return new Promise((res, rej) => {
    const tx = db.transaction(OUTBOX_STORE, "readwrite");
    tx.objectStore(OUTBOX_STORE).delete(key);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}
function obRemap(db, tempId, realId) {
  return obAll(db).then(entries => new Promise((res, rej) => {
    const tx = db.transaction(OUTBOX_STORE, "readwrite");
    const st = tx.objectStore(OUTBOX_STORE);
    for (const e of entries) {
      const uh = e.url.includes(tempId);
      const bs = e.body == null ? "" : JSON.stringify(e.body);
      const bh = bs.includes(tempId);
      if (!uh && !bh) continue;
      st.put({ ...e, url: uh ? e.url.split(tempId).join(realId) : e.url, body: bh ? JSON.parse(bs.split(tempId).join(realId)) : e.body });
    }
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  }));
}
async function flushOutbox() {
  const db = await obOpen();
  const entries = await obAll(db);
  for (const e of entries) {
    let res;
    try {
      res = await fetch(e.url, {
        method: e.method,
        headers: { "Content-Type": "application/json", "X-Idempotency-Key": e.key },
        body: e.body == null ? undefined : JSON.stringify(e.body),
      });
    } catch (_) { break; } // still offline — stop, retry on next sync
    if (res.ok) {
      let data = {};
      try { data = await res.json(); } catch (_) { /* ignore */ }
      await obDel(db, e.key);
      if (e.tempId && data && data.id) await obRemap(db, e.tempId, data.id);
    } else if (res.status >= 400 && res.status < 500) {
      await obDel(db, e.key); // drop poison / conflict
    } else {
      break; // 5xx — keep, retry later
    }
  }
  // Nudge any open clients to refresh their data after a background flush.
  const clientList = await self.clients.matchAll({ includeUncontrolled: true });
  for (const c of clientList) c.postMessage({ type: "outbox-flushed" });
}

self.addEventListener("sync", event => {
  if (event.tag === "outbox-flush") event.waitUntil(flushOutbox());
});

// API paths to cache for offline (network-first, fall back to cache)
const WAITER_API_PREFIXES = [
  "/api/admin/waiter-pos/menu",
  "/api/admin/waiter-pos/tables",
  "/api/admin/waiter-pos/popular",
  "/api/admin/restaurants/",        // covers layout endpoint
  "/api/admin/waiter-stations",
  "/api/admin/orders/",             // order detail — cached per orderId
];

// Static waiter routes to pre-cache shell
const WAITER_ROUTES = [
  "/admin/waiter-pos",
  "/admin/waiter-floor",
];

self.addEventListener("install", e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_STATIC).then(c =>
      c.addAll(WAITER_ROUTES).catch(() => { /* ignore if unreachable during install */ })
    )
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_STATIC && k !== CACHE_API)
          .map(k => caches.delete(k))
      )
    ).then(() => clients.claim())
  );
});

// ── Push notifications ────────────────────────────────────────────────────────
self.addEventListener("push", event => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? "Menu4U", {
      body: data.body ?? "",
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      tag: data.tag ?? "menu4u",
      data: { url: data.url ?? "/admin" },
      dir: "rtl",
      lang: "he",
    })
  );
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.includes("/admin") && "focus" in c) return c.focus();
      }
      return clients.openWindow(event.notification.data?.url ?? "/admin");
    })
  );
});

// ── Fetch strategy ────────────────────────────────────────────────────────────
self.addEventListener("fetch", e => {
  const { request } = e;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Waiter API routes — network-first, fall back to cache
  const isWaiterApi = WAITER_API_PREFIXES.some(p => url.pathname.startsWith(p));
  if (isWaiterApi) {
    e.respondWith(
      fetch(request)
        .then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_API).then(c => c.put(request, clone));
          }
          return res;
        })
        .catch(() => caches.match(request).then(r => r ?? Response.error()))
    );
    return;
  }

  // Next.js static assets — cache-first
  if (url.pathname.startsWith("/_next/static/")) {
    e.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(res => {
          if (res.ok) caches.open(CACHE_STATIC).then(c => c.put(request, res.clone()));
          return res;
        });
      })
    );
    return;
  }

  // Waiter page shells — network-first, fall back to cache
  if (WAITER_ROUTES.some(r => url.pathname === r || url.pathname.startsWith(r + "?"))) {
    e.respondWith(
      fetch(request)
        .then(res => {
          if (res.ok) caches.open(CACHE_STATIC).then(c => c.put(request, res.clone()));
          return res;
        })
        .catch(() => caches.match(request).then(r => r ?? Response.error()))
    );
    return;
  }
});
