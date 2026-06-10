/* Menu4U Service Worker — menu cache */
const CACHE = "menu4u-menu-v1";
const MENU_PATH = "/api/admin/waiter/menu";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(clients.claim()));

self.addEventListener("fetch", e => {
  const { request } = e;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (!url.pathname.startsWith(MENU_PATH)) return;

  // Network-first, fall back to cache
  e.respondWith(
    fetch(request)
      .then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(request, clone));
        }
        return res;
      })
      .catch(() => caches.match(request).then(r => r ?? Response.error()))
  );
});
