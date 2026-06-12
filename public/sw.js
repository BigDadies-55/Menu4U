/* Menu4U Service Worker — offline cache + push notifications */
const CACHE_STATIC = "menu4u-static-v2";
const CACHE_API    = "menu4u-api-v2";

// API paths to cache for offline (network-first, fall back to cache)
const WAITER_API_PREFIXES = [
  "/api/admin/waiter-pos/menu",
  "/api/admin/waiter-pos/tables",
  "/api/admin/waiter-pos/popular",
  "/api/admin/restaurants/",        // covers layout endpoint
  "/api/admin/waiter-stations",
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
