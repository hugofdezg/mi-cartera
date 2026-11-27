// Service worker: guarda la app en el dispositivo para que abra sin conexión.
// Si cambias index.html, sube el número de versión para que se actualice.
const CACHE = "mi-cartera-v11";
const CORE = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./icon-512-maskable.png", "./apple-touch-icon.png"];
const EXTRA = [
  "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js",
  "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
];

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(CORE);
    await Promise.all(EXTRA.map((u) =>
      fetch(new Request(u, { mode: "no-cors" })).then((r) => c.put(u, r)).catch(() => {})
    ));
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  // Solo se gestionan la propia app y sus recursos fijos. Las consultas de precios (Alpha Vantage) van siempre a la red.
  const host = new URL(e.request.url).hostname;
  const own = host === self.location.hostname;
  const allowed = ["cdnjs.cloudflare.com", "fonts.googleapis.com", "fonts.gstatic.com"];
  if (!own && allowed.indexOf(host) < 0) return;
  if (own) {
    // Archivos de la app: primero la red (para ver siempre la versión nueva) y, sin conexión, la copia guardada.
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      try {
        const r = await fetch(e.request.url, { cache: "no-cache" });
        if (r && r.ok) c.put(e.request, r.clone());
        return r;
      } catch (err) {
        const cached = await c.match(e.request, { ignoreSearch: true });
        if (cached) return cached;
        if (e.request.mode === "navigate") return (await c.match("./index.html")) || Response.error();
        return Response.error();
      }
    })());
    return;
  }
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const cached = await c.match(e.request, { ignoreSearch: true });
    const network = fetch(e.request).then((r) => {
      if (r && (r.ok || r.type === "opaque")) c.put(e.request, r.clone());
      return r;
    }).catch(() => null);
    if (cached) { e.waitUntil(network); return cached; }
    const r = await network;
    if (r) return r;
    if (e.request.mode === "navigate") return (await c.match("./index.html")) || Response.error();
    return Response.error();
  })());
});
